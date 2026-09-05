import type { ThemeContext, ThemePack, ThemeRoute, CommentNode, SiteNotification } from "../../../shared/types";
import { PAGE_SIZE_COMMENTS, PAGE_SIZE_POSTS } from "../../../shared/constants";
import type { ApiError } from "../../data/client";
import { initialState, buildMessages, type AppState, type ReplyTarget, type SearchResults, type UnreadSession } from "./state";
import { renderSidebar } from "./components/sidebar";
import {
  renderSessionHead,
  renderSessions,
  renderTabs,
  renderSearchPanel,
  bindInfiniteScroll,
  type ListCallbacks,
} from "./components/session-list";
import {
  renderChatSkeleton,
  renderEmpty,
  renderComposer,
  renderMessages,
  renderChatHead,
  scrollMessagesToBottom,
  watermarkEl,
  type ChatCallbacks,
} from "./components/chat-view";
import { renderMembersPanel, type MembersCallbacks } from "./components/members-panel";
import { renderNewChat, removeNewChat } from "./components/new-chat";
import { renderProfileCard, removeProfileCard } from "./components/profile-card";
import { toast } from "./components/ui";
import tokensCss from "./tokens.css";
import wecomCss from "./wecom.css";

interface Refs {
  rail: HTMLElement;
  panel: HTMLElement;
  headRow: HTMLElement;
  searchHost: HTMLElement;
  tabs: HTMLElement;
  sessions: HTMLElement;
  main: HTMLElement;
  members: HTMLElement;
  composerHost: HTMLElement | null;
  msgsHost: HTMLElement | null;
}

/** 从通知中提取帖子引用（reply 类走 postShortId，reaction 类走 path） */
function postRefOf(n: SiteNotification): { shortId: string; nodeSlug: string } | null {
  const p = n.payload;
  if (!p) return null;
  if (p.postShortId) return { shortId: p.postShortId, nodeSlug: p.postNodeSlug ?? "" };
  const m = typeof p.path === "string" ? p.path.match(/^\/post\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/) : null;
  return m ? { shortId: m[2], nodeSlug: m[1] } : null;
}

/** reaction 类通知的操作人（relations 内） */
function firstRelationName(p: NonNullable<SiteNotification["payload"]>): string | undefined {
  const rel = p.relations;
  if (Array.isArray(rel)) {
    const first = rel[0] as { username?: unknown } | undefined;
    if (first && typeof first.username === "string") return first.username;
  }
  return undefined;
}

function kindOf(type: string): string {
  switch (type) {
    case "reply":
    case "reply_mention":
    case "mention":
      return "回复";
    case "reaction":
      return "赞了";
    case "favorite":
      return "收藏了";
    case "get_reward":
      return "打赏了";
    case "content_check":
      return "内容检定";
    default:
      return "";
  }
}

/** 站点聚合页的第一段（今日/近期热议等），不是节点 slug，不能按帖子路由处理 */
const AGGREGATE_SEGMENTS = new Set(["hot", "latest", "latest-comments"]);

/** 消息列表只保留帖子会话消息（回复/@我）；点赞、徽章、系统、升级、关注、打赏等通知不进入消息列表 */
const MESSAGE_TYPES = new Set(["reply", "reply_mention", "mention"]);

class WecomTheme implements ThemePack {
  id = "wecom";
  name = "办公 IM 风格";
  version = "0.1.0";

  private ctx: ThemeContext | null = null;
  private state: AppState = initialState();
  private refs: Refs | null = null;
  private sheets: CSSStyleSheet[] = [];
  private searchInput: HTMLInputElement | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanup: (() => void)[] = [];
  private errorStreak = 0;
  private listKey = "";
  private chatSeq = 0;

