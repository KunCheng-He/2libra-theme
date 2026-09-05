import type { Author, PostSummary, ThemeRoute } from "../../../../shared/types";
import type { AppState, SearchResults, UnreadSession } from "../state";
import { el, clear, on } from "./el";
import { icon, nodeColor } from "./ui";
import { formatListTime } from "../../../data/format";

export interface ListCallbacks {
  onOpenPost(parentSlug: string, shortId: string): void;
  onOpenHome(): void;
  onOpenNode(parentSlug: string): void;
  onNewChat(): void;
  onOpenUnread(s: UnreadSession): void;
  /** 历史消息（已读通知聚合）会话点击：仅打开帖子 */
  onOpenHistoryPost(s: UnreadSession): void;
  onUnreadChip(): void;
  onSearchInput(q: string): void;
  onSearchFocus(): void;
  onSearchEnter(q: string): void;
  onSearchClose(): void;
  onSearchResult(r: SearchResults["posts" | "users" | "nodes"][number], kind: "post" | "user" | "node"): void;
  onLoadMore(): void;
  avatarUrl(author: Author | null | undefined): string;
}

function nodeAvatarEl(name: string, slug: string, size = 40): HTMLElement {
  const d = el("div", {
    class: "wc-avatar",
    style: `width:${size}px;height:${size}px;border-radius:${size >= 40 ? 8 : 6}px;background:${nodeColor(slug)};color:#fff;font-size:${Math.round(size * 0.42)}px;font-weight:600;display:flex;align-items:center;justify-content:center;`,
  }, (name?.trim()?.[0] ?? "#").toUpperCase());
  return d;
}

/** 会话头像：群主（帖子作者）头像，加载失败回退节点字符头像 */
function ownerAvatarEl(cb: ListCallbacks, post: PostSummary): HTMLElement {
  const src = cb.avatarUrl(post.author);
  if (!src) return nodeAvatarEl(post.node.name, post.node.slug);
  const img = el("img", {
    class: "wc-avatar",
    src,
    alt: post.author?.username ?? "",
    loading: "lazy",
    style: "width:40px;height:40px;",
  });
  on(img, "error", () => img.replaceWith(nodeAvatarEl(post.node.name, post.node.slug)));
  return img;
}

/* ---------- 节点 Tab（溢出自动折叠） ---------- */

interface TabsRuntime {
  ro?: ResizeObserver;
  onDoc?: (e: Event) => void;
  raf?: number;
}
const tabsRuntime = new WeakMap<HTMLElement, TabsRuntime>();

