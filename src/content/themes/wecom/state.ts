import type { Author, ChatMessage, CommentNode, NodeGroup, PostDetail, PostSummary, ThemeRoute, UserInfo } from "../../../shared/types";

export interface ReplyTarget {
  id: string;
  floor: number;
  name: string;
  content: string;
  parentId: string;
  level: number;
  replyCommentId: string;
}

export interface SearchResults {
  posts: { short_id: string; title: string; parent_slug?: string; node_name?: string }[];
  users: { username: string; avatar_url?: string }[];
  nodes: { slug: string; name: string; parent_slug?: string }[];
}

/** 未读消息视图里的一条会话（按帖子聚合未读通知） */
export interface UnreadSession {
  shortId: string;
  /** 帖子路由用的节点 slug（payload.postNodeSlug） */
  nodeSlug: string;
  title: string;
  /** 最新一条未读的来源用户名（匿名时为别名） */
  from: string;
  /** 最新一条未读的来源用户（匿名时为 null，用节点头像兜底） */
  author: Author | null;
  lastAt: string;
  unread: number;
  /** 该帖子关联的未读通知 id 列表 */
  ids: string[];
  /** 最新一条未读的动作描述（回复/赞了/收藏了…） */
  kind: string;
}

export interface AppState {
  route: ThemeRoute;
  nodes: NodeGroup[];
  openGroups: Set<string>;

  sessions: PostSummary[];
  sessionsPage: number;
  sessionsTotalPages: number;
  sessionsLoading: boolean;
  activeParent: string | null;
  activeChildSlug: string | null;

  post: PostDetail | null;
  messages: ChatMessage[];
  commentsPage: number;
  commentsTotalPages: number;
  commentsLoading: boolean;
  sending: boolean;
  replyTarget: ReplyTarget | null;

  user: UserInfo | null;
  unread: number | null;

  unreadFilter: boolean;
  unreadSessions: UnreadSession[];
  unreadLoading: boolean;
  /** 历史消息：已读通知按帖子聚合（未读为空时回退展示） */
  readSessions: UnreadSession[];

  searchOpen: boolean;
  searchQuery: string;
  searchResults: SearchResults | null;
  searching: boolean;
}

export const initialState = (): AppState => ({
  route: { type: "home" },
  nodes: [],
  openGroups: new Set(),

  sessions: [],
  sessionsPage: 0,
  sessionsTotalPages: 0,
  sessionsLoading: false,
  activeParent: null,
  activeChildSlug: null,

  post: null,
  messages: [],
  commentsPage: 0,
  commentsTotalPages: 0,
  commentsLoading: false,
  sending: false,
  replyTarget: null,

  user: null,
  unread: null,

  unreadFilter: false,
  unreadSessions: [],
  unreadLoading: false,
  readSessions: [],

  searchOpen: false,
  searchQuery: "",
  searchResults: null,
  searching: false,
});

/** 评论树 → 消息流（引用回复气泡） */
export function flattenComments(items: CommentNode[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const walk = (c: CommentNode, depth: number) => {
    if (c.is_deleted && !c.content) return;
    const parent = c.parent;
    out.push({
      kind: "comment",
      id: c.id,
      author: c.author,
      name: c.author?.username ?? "匿名",
      content: c.content ?? "",
      createdAt: c.created_at,
      floor: c.floor ?? 0,
      quote:
        depth > 0 && parent
          ? {
              name: parent.author?.username ?? "匿名",
              floor: (parent as CommentNode).floor ?? 0,
              content: parent.content ?? "",
              parentId: parent.id,
            }
          : null,
      isSelf: false,
    });
    for (const child of c.children ?? []) walk(child, depth + 1);
  };
  for (const item of items) walk(item, 0);
  return out;
}

/** 组装完整消息流：楼主 + 楼层 + 后记 */
export function buildMessages(post: PostDetail, comments: CommentNode[], selfId: string | null): ChatMessage[] {
  const msgs: ChatMessage[] = [
    {
      kind: "post",
      id: post.id,
      author: post.author,
      name: post.author?.username ?? "楼主",
      content: post.content ?? "",
      createdAt: post.created_at,
      floor: 0,
      quote: null,
      isSelf: !!selfId && post.author?.id === selfId,
    },
    ...flattenComments(comments).map((m) => ({ ...m, isSelf: !!selfId && m.author?.id === selfId })),
  ];
  for (const ps of post.postscripts ?? []) {
    msgs.push({
      kind: "postscript",
      id: `ps-${ps.id}`,
      author: post.author,
      name: post.author?.username ?? "楼主",
      content: `【后记】\n${ps.content}`,
      createdAt: ps.created_at,
      floor: 0,
      quote: null,
      isSelf: !!selfId && post.author?.id === selfId,
    });
  }
  msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return msgs;
}