  /* ---------- 路由解析 ---------- */
  matchRoute(path: string, search: string): ThemeRoute | null {
    if (path === "/" || path === "") return { type: "home" };
    if (path === "/post/create") return { type: "create" };
    if (path === "/search") {
      return { type: "search", query: new URLSearchParams(search).get("q") ?? "" };
    }
    let m = path.match(/^\/post\/([A-Za-z0-9-]+)\/([A-Za-z0-9_-]+)\/?$/);
    if (m && !AGGREGATE_SEGMENTS.has(m[1].toLowerCase())) return { type: "post", postId: m[2] };
    m = path.match(/^\/node\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9-]+))?\/?$/);
    if (m) return { type: "node", parentSlug: m[1], childSlug: m[2] };
    return null;
  }

  /* ---------- 生命周期 ---------- */
  async mount(ctx: ThemeContext): Promise<void> {
    this.ctx = ctx;
    this.state = initialState();
    const root = ctx.root;
    root.innerHTML = "";

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(tokensCss + "\n" + wecomCss);
    root.adoptedStyleSheets = [sheet];
    this.sheets = [sheet];

    const app = document.createElement("div");
    app.className = "wc-app";
    const rail = document.createElement("aside");
    rail.className = "wc-nav";
    const panel = document.createElement("section");
    panel.className = "wc-panel";
    panel.style.position = "relative";
    const headRow = document.createElement("div");
    headRow.className = "wc-panel-head";
    const searchHost = document.createElement("div");
    const tabs = document.createElement("nav");
    tabs.className = "wc-tabs";
    const sessions = document.createElement("div");
    sessions.className = "wc-sessions";
    panel.append(headRow, searchHost, tabs, sessions);
    const main = document.createElement("main");
    main.className = "wc-main";
    const members = document.createElement("aside");
    members.className = "wc-members";
    app.append(rail, panel, main, members);
    root.append(app);

    this.refs = { rail, panel, headRow, searchHost, tabs, sessions, main, members, composerHost: null, msgsHost: null };

    // 基础 UI
    this.renderRail();
    this.searchInput = renderSessionHead(headRow, this.state, this.listCallbacks());
    this.cleanup.push(bindInfiniteScroll(sessions, this.listCallbacks()));
    renderTabs(tabs, this.state, this.listCallbacks());
    renderSessions(sessions, this.state, this.state.route, this.listCallbacks());
    renderEmpty(main);

    // 数据并行加载
    this.loadNodes();
    this.loadUser();
    void this.loadSessions(true);
  }

  async unmount(): Promise<void> {
    const root = this.ctx?.root;
    this.ctx = null;
    this.refs = null;
    this.searchInput = null;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    for (const fn of this.cleanup) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.cleanup = [];
    this.sheets = [];
    if (root) {
      root.innerHTML = "";
      root.adoptedStyleSheets = [];
    }
  }

  onRouteChange(route: ThemeRoute, _url: string): void {
    void _url;
    if (!this.ctx || !this.refs) return;
    this.state.route = route;
    void this.handleRoute(route);
  }

  /* ---------- 内部工具 ---------- */
  private get data() {
    return this.ctx!.data;
  }
  private get router() {
    return this.ctx!.router;
  }

  /** 错误保护：连续失败 3 次回退原版 */
  private guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    return fn().catch((e) => {
      console.warn("[2lt][wecom]", e);
      this.reportError(e);
      return undefined;
    });
  }

  private reportError(e: unknown) {
    this.errorStreak += 1;
    if (this.errorStreak >= 3 && this.ctx) {
      toast(this.ctx.root, "主题渲染异常，已回退原版界面");
      this.ctx.escapeHatch();
    } else if (this.ctx) {
      const msg = (e as ApiError)?.message ?? (e instanceof Error ? e.message : "加载失败");
      toast(this.ctx.root, msg);
    }
  }

  private renderRail() {
    if (!this.refs) return;
    const { user, unread } = this.state;
    renderSidebar(this.refs.rail, user, user ? this.data.avatarUrl(user) : "", unread, {
      onAvatarClick: () => {
        if (!this.ctx) return;
        renderProfileCard(
          this.ctx.root,
          this.state.user,
          this.state.user ? this.data.avatarUrl(this.state.user) : "",
          {
            onClose: () => removeProfileCard(this.ctx!.root),
            onCopy: (ok) => toast(this.ctx!.root, ok ? "已复制 ID" : "复制失败"),
            onMyPosts: () => {
              const u = this.state.user;
              removeProfileCard(this.ctx!.root);
              if (u) this.router.push(`/user/${u.username}/about`);
            },
            onLogin: () => this.router.push("/login"),
          },
        );
      },
      onNavChat: () => void this.toggleUnreadView(),
      onDecorate: (name) => {
        if (!this.ctx) return;
        toast(this.ctx.root, `「${name}」已在工作台打开`);
      },
    });
  }

  private listCallbacks(): ListCallbacks {
    return {
      onOpenPost: (parentSlug, shortId) => this.router.push(`/post/${parentSlug}/${shortId}`),
      onOpenHome: () => this.router.push("/"),
      onOpenNode: (slug) => this.router.push(`/node/${slug}`),
      onNewChat: () => this.router.push("/post/create"),
      onOpenUnread: (s) => void this.openUnread(s),
      onOpenHistoryPost: (s) => this.router.push(`/post/${s.nodeSlug || "forum"}/${s.shortId}`),
      onUnreadChip: () => void this.loadUnreadSessions(),
      onSearchInput: (q) => {
        this.state.searchQuery = q;
        this.state.searchOpen = true;
        if (this.searchTimer) clearTimeout(this.searchTimer);
        if (!q.trim()) {
          this.state.searchResults = null;
          this.state.searching = false;
          this.rerenderSearch();
          return;
        }
        this.state.searching = true;
        this.searchTimer = setTimeout(() => void this.runSearch(q.trim()), 400);
        this.rerenderSearch();
      },
      onSearchFocus: () => {
        this.state.searchOpen = true;
        this.rerenderSearch();
      },
      onSearchEnter: (q) => {
        this.state.searchQuery = q;
        if (q.trim()) void this.runSearch(q.trim());
      },
      onSearchClose: () => {
        this.state.searchOpen = false;
        this.rerenderSearch();
      },
      onSearchResult: (r, kind) => {
        this.state.searchOpen = false;
        this.searchInput?.blur();
        if (kind === "post") {
          const p = r as SearchResults["posts"][number];
          this.router.push(`/post/${p.parent_slug ?? "forum"}/${p.short_id}`);
        } else if (kind === "node") {
          const n = r as SearchResults["nodes"][number];
          this.router.push(`/node/${n.parent_slug ? `${n.parent_slug}/` : ""}${n.slug}`);
        } else {
          const u = r as SearchResults["users"][number];
          this.router.push(`/user/${u.username}/about`);
        }
      },
      onLoadMore: () => void this.loadSessions(false),
      avatarUrl: (author) => this.data.avatarUrl(author),
    };
  }

  private chatCallbacks(): ChatCallbacks {
    return {
      avatarUrl: (author) => this.data.avatarUrl(author),
      onAvatar: (name) => {
        if (this.ctx) toast(this.ctx.root, `${name} 的资料卡即将上线`);
      },
      onOpenNode: (slug) => this.router.push(`/node/${slug}`),
      onReply: (t) => {
        this.state.replyTarget = t;
        this.rerenderComposer();
      },
      onSend: (text) => void this.sendReply(text),
      onLogin: () => this.router.push("/login"),
      onLoadComments: () => void this.loadComments(false),
      onDecorate: (name) => {
        if (this.ctx) toast(this.ctx.root, `「${name}」暂未开放`);
      },
      onCopy: (text) => {
        if (this.ctx) toast(this.ctx.root, text ? "已复制" : "复制失败");
      },
    };
  }

  private membersCb(): MembersCallbacks {
    return {
      avatarUrl: (author) => this.data.avatarUrl(author),
      onPick: (name) => {
        if (this.ctx) toast(this.ctx.root, `${name} 的资料卡即将上线`);
      },
      onDecorate: (name) => {
        if (this.ctx) toast(this.ctx.root, `「${name}」暂未开放`);
      },
    };
  }

  private paintMembers() {
    if (!this.refs) return;
    renderMembersPanel(this.refs.members, this.state.post, this.state.messages, this.membersCb());
  }

  /* ---------- 数据加载 ---------- */
  private async loadNodes() {
    const nodes = await this.guard(() => this.data.getNodeTree());
    if (!nodes || !this.ctx) return;
    this.state.nodes = nodes;
    if (this.refs) renderTabs(this.refs.tabs, this.state, this.listCallbacks());
  }

  private async loadUser() {
    const user = await this.data.getCurrentUser();
    if (!this.ctx) return;
    this.state.user = user;
    this.renderRail();
    if (user) {
      const unread = await this.data.getUnreadCount();
      if (!this.ctx) return;
      this.state.unread = unread;
      this.renderRail();
    }
    // 登录态变化后需要刷新输入框
    this.rerenderComposer();
  }

  private async loadSessions(reset: boolean) {
    if (!this.ctx) return;
    const route = this.state.route;
    const parent = route.type === "node" ? (route.parentSlug ?? null) : null;
    const child = route.type === "node" ? (route.childSlug ?? null) : null;
    const key = `${parent ?? ""}|${child ?? ""}`;
    if (reset) this.listKey = key;

    const page = reset ? 1 : this.state.sessionsPage + 1;
    if (!reset && (this.state.sessionsLoading || page > this.state.sessionsTotalPages)) return;
    this.state.sessionsLoading = true;
    this.paintSessions();

    const r = await this.guard(async () => {
      if (child) {
        let nodeId: string | undefined;
        if (this.state.nodes.length) {
          nodeId = this.state.nodes.find((g) => g.slug === parent)?.children.find((c) => c.slug === child)?.id;
        } else {
          await this.loadNodes();
          nodeId = this.state.nodes.find((g) => g.slug === parent)?.children.find((c) => c.slug === child)?.id;
        }
        return nodeId
          ? await this.data.listByChild(parent ?? "", nodeId, page, PAGE_SIZE_POSTS)
          : await this.data.listLatest(page, PAGE_SIZE_POSTS);
      }
      if (parent) return await this.data.listByParent(parent, page, PAGE_SIZE_POSTS);
      return await this.data.listLatest(page, PAGE_SIZE_POSTS);
    });

    this.state.sessionsLoading = false;
    if (!this.ctx) return;
    if (r) {
      const items = r.posts ?? r.items ?? [];
      this.state.sessions = reset ? items : [...this.state.sessions, ...items];
      this.state.sessionsPage = r.page ?? page;
      this.state.sessionsTotalPages = r.total_pages ?? 0;
    }
    this.paintSessions();
  }

  /* ---------- 未读消息 ---------- */

  /** 点击侧栏「消息」：切换 未读消息视图 / 全部会话 */
  private async toggleUnreadView() {
    if (!this.ctx || !this.refs) return;
    if (this.state.unreadFilter) {
      this.exitUnreadView();
      return;
    }
    if (!this.state.user) {
      toast(this.ctx.root, "请先登录后查看未读消息");
      return;
    }
    this.state.unreadFilter = true;
    this.refreshListUi();
    await this.loadUnreadSessions();
  }

  private exitUnreadView() {
    this.state.unreadFilter = false;
    this.state.unreadSessions = [];
    this.state.readSessions = [];
    this.state.unreadLoading = false;
    this.refreshListUi();
  }

  /** 拉取通知列表，按帖子聚合成未读会话 */
  private async loadUnreadSessions() {
    if (!this.ctx || !this.state.user) return;
    this.state.unreadLoading = true;
    this.paintSessions();

    const list = await this.guard(async () => {
      const all: SiteNotification[] = [];
      const first = await this.data.listNotifications(1);
      all.push(...first.list);
      const max = Math.min(first.total_pages ?? 1, 5);
      for (let p = 2; p <= max; p++) {
        const next = await this.data.listNotifications(p);
        all.push(...next.list);
        if (!next.list.length) break;
      }
      return all;
    });

    this.state.unreadLoading = false;
    if (!this.ctx || !this.state.unreadFilter) return;

    /** 按帖子聚合一组通知（最新一条决定标题/来源/动作）；只统计帖子会话消息 */
    const aggregate = (only: (n: SiteNotification) => boolean) => {
      const map = new Map<string, UnreadSession>();
      for (const n of (list ?? []).filter((x) => x && MESSAGE_TYPES.has(x.type) && only(x))) {
        const ref = postRefOf(n);
        if (!ref) continue;
        const p = n.payload ?? {};
        const who =
          n.from_user?.username ??
          firstRelationName(p) ??
          (typeof p.alias_name === "string" ? p.alias_name : "") ??
          "";
        const author = n.from_user ?? null;
        const cur = map.get(ref.shortId);
        if (cur) {
          cur.unread += 1;
          cur.ids.push(n.id);
          if (new Date(n.created_at).getTime() > new Date(cur.lastAt).getTime()) {
            cur.lastAt = n.created_at;
            cur.from = who;
            cur.author = author;
            cur.kind = kindOf(n.type);
          }
        } else {
          map.set(ref.shortId, {
            shortId: ref.shortId,
            nodeSlug: ref.nodeSlug,
            title: typeof p.postTitle === "string" ? p.postTitle : "",
            from: who,
            author,
            lastAt: n.created_at,
            unread: 1,
            ids: [n.id],
            kind: kindOf(n.type),
          });
        }
      }
      return [...map.values()].sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
    };
    this.state.unreadSessions = aggregate((n) => !n.is_read);
    this.state.readSessions = aggregate((n) => !!n.is_read);
    this.paintSessions();
  }

  /** 点击未读会话：标记该帖全部通知已读（角标同步减少），并打开帖子 */
  private async openUnread(s: UnreadSession) {
    this.state.unreadSessions = this.state.unreadSessions.filter((x) => x.shortId !== s.shortId);
    if (this.state.unreadFilter) this.paintSessions();
    if (s.ids.length) {
      void this.guard(() => this.data.markNotificationsRead(s.ids)).then(() => this.refreshUnreadCount());
    }
    this.router.push(`/post/${s.nodeSlug || "forum"}/${s.shortId}`);
  }

  private async refreshUnreadCount() {
    if (!this.ctx || !this.state.user) return;
    const unread = await this.data.getUnreadCount();
    if (!this.ctx) return;
    this.state.unread = unread;
    this.renderRail();
  }

  private async loadChat(shortId: string) {
    if (!this.refs || !this.ctx) return;
    const seq = ++this.chatSeq; // 竞态守卫：仅最后一次请求允许渲染
    this.state.post = null;
    this.state.messages = [];
    this.state.commentsPage = 0;
    this.state.commentsTotalPages = 0;
    this.state.replyTarget = null;
    renderChatSkeleton(this.refs.main);
    this.paintMembers();
    this.refs.msgsHost = null;
    this.refs.composerHost = null;

    try {
      const post = await this.data.getPost(shortId);
      if (seq !== this.chatSeq) return;
      const comments = await this.data.getComments(shortId, 1, PAGE_SIZE_COMMENTS);
      if (seq !== this.chatSeq || !this.ctx || !this.refs || this.state.route.type !== "post") return;
      this.state.post = post;
      this.state.commentsPage = comments.page ?? 1;
      this.state.commentsTotalPages = comments.total_pages ?? 0;
      this.state.messages = buildMessages(post, comments.items ?? [], this.state.user?.id ?? null);
      this.renderChat();
    } catch (e) {
      if (seq !== this.chatSeq || !this.ctx) return;
      const err = e as ApiError;
      // 聚合页/已删除帖等非帖子路由 → 回退原版（PLAN：未映射路由自动回退）
      if (err?.code === 404 || /不存在|已删除/.test(err?.message ?? "")) {
        console.warn("[2lt][wecom] 非帖子路由，回退原版界面", err?.message);
        this.ctx.escapeHatch();
        return;
      }
      this.reportError(e);
    }
  }

  private async loadComments(reset: boolean) {
    const post = this.state.post;
    if (!post || this.state.commentsLoading) return;
    const seq = this.chatSeq;
    const page = reset ? 1 : this.state.commentsPage + 1;
    if (!reset && page > this.state.commentsTotalPages) return;
    this.state.commentsLoading = true;
    this.paintMessages();

    const r = await this.guard(() => this.data.getComments(post.short_id, page, PAGE_SIZE_COMMENTS));
    this.state.commentsLoading = false;
    // 帖子已切换 → 丢弃过期响应，避免旧帖回复追加到新帖
    if (!r || !this.ctx || seq !== this.chatSeq || this.state.post !== post) return;
    const items = (r.items ?? []) as CommentNode[];
    const fresh = buildMessages(post, items, this.state.user?.id ?? null).filter((m) => m.kind !== "post");
    this.state.messages = reset
      ? [this.state.messages[0], ...fresh].filter(Boolean)
      : [...this.state.messages, ...fresh];
    this.state.commentsPage = r.page ?? page;
    this.state.commentsTotalPages = r.total_pages ?? this.state.commentsTotalPages;
    this.paintMessages();
  }

  private async sendReply(text: string) {
    const post = this.state.post;
    if (!post || !this.ctx || this.state.sending) return;
    if (!this.state.user) {
      this.router.push("/login");
      return;
    }
    const target = this.state.replyTarget;
    const seq = this.chatSeq;
    this.state.sending = true;
    try {
      const created = await this.data.createComment({
        postId: post.id,
        content: text,
        parentId: target?.parentId ?? "",
        level: target?.level ?? 0,
        replyCommentId: target?.replyCommentId ?? "",
      });
      this.state.sending = false;
      this.state.replyTarget = null;
      if (seq !== this.chatSeq || this.state.post !== post) return; // 期间已切换帖子，丢弃本地回显
      const floor = created?.floor ?? post.comment_count + 1;
      this.state.messages.push({
        kind: "comment",
        id: created?.id ?? `tmp-${Date.now()}`,
        author: created?.author ?? this.state.user,
        name: this.state.user.username,
        content: text,
        createdAt: created?.created_at ?? new Date().toISOString(),
        floor,
        quote: target ? { name: target.name, floor: target.floor, content: target.content, parentId: "" } : null,
        isSelf: true,
      });
      post.comment_count += 1;
      this.renderChat();
    } catch (e) {
      this.state.sending = false;
      const err = e as ApiError;
      if (this.ctx) {
        if (err?.needLogin) {
          toast(this.ctx.root, "请先登录后再回复");
        } else {
          toast(this.ctx.root, `回复失败：${err?.message ?? "未知错误"}`);
        }
      }
      this.rerenderComposer();
    }
  }

  private async runSearch(q: string) {
    if (!this.ctx) return;
    this.state.searching = true;
    this.rerenderSearch();
    const raw = await this.guard(() => this.data.search(q));
    if (!this.ctx) return;
    this.state.searching = false;
    if (!raw) {
      this.state.searchResults = { posts: [], users: [], nodes: [] };
    } else {
      const posts = (raw.posts ?? []).map((p) => ({
        short_id: (p.short_id ?? p.id ?? "") as string,
        title: (p.title ?? "") as string,
        parent_slug: (p.node?.parent_slug ?? undefined) as string | undefined,
        node_name: (p.node?.name ?? undefined) as string | undefined,
      }));
      const users = (raw.users ?? []).map((u) => ({
        username: (u.username ?? u.name ?? "") as string,
        avatar_url: (u.avatar_url ?? undefined) as string | undefined,
      }));
      const nodes = (raw.nodes ?? []).map((n) => ({
        slug: (n.slug ?? "") as string,
        name: (n.name ?? "") as string,
        parent_slug: (n.parent_slug ?? undefined) as string | undefined,
      }));
      this.state.searchResults = { posts, users, nodes };
    }
    this.rerenderSearch();
  }

  /* ---------- 路由处理 ---------- */
  private async handleRoute(route: ThemeRoute) {
    if (!this.refs) return;
    this.errorStreak = 0;
    removeNewChat(this.ctx!.root);
    removeProfileCard(this.ctx!.root);

    switch (route.type) {
      case "home": {
        this.state.activeParent = null;
        this.state.activeChildSlug = null;
        this.exitUnreadView();
        this.clearChatState();
        this.refreshListUi();
        renderEmpty(this.refs.main);
        if (this.listKey !== "|") await this.loadSessions(true);
        break;
      }
      case "node": {
        this.state.activeParent = route.parentSlug ?? null;
        this.state.activeChildSlug = route.childSlug ?? null;
        this.exitUnreadView();
        this.clearChatState();
        this.refreshListUi();
        renderEmpty(this.refs.main);
        const key = `${route.parentSlug ?? ""}|${route.childSlug ?? ""}`;
        if (this.listKey !== key) await this.loadSessions(true);
        break;
      }
      case "post": {
        this.refreshListUi();
        if (!this.state.unreadFilter && !this.state.sessions.length && !this.state.sessionsLoading) {
          await this.loadSessions(true);
        }
        await this.loadChat(route.postId!);
        break;
      }
      case "create": {
        this.refreshListUi();
        this.exitUnreadView();
        this.clearChatState();
        if (this.listKey !== "|") await this.loadSessions(true);
        renderEmpty(this.refs.main);
        renderNewChat(this.ctx!.root, this.state.nodes, {
          onClose: () => {
            removeNewChat(this.ctx!.root);
            this.router.push("/");
          },
          onSubmit: (input) => void this.submitPost(input),
        });
        break;
      }
      case "search": {
        this.state.activeParent = null;
        this.exitUnreadView();
        this.clearChatState();
        this.refreshListUi();
        renderEmpty(this.refs.main);
        const q = route.query ?? "";
        this.state.searchOpen = true;
        this.state.searchQuery = q;
        if (this.searchInput) this.searchInput.value = q;
        if (q.trim()) void this.runSearch(q.trim());
        else {
          this.state.searchResults = null;
          this.rerenderSearch();
        }
        if (this.listKey !== "|") await this.loadSessions(true);
        break;
      }
    }
  }

  private async submitPost(input: { title: string; content: string; node_id: string }) {
    if (!this.ctx) return;
    try {
      const post = await this.data.createPost(input);
      removeNewChat(this.ctx.root);
      toast(this.ctx.root, "群聊创建成功");
      const parentSlug = post?.node?.parent_slug ?? "forum";
      if (post?.short_id) this.router.push(`/post/${parentSlug}/${post.short_id}`);
      else this.router.push("/");
    } catch (e) {
      const err = e as ApiError;
      toast(this.ctx.root, `发布失败：${err?.message ?? "未知错误"}`);
      renderNewChat(this.ctx.root, this.state.nodes, {
        onClose: () => {
          removeNewChat(this.ctx!.root);
          this.router.push("/");
        },
        onSubmit: (i) => void this.submitPost(i),
      });
    }
  }

  /* ---------- 渲染 ---------- */
  private clearChatState() {
    this.state.post = null;
    this.state.messages = [];
    this.paintMembers();
  }

  private refreshListUi() {
    if (!this.refs) return;
    renderTabs(this.refs.tabs, this.state, this.listCallbacks());
    this.paintSessions();
  }

  private paintSessions() {
    if (!this.refs) return;
    renderSessions(this.refs.sessions, this.state, this.state.route, this.listCallbacks());
  }

  private renderChat() {
    if (!this.refs || !this.state.post) return;
    const { main } = this.refs;
    const post = this.state.post;
    main.innerHTML = "";

    const head = document.createElement("div");
    head.className = "wc-chat-head";
    const parentName = this.state.nodes.find((g) => g.slug === post.node?.parent_slug)?.name;
    renderChatHead(head, post, this.chatCallbacks(), parentName);

    const msgs = document.createElement("div");
    msgs.className = "wc-msgs";
    const composer = document.createElement("div");
    composer.className = "wc-composer";

    main.append(watermarkEl(), head, msgs, composer);
    this.refs.msgsHost = msgs;
    this.refs.composerHost = composer;

    this.paintMessages();
    this.paintComposer();
    this.paintMembers();
    scrollMessagesToBottom(msgs);
  }

  private paintMessages() {
    if (!this.refs?.msgsHost) return;
    renderMessages(this.refs.msgsHost, this.state, this.chatCallbacks());
    this.paintMembers();
    if (this.state.commentsLoading || this.state.commentsPage >= this.state.commentsTotalPages) {
      scrollMessagesToBottom(this.refs.msgsHost);
    }
  }

  private paintComposer() {
    if (!this.refs?.composerHost) return;
    const ta = renderComposer(this.refs.composerHost, this.state, this.chatCallbacks());
    void ta;
  }

  private rerenderComposer() {
    // 仅在聊天视图存在时重绘输入区
    this.paintComposer();
  }

  private rerenderSearch() {
    if (!this.refs || !this.ctx) return;
    renderSearchPanel(this.refs.searchHost, this.state, this.listCallbacks());
  }
}

export const wecomTheme = new WecomTheme();