export function renderTabs(container: HTMLElement, state: AppState, cb: ListCallbacks) {
  const rt = tabsRuntime.get(container);
  if (rt) {
    if (rt.ro) rt.ro.disconnect();
    if (rt.onDoc) container.ownerDocument.removeEventListener("click", rt.onDoc, true);
    if (rt.raf) cancelAnimationFrame(rt.raf);
  }

  clear(container);

  const scroll = el("div", { class: "wc-tabs-scroll" });
  const moreWrap = el("div", { class: "wc-tabs-more" });
  const moreBtn = el("button", { class: "wc-tab wc-tabs-more-btn", type: "button", title: "更多节点" });
  moreBtn.append(icon("chevronDown"));
  const flyout = el("div", { class: "wc-tabs-flyout" });
  moreWrap.append(moreBtn, flyout);

  const mk = (label: string, active: boolean, onClick: () => void) =>
    el("button", { class: `wc-tab${active ? " is-active" : ""}`, type: "button", onClick }, label);

  const visible: HTMLButtonElement[] = [];
  if (state.unreadFilter) {
    const n = state.unreadSessions.reduce((acc, s) => acc + s.unread, 0);
    const chip = mk(`未读消息${n ? ` ${n}` : ""}`, true, () => cb.onUnreadChip());
    chip.title = "点击刷新未读消息";
    visible.push(chip);
  }
  visible.push(mk("全部", !state.activeParent && !state.unreadFilter, () => cb.onOpenHome()));
  for (const g of state.nodes) {
    visible.push(mk(g.name, state.activeParent === g.slug, () => cb.onOpenNode(g.slug)));
  }
  const hidden: HTMLButtonElement[] = [];
  scroll.append(...visible);
  container.append(scroll, moreWrap);

  const isOpen = () => flyout.classList.contains("is-open");
  const setOpen = (open: boolean) => {
    flyout.classList.toggle("is-open", open);
    moreBtn.classList.toggle("is-open", open);
    const cur = tabsRuntime.get(container);
    if (cur?.onDoc) {
      container.ownerDocument.removeEventListener("click", cur.onDoc, true);
      cur.onDoc = undefined;
    }
    if (open) {
      const onDoc = (e: Event) => {
        if (!moreWrap.contains(e.target as Node)) setOpen(false);
      };
      container.ownerDocument.addEventListener("click", onDoc, true);
      const cur2 = tabsRuntime.get(container);
      if (cur2) cur2.onDoc = onDoc;
    }
  };
  on(moreBtn, "click", () => setOpen(!isOpen()));

  // 放不下的标签收进折叠面板；活动标签被收起时高亮折叠按钮
  const fit = () => {
    visible.push(...hidden.splice(0, hidden.length));
    scroll.append(...visible);
    moreWrap.style.display = "";
    while (scroll.scrollWidth > scroll.clientWidth && visible.length > 1) {
      // 优先收起非激活标签，保证选中节点始终可见（选中的不应被"全部"顶掉）
      let idx = -1;
      for (let i = visible.length - 1; i >= 0; i--) {
        if (!visible[i].classList.contains("is-active")) {
          idx = i;
          break;
        }
      }
      if (idx < 0) break;
      hidden.unshift(visible.splice(idx, 1)[0]);
    }
    if (hidden.length) {
      flyout.append(...hidden);
      moreBtn.classList.toggle("is-active", hidden.some((t) => t.classList.contains("is-active")));
    } else {
      moreWrap.style.display = "none";
      moreBtn.classList.remove("is-active");
      if (isOpen()) setOpen(false);
    }
  };

  fit();
  const raf = requestAnimationFrame(fit);
  const ro = new ResizeObserver(() => fit());
  ro.observe(container);
  tabsRuntime.set(container, { ro, raf });
}

export function renderSessions(
  container: HTMLElement,
  state: AppState,
  route: ThemeRoute,
  cb: ListCallbacks,
) {
  if (state.unreadFilter) return renderUnreadSessions(container, state, cb);
  return renderLatestSessions(container, state, route, cb);
}

/** 未读消息视图：只展示有未读通知的帖子；无未读时回退展示历史消息（已读通知聚合） */
function renderUnreadSessions(container: HTMLElement, state: AppState, cb: ListCallbacks) {
  if (state.unreadLoading && state.unreadSessions.length === 0 && state.readSessions.length === 0) {
    clear(container);
    for (let i = 0; i < 6; i++) container.append(el("div", { class: "wc-skeleton" }));
    return;
  }

  clear(container);
  if (!state.unreadSessions.length) {
    container.append(el("div", { class: "wc-list-state" }, "暂无未读消息"));
    for (const s of state.readSessions) container.append(unreadSessionItem(cb, s, true));
    return;
  }

  for (const s of state.unreadSessions) container.append(unreadSessionItem(cb, s, false));
}

/** 未读/历史会话项：history=true 时无红点角标，点击不触发已读标记 */
function unreadSessionItem(cb: ListCallbacks, s: UnreadSession, history: boolean): HTMLElement {
  const item = el("div", { class: "wc-session" });
  item.append(unreadAvatarEl(cb, s));

  const main = el("div", { class: "wc-session-main" });
  main.append(el("div", { class: "wc-session-title" }, s.title || "（无标题）"));
  main.append(el("div", { class: "wc-session-sub" }, `[${s.unread}条] ${s.from || "有人"}${s.kind ? ` ${s.kind}` : " 回复"}`));
  item.append(main);

  const side = el("div", { class: "wc-session-side" });
  side.append(el("span", { class: "wc-session-time" }, formatListTime(s.lastAt)));
  if (!history && s.unread > 0) {
    side.append(el("span", { class: "wc-session-badge" }, s.unread > 99 ? "99+" : String(s.unread)));
  }
  item.append(side);

  on(item, "click", () => (history ? cb.onOpenHistoryPost(s) : cb.onOpenUnread(s)));
  return item;
}

