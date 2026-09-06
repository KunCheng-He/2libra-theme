/* ============ 站点数据模型（由 2libra API 逆向而来） ============ */

export interface ApiEnvelope<T> {
  /** 0 = 成功 */
  c: number;
  m: string;
  d: T;
  t?: number;
  u?: string;
}

export interface NodeChild {
  id: string;
  name: string;
  slug: string;
  parent_id: string;
  parent_slug: string;
  post_count: number;
  require_login: boolean;
}

export interface NodeGroup {
  id: string;
  name: string;
  slug: string;
  post_count: number;
  require_login: boolean;
  children: NodeChild[];
}

export interface Author {
  id: string;
  username: string;
  avatar_url: string | null;
  role?: string;
  is_pro?: boolean;
  equipped_badges?: { badge: { name: string; icon_url: string } }[];
}

/** 表情表态汇总（GET /api/posts/{id}、/api/comments/list 的 reactions_summary） */
export interface ReactionSummary {
  emoji: string;
  count: number;
}

/** 打赏记录（rewards 数组项） */
export interface RewardItem {
  id: string;
  amount: number;
  user: Author;
  created_at?: string;
  type?: string;
}

export interface PostSummary {
  id: string;
  short_id: string;
  node: {
    id: string;
    name: string;
    slug: string;
    parent_slug: string;
    /** 节点可用表情（表态/打赏选择条） */
    main_emojis?: string[];
    sub_emojis?: string[];
  };
  title: string;
  author: Author;
  created_at: string;
  comment_count: number;
  latest_commented_at: string | null;
  last_commented_by?: { username: string } | null;
  extra?: { latest_comment_floor?: number } | null;
  score?: unknown;
  status: string;
}

export interface Paged<T> {
  posts?: T[];
  items?: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Postscript {
  id: string;
  content: string;
  created_at: string;
}

export interface PostDetail extends PostSummary {
  content: string;
  content_html: string | null;
  updated_at: string;
  tags: { id: string; name: string }[];
  views: number;
  type: string;
  postscripts?: Postscript[];
  /** 匿名帖（匿名帖作者不可被表态/打赏） */
  is_anonymous_author?: boolean;
  reactions_summary?: ReactionSummary[] | null;
  /** 当前用户已表态的 emoji 列表 */
  my_reactions?: string[] | null;
  rewards?: RewardItem[] | null;
  /** 正文用到的站内表情映射（":code:" → 图片路径） */
  emojis?: Record<string, string> | null;
}

export interface CommentNode {
  id: string;
  content: string;
  content_html: string | null;
  author: Author;
  alias_id: string | null;
  parent_id: string | null;
  parent?: { id: string; content: string; author: Author } | null;
  children?: CommentNode[];
  floor: number;
  flat_floor?: number;
  reply_comment_id?: string | null;
  level?: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  reactions_summary?: ReactionSummary[] | null;
  my_reactions?: string[] | null;
  rewards?: RewardItem[] | null;
  /** 金币池中奖展示（rewards 之外） */
  reward_pool_rewards?: { amount: number }[] | null;
  /** 评论用到的站内表情映射（":code:" → 图片路径） */
  emojis?: Record<string, string> | null;
}

export interface UserInfo extends Author {
  email?: string;
  level?: number;
}

/** 通知项（GET /api/notifications/list，逆向自站点前端） */
export interface SiteNotification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  from_user?: Author | null;
  related_id?: string | null;
  payload?: {
    postTitle?: string;
    postShortId?: string;
    postSlug?: string;
    postNodeSlug?: string;
    commentId?: string;
    commentLevel?: number;
    locatedFloor?: number;
    flatFloor?: number;
    alias_id?: string;
    alias_name?: string;
    [key: string]: unknown;
  } | null;
}

