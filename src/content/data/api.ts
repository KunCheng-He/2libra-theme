import type {
  Author,
  CommentNode,
  CreateCommentInput,
  CreatePostInput,
  DataApi,
  NodeGroup,
  NotificationPage,
  Paged,
  PostDetail,
  PostSummary,
  SiteNotification,
  UserInfo,
} from "../../shared/types";
import { PAGE_SIZE_COMMENTS, PAGE_SIZE_POSTS, R2_ORIGIN } from "../../shared/constants";
import { ApiError, get, post } from "./client";
import { md5Hex } from "./md5";

function emptyPaged<T>(): Paged<T> {
  return { total: 0, page: 1, limit: 0, total_pages: 0 };
}

function pickItems<T>(d: Paged<T> | null | undefined): Paged<T> {
  if (!d) return emptyPaged<T>();
  return {
    total: d.total ?? 0,
    page: d.page ?? 1,
    limit: d.limit ?? 0,
    total_pages: d.total_pages ?? 0,
    posts: d.posts,
    items: d.items,
  };
}

export const dataApi: DataApi = {
  async getNodeTree(): Promise<NodeGroup[]> {
    const d = await get<NodeGroup[]>("/api/nodes");
    return Array.isArray(d) ? d : [];
  },

  async listLatest(page, limit = PAGE_SIZE_POSTS): Promise<Paged<PostSummary>> {
    const d = await get<Paged<PostSummary>>(`/api/posts/latest/list?page=${page}&limit=${limit}`);
    return pickItems(d);
  },

  async listByParent(parentSlug, page, limit = PAGE_SIZE_POSTS): Promise<Paged<PostSummary>> {
    const d = await get<Paged<PostSummary>>(
      `/api/posts/list?page=${page}&limit=${limit}&parent_slug=${encodeURIComponent(parentSlug)}`,
    );
    return pickItems(d);
  },

  async listByChild(nodeId, page, limit = PAGE_SIZE_POSTS): Promise<Paged<PostSummary>> {
    const d = await get<Paged<PostSummary>>(
      `/api/posts/list?page=${page}&limit=${limit}&node_id=${encodeURIComponent(nodeId)}`,
    );
    return pickItems(d);
  },

  async getPost(shortId: string): Promise<PostDetail> {
    const d = await get<PostDetail>(`/api/posts/${encodeURIComponent(shortId)}`);
    if (!d || !d.id) throw new ApiError(-1, "帖子不存在或已删除");
    return d;
  },

  async getComments(shortId, page, limit = PAGE_SIZE_COMMENTS): Promise<Paged<CommentNode>> {
    const d = await get<Paged<CommentNode>>(
      `/api/comments/list?post_short_id=${encodeURIComponent(shortId)}&page=${page}&limit=${limit}`,
    );
    return pickItems(d);
  },

  async createComment(input: CreateCommentInput): Promise<CommentNode> {
    const body = {
      postId: input.postId,
      content: input.content,
      parentId: input.parentId ?? "",
      level: input.level ?? 0,
      replyCommentId: input.replyCommentId ?? "",
      is_anonymous: false,
      useFlatComment: false,
    };
    return post<CommentNode>("/api/comments", body);
  },

  async createPost(input: CreatePostInput): Promise<PostDetail> {
    return post<PostDetail>("/api/posts", {
      title: input.title,
      content: input.content,
      node_id: input.node_id,
    });
  },

  async search(q) {
    const d = await get<unknown>(`/api/search?q=${encodeURIComponent(q)}`);
    if (d == null) return null;
    const asArray = (v: unknown): Record<string, unknown>[] | null =>
      Array.isArray(v) ? (v as Record<string, unknown>[]) : null;
    let posts = asArray((d as Record<string, unknown>).posts);
    let users = asArray((d as Record<string, unknown>).users);
    let nodes = asArray((d as Record<string, unknown>).nodes);
    // 容错：结果可能直接是数组
    if (!posts && !users && !nodes) {
      const all = asArray(d);
      if (all) posts = all;
    }
    if (!posts && !users && !nodes) return null;
    return {
      posts: (posts ?? undefined) as never,
      users: (users ?? undefined) as never,
      nodes: (nodes ?? undefined) as never,
    };
  },

  async getCurrentUser(): Promise<UserInfo | null> {
    try {
      const d = await get<UserInfo>("/api/users/info");
      return d && d.id ? d : null;
    } catch {
      return null;
    }
  },

  async getUnreadCount(): Promise<number | null> {
    try {
      const d = await get<unknown>("/api/notifications/unread-count");
      if (typeof d === "number") return d;
      const obj = d as Record<string, unknown> | null;
      if (obj && typeof obj === "object") {
        for (const k of ["unread_count", "count", "total"]) {
          if (typeof obj[k] === "number") return obj[k];
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async listNotifications(page: number, type?: string): Promise<NotificationPage> {
    const t = type ? `&type=${encodeURIComponent(type)}` : "";
    const d = await get<Partial<NotificationPage> | SiteNotification[] | null>(`/api/notifications/list?page=${page}${t}`);
    const raw: SiteNotification[] = Array.isArray(d) ? d : (d?.list ?? []);
    return {
      list: raw,
      total: (Array.isArray(d) ? raw.length : d?.total) ?? raw.length,
      page: (Array.isArray(d) ? page : d?.page) ?? page,
      limit: (Array.isArray(d) ? 0 : d?.limit) ?? 0,
      total_pages: (Array.isArray(d) ? (raw.length ? page : 1) : d?.total_pages) ?? (raw.length ? page : 1),
    };
  },

  async markNotificationsRead(ids: string[]): Promise<unknown> {
    if (!ids.length) return null;
    return post<unknown>("/api/notifications/mark-as-read", { id: ids });
  },

  avatarUrl(author, alias = false): string {
    if (!author || !author.id) return "";
    const raw = author.avatar_url ?? "";
    const [ext, t] = raw.split("_");
    if (!ext) return "";
    const h = md5Hex(author.id);
    const bucket = `${h.slice(0, 4)}/${h.slice(4, 8)}`;
    return `${R2_ORIGIN}/${alias ? "avatars/aliases" : "avatars"}/${bucket}/${author.id}.${ext}?t=${t || ""}`;
  },
};