/** 未读会话头像：最新回复者头像，失败/匿名回退节点字符头像 */
function unreadAvatarEl(cb: ListCallbacks, s: UnreadSession): HTMLElement {
  const src = s.author ? cb.avatarUrl(s.author) : "";
  if (!src) return nodeAvatarEl(s.title?.trim()?.[0] ?? "#", s.nodeSlug || "post");
  const img = el("img", {
    class: "wc-avatar",
    src,
    alt: s.from,
    loading: "lazy",
    style: "width:40px;height:40px;",
  });
  on(img, "error", () => img.replaceWith(nodeAvatarEl(s.title?.trim()?.[0] ?? "#", s.nodeSlug || "post")));
  return img;
}

function renderLatestSessions(
  container: HTMLElement,
  state: AppState,
  route: ThemeRoute,
  cb: ListCallbacks,
) {
  if (state.sessionsLoading && state.sessions.length === 0) {
    clear(container);
    for (let i = 0; i < 6; i++) container.append(el("div", { class: "wc-skeleton" }));
    return;
  }

  const hadScroll = container.scrollTop > 0;
  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
  clear(container);

  if (!state.sessions.length) {
    container.append(el("div", { class: "wc-list-state" }, "暂无会话"));
    return;
  }

  appendLatestItems(container, state, route, cb);

  // 保持阅读位置：内容替换后若原本在底部附近则滚回去
  if (hadScroll && nearBottom) container.scrollTop = container.scrollHeight;
}

/** 渲染历史会话项 + 分页（供最新会话视图与未读视图的空态回退共用） */
function appendLatestItems(
  container: HTMLElement,
  state: AppState,
  route: ThemeRoute,
  cb: ListCallbacks,
) {
  for (const post of state.sessions) {
    const item = el("div", {
      class: `wc-session${route.type === "post" && route.postId === post.short_id ? " is-active" : ""}`,
    });
    item.append(ownerAvatarEl(cb, post));

    const main = el("div", { class: "wc-session-main" });
    main.append(el("div", { class: "wc-session-title" }, post.title || "（无标题）"));
    const last = post.last_commented_by?.username;
    const who = last ?? post.author?.username ?? "";
    const act = last ? "" : " 发布";
    main.append(el("div", { class: "wc-session-sub" }, `[${post.comment_count}条] ${who}${act}`));
    item.append(main);

    const side = el("div", { class: "wc-session-side" });
    side.append(el("span", { class: "wc-session-time" }, formatListTime(post.latest_commented_at ?? post.created_at)));
    item.append(side);

    on(item, "click", () => cb.onOpenPost(post.node.parent_slug, post.short_id));
    container.append(item);
  }

  // 分页
  if (state.sessionsPage < state.sessionsTotalPages) {
    const more = el("div", { class: "wc-list-state" });
    if (state.sessionsLoading) {
      more.textContent = "加载中…";
    } else {
      const b = el("button", { type: "button" }, "加载更多");
      on(b, "click", () => cb.onLoadMore());
      more.append(b);
    }
    container.append(more);
  }
}

export function bindInfiniteScroll(container: HTMLElement, cb: ListCallbacks): () => void {
  // 每次触底只加载一页：触发后进入冷却，用户向上滚动后重新武装。
  // 否则渲染后的自动回滚（保持阅读位置）会再次触发 scroll → 连环加载到底。
  let lastTop = container.scrollTop;
  let lastHeight = container.scrollHeight;
  let armed = true;
  const handler = () => {
    const top = container.scrollTop;
    const height = container.scrollHeight;
    if (top < lastTop - 4) armed = true;
    if (height < lastHeight) armed = true; // 列表被替换（切节点/刷新）后重新武装
    lastTop = top;
    lastHeight = height;
    if (!armed) return;
    if (container.scrollHeight - top - container.clientHeight < 120) {
      armed = false;
      cb.onLoadMore();
    }
  };
  container.addEventListener("scroll", handler, { passive: true });
  return () => container.removeEventListener("scroll", handler);
}