export interface NotificationPage {
  list: SiteNotification[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SearchResultItem {
  id?: string;
  short_id?: string;
  title?: string;
  content?: string;
  name?: string;
  slug?: string;
  username?: string;
  avatar_url?: string;
  parent_slug?: string;
  node?: { name?: string; slug?: string; parent_slug?: string };
}

/* ============ 扩展内部模型 ============ */

/** 消息流中的一条消息（帖子正文 / 楼层回复 / 后记） */
export interface ChatMessage {
  kind: "post" | "comment" | "postscript";
  id: string;
  author: Author;
  /** 显示名（别名场景用作者名即可） */
  name: string;
  /** markdown 原文 */
  content: string;
  createdAt: string;
  /** 楼层号；楼主为 0 */
  floor: number;
  /** 引用回复目标（父楼层） */
  quote?: { name: string; floor: number; content: string; parentId: string } | null;
  isSelf: boolean;
  /** 已有表情表态（含数量） */
  reactions: ReactionSummary[];
  /** 当前用户已表态的 emoji */
  myReactions: string[];
  /** 已有打赏 */
  rewards: RewardItem[];
  /** 金币池中奖金额（评论） */
  rewardPool: number;
  /** 评论表态通知定位楼层（站点公式 grandparent.floor || parent.floor || floor || 0） */
  locatedFloor: number;
  /** 匿名别名 id（打赏/表态自身别名需屏蔽，与站点 selected-alias 逻辑一致） */
  aliasId: string | null;
  /** 本条消息的站内表情映射（":code:" → 图片路径），渲染气泡时替换 :code: */
  emojiMap: Record<string, string> | null;
}

/** 表态打标请求（POST /api/post-reactions/{postId}） */
export interface TogglePostReactionInput {
  postId: string;
  emoji: string;
  recUserId: string;
  path: string;
  postTitle: string;
  nodeId: string;
}

/** 表态打标请求（POST /api/comment-reactions/{commentId}） */
export interface ToggleCommentReactionInput {
  commentId: string;
  emoji: string;
  recUserId: string;
  path: string;
  /** 评论摘要（前 100 字，通知预览用） */
  comment: string;
  locatedFloor: number;
  nodeId: string;
}

/** 打赏请求（POST /api/rewards） */
export interface CreateRewardInput {
  type: "post" | "comment";
  amount: number;
  postId: string;
  commentId?: string;
  path: string;
}

export interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string;
  level?: number;
  replyCommentId?: string;
}

export interface CreatePostInput {
  title: string;
  content: string;
  node_id: string;
}

/* ============ 主题包接口 ============ */

export type ThemeRouteType = "home" | "node" | "post" | "create" | "search";

export interface ThemeRoute {
  type: ThemeRouteType;
  /** 帖子 short_id */
  postId?: string;
  /** 节点父级 slug */
  parentSlug?: string;
  /** 子节点 slug */
  childSlug?: string;
  /** 搜索词 */
  query?: string;
}

export interface RouterApi {
  /** 当前路径（pathname + search） */
  readonly href: string;
  push(url: string): void;
  replace(url: string): void;
  /** 订阅路由变化（含 push/replace/popstate），返回取消函数 */
  subscribe(fn: (url: string) => void): () => void;
}

export interface DataApi {
  getNodeTree(): Promise<NodeGroup[]>;
  listLatest(page: number, limit: number): Promise<Paged<PostSummary>>;
  listByParent(parentSlug: string, page: number, limit: number): Promise<Paged<PostSummary>>;
  listByChild(parentSlug: string, nodeId: string, page: number, limit: number): Promise<Paged<PostSummary>>;
  getPost(shortId: string): Promise<PostDetail>;
  getComments(shortId: string, page: number, limit: number): Promise<Paged<CommentNode>>;
  createComment(input: CreateCommentInput): Promise<CommentNode>;
  createPost(input: CreatePostInput): Promise<PostDetail>;
  /** 帖子表态（官方接口，金币扣用；成功返回 d.type 非空） */
  togglePostReaction(input: TogglePostReactionInput): Promise<{ type?: string } | null>;
  /** 评论表态（官方接口，金币扣用；成功返回 d.type 非空） */
  toggleCommentReaction(input: ToggleCommentReactionInput): Promise<{ type?: string } | null>;
  /** 打赏（官方接口；amount 100–500，步进 50） */
  createReward(input: CreateRewardInput): Promise<unknown>;
  search(q: string): Promise<{ posts?: SearchResultItem[]; users?: SearchResultItem[]; nodes?: SearchResultItem[] } | null>;
  getCurrentUser(): Promise<UserInfo | null>;
  getUnreadCount(): Promise<number | null>;
  listNotifications(page: number, type?: string): Promise<NotificationPage>;
  markNotificationsRead(ids: string[]): Promise<unknown>;
  avatarUrl(author: Author | null | undefined, alias?: boolean): string;
}

export interface ThemeContext {
  root: ShadowRoot;
  data: DataApi;
  router: RouterApi;
  /** 请求引擎回退原版界面（异常保护） */
  escapeHatch(): void;
}

export interface ThemePack {
  id: string;
  name: string;
  version: string;
  /** 解析路由；不支持的路由返回 null（引擎将回退原版） */
  matchRoute(path: string, search: string): ThemeRoute | null;
  mount(ctx: ThemeContext): Promise<void>;
  unmount(): Promise<void>;
  onRouteChange(route: ThemeRoute, url: string): void;
}
