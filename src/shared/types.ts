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
  /** 潘多拉头像状态（帖子/评论/通知等用户载荷普遍携带） */
  pandora_info?: PandoraAvatarState | null;
}

/** 潘多拉头像效果状态（/api/users/info 及各用户载荷的 pandora_info） */
export interface PandoraAvatarState {
  active: boolean;
  box_status?: string;
  event_code?: string;
  event_title?: string;
  expire_at?: string;
  avatar_effect?: string;
  avatar_skew_angle?: number;
}

/** 潘多拉盒子实例（GET /api/pandora/today 的 d.box） */
export interface PandoraBox {
  box_instance_id: string;
  event_code: string;
  event_name?: string;
  event_title?: string;
  tier_code?: string;
  /** bronze / silver / gold / purple */
  rarity: string;
  rolled_value?: number;
  open_at: string;
  apply_at: string;
  expire_at: string;
  reroll_deadline_at: string | null;
  reroll_used: number;
  reroll_limit: number;
  force_purple_reroll: boolean;
}

/** GET /api/pandora/today */
export interface PandoraToday {
  has_box: boolean;
  can_open: boolean;
  opened_today?: boolean;
  next_open_at?: string | null;
  active_extended: boolean;
  box: PandoraBox | null;
}

/** GET /api/users/info?fields=exp 的 d.exp */
export interface UserExpInfo {
  level: number;
  currentExp: number;
  nextLevelExp: number;
  expToNext: number;
  progress: number;
  maxLevel?: number;
  limit?: {
    dailyPostLimit?: number;
    dailyCommentLimit?: number;
    dailyReactionLimit?: number;
    dailyVoteLimit?: number;
    dailyBetLimit?: number;
    dailyRewardLimit?: number;
  } | null;
}

/** GET /api/users/info?fields=active 的 d.active（今日活跃度档位） */
export interface DailyActive {
  score: number;
  percent: number;
  tierIndex: number;
  marks?: number[];
  resetInSeconds?: number;
}

/** GET /api/sign/stats */
export interface SignStats {
  streak: number;
  maxStreak?: number;
  todaySigned?: boolean;
  lastSignDate?: string | null;
  todaySignAt?: string | null;
}

/** 当前用户扩展统计（exp / coins / active / 连签） */
export interface MyStats {
  exp: UserExpInfo | null;
  coins: number;
  active: DailyActive | null;
  sign: SignStats | null;
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
    /* ---- 以下字段逆向自站点通知页渲染逻辑（layout chunk） ---- */
    /** reply/mention/reaction(comment)/content_check：评论摘要 */
    commentText?: string;
    /** reaction：表态对象类型 post/comment */
    reactionType?: string;
    /** reaction：表情 → 用户列表（取 key 展示具体表情） */
    reactions?: Record<string, unknown>;
    /** get_reward：打赏金额（金币） */
    amount?: number;
    /** get_reward：打赏对象类型 post/comment/rss_article */
    rewardType?: string;
    /** follow：关注者用户名 */
    followerUsername?: string;
    /** 匿名者头像（格式同 author.avatar_url） */
    alias_avatar_url?: string;
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

/** GET /api/posts/mine 的列表项（我的帖子） */
export interface MyPostSummary {
  short_id: string;
  title: string;
  created_at: string;
  node: { slug: string; name: string; parent_slug?: string };
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
  // 我的帖子
  listMyPosts(): Promise<MyPostSummary[]>;
  // 用户扩展统计（等级/经验/金币/今日活跃度）
  getMyStats(): Promise<MyStats | null>;
  // 连签统计
  getSignStats(): Promise<SignStats | null>;
  // 潘多拉盒子
  getPandoraToday(): Promise<PandoraToday | null>;
  openPandora(): Promise<PandoraBox>;
  rerollPandora(boxInstanceId: string): Promise<PandoraBox>;
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