/* ---------- 搜索面板 ---------- */

export function renderSearchPanel(
  container: HTMLElement,
  state: AppState,
  cb: ListCallbacks,
) {
  clear(container);
  if (!state.searchOpen) return;

  const panel = el("div", { class: "wc-search-panel" });
  const q = state.searchQuery.trim();

  if (!q) {
    panel.append(el("div", { class: "wc-sp-empty" }, "搜索帖子、节点、用户"));
    container.append(panel);
    return;
  }

  if (state.searching && !state.searchResults) {
    panel.append(el("div", { class: "wc-sp-empty" }, "搜索中…"));
    container.append(panel);
    return;
  }

  const r = state.searchResults;
  if (!r || (!r.posts.length && !r.users.length && !r.nodes.length)) {
    panel.append(el("div", { class: "wc-sp-empty" }, `未找到与「${q}」相关的内容`));
    container.append(panel);
    return;
  }

  if (r.posts.length) {
    panel.append(el("div", { class: "wc-sp-section" }, "帖子"));
    for (const p of r.posts.slice(0, 8)) {
      const item = el("div", { class: "wc-sp-item" });
      item.append(nodeAvatarEl(p.node_name ?? "帖", p.parent_slug ?? "post", 30));
      const main = el("div", { class: "wc-sp-main" });
      main.append(el("div", { class: "wc-sp-title" }, p.title ?? "（无标题）"));
      main.append(el("div", { class: "wc-sp-sub" }, p.node_name ?? ""));
      item.append(main);
      on(item, "click", () => cb.onSearchResult(p, "post"));
      panel.append(item);
    }
  }
  if (r.nodes.length) {
    panel.append(el("div", { class: "wc-sp-section" }, "节点"));
    for (const n of r.nodes.slice(0, 6)) {
      const item = el("div", { class: "wc-sp-item" });
      item.append(nodeAvatarEl(n.name ?? "节", n.slug ?? "node", 30));
      const main = el("div", { class: "wc-sp-main" });
      main.append(el("div", { class: "wc-sp-title" }, n.name ?? ""));
      main.append(el("div", { class: "wc-sp-sub" }, `节点 · ${n.parent_slug ?? ""}`));
      item.append(main);
      on(item, "click", () => cb.onSearchResult(n, "node"));
      panel.append(item);
    }
  }
  if (r.users.length) {
    panel.append(el("div", { class: "wc-sp-section" }, "用户"));
    for (const u of r.users.slice(0, 6)) {
      const item = el("div", { class: "wc-sp-item" });
      const ic = el("div", { class: "wc-sp-ic", style: "background:#7B8CA6;" });
      ic.append(icon("contacts"));
      item.append(ic);
      const main = el("div", { class: "wc-sp-main" });
      main.append(el("div", { class: "wc-sp-title" }, u.username ?? ""));
      main.append(el("div", { class: "wc-sp-sub" }, "用户"));
      item.append(main);
      on(item, "click", () => cb.onSearchResult(u, "user"));
      panel.append(item);
    }
  }

  container.append(panel);
}

export function renderSessionHead(
  container: HTMLElement,
  state: AppState,
  cb: ListCallbacks,
): HTMLInputElement {
  clear(container);

  const box = el("div", { class: "wc-searchbox" });
  box.append(icon("search"));
  const input = document.createElement("input");
  input.placeholder = "搜索";
  input.value = state.searchQuery;
  input.spellcheck = false;
  box.append(input);
  on(input, "input", () => cb.onSearchInput(input.value));
  on(input, "focus", () => cb.onSearchFocus());
  on(input, "blur", () => setTimeout(() => cb.onSearchClose(), 180));
  on(input, "keydown", (e) => {
    if (e.key === "Enter") cb.onSearchEnter(input.value);
    if (e.key === "Escape") input.blur();
  });

  const plus = el("button", { class: "wc-plus-btn", title: "发起群聊", type: "button" });
  plus.append(icon("plus"));
  on(plus, "click", cb.onNewChat);

  container.append(box, plus);
  return input;
}
