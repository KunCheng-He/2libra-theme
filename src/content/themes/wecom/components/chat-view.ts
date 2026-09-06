import type { Author, ChatMessage, PostDetail, ThemeRoute, UserInfo } from "../../../../shared/types";
import type { AppState, ReplyTarget } from "../state";
import { el, clear, on } from "./el";
import { icon } from "./ui";
import { copyText, fallbackAvatar, formatDivider, formatFloorDate, snippet } from "../../../data/format";
import { renderEmojiHtml, renderMarkdown } from "../../../data/markdown";
import { openReactionMenu, openReactionMenuAnchored, renderReactionRow, type ReactionEnv, type ReactionKind } from "./reactions";
import { TIME_DIVIDER_GAP_MIN } from "../../../../shared/constants";

export interface ChatCallbacks {
  avatarUrl(author: Author | null | undefined): string;
  onAvatar(name: string): void;
  onOpenNode(parentSlug: string): void;
  onReply(target: ReplyTarget | null): void;
  onSend(text: string): void;
  onLogin(): void;
  onLoadComments(): void;
  onDecorate(name: string): void;
  onCopy(text: string): void;
  /** 表态环境（官方接口 + 消息行刷新，由主题接线） */
  reaction(): ReactionEnv;
  onOpenUser(name: string): void;
}

const time = (iso: string) => new Date(iso).getTime();

export function renderEmpty(main: HTMLElement) {
  clear(main);
  const d = new Date();
  const week = "日一二三四五六"[d.getDay()];
  main.append(
    watermarkEl(),
    el("div", { class: "wc-empty" },
      (() => { const img = document.createElement("img"); img.className = "wc-empty-logo"; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logoSvg); return img; })(),
      el("div", { class: "wc-empty-title" }, "2Libra 工作台"),
      el("div", { class: "wc-empty-sub" }, `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${week} · 工作与生活平衡社区`),
    ),
  );
}

/** 聊天区斜向平铺水印（伪装氛围） */
export function watermarkEl(): HTMLElement {
  return el("div", { class: "wc-watermark", "aria-hidden": "true" });
}

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#0082ef"/><rect x="10" y="12" width="28" height="19" rx="5" fill="#fff"/><path d="M16.5 31v6l7-6z" fill="#fff"/><circle cx="18.5" cy="21.5" r="1.8" fill="#0082ef"/><circle cx="24" cy="21.5" r="1.8" fill="#0082ef"/><circle cx="29.5" cy="21.5" r="1.8" fill="#0082ef"/></svg>`;

export function renderChatSkeleton(main: HTMLElement) {
  clear(main);
  main.append(
    el("div", { class: "wc-chat-head" }, el("div", { class: "wc-skeleton", style: "height:20px;width:240px;margin:0;" })),
    el("div", { class: "wc-msgs" },
      el("div", { class: "wc-skeleton", style: "height:64px;width:70%;" }),
      el("div", { class: "wc-skeleton", style: "height:44px;width:52%;margin-left:auto;" }),
      el("div", { class: "wc-skeleton", style: "height:52px;width:64%;" }),
    ),
  );
}

export function renderChatHead(head: HTMLElement, post: PostDetail, cb: ChatCallbacks, parentName?: string) {
  clear(head);
  const col = el("div", { class: "wc-chat-head-col" });
  const row1 = el("div", { class: "wc-chat-head-row1" });
  row1.append(el("span", { class: "wc-chat-title", title: post.title }, post.title || "（无标题）"));
  row1.append(el("span", { class: "wc-chat-id" }, post.short_id));
  if (post.node?.name) {
    const chip = el("span", { class: "wc-chat-node" }, post.node.name);
    on(chip, "click", () => post.node && cb.onOpenNode(post.node.parent_slug));
    row1.append(chip);
  }
  col.append(row1);

  const row2 = el("div", { class: "wc-chat-head-row2" });
  const owner = parentName || post.node?.name || "";
  row2.append(
    el("span", { class: "wc-chat-owner" }, `归属于 ${owner} · ${post.comment_count} 条回复`),
  );
  col.append(row2);
  head.append(col);

  const actions = el("div", { class: "wc-chat-actions" });
  for (const [ic, title] of [
    ["phone", "语音通话"],
    ["screen", "屏幕分享"],
    ["dots", "更多"],
    ["translate", "翻译"],
    ["refresh", "刷新"],
    ["share", "转发"],
  ] as const) {
    const b = el("button", { class: "wc-icon-btn", title: `${title}（暂未开放）`, type: "button" });
    b.append(icon(ic));
    on(b, "click", () => cb.onDecorate(title));
    actions.append(b);
  }
  head.append(actions);
}

/** 消息类型 → 表态对象类型（后记无表态） */
export function reactionKindOf(m: ChatMessage): ReactionKind | null {
  return m.kind === "post" ? "post" : m.kind === "comment" ? "comment" : null;
}

/** 回复动作（工具条与右键菜单共用） */
function replyAction(m: ChatMessage, cb: ChatCallbacks) {
  if (m.kind === "comment") {
    const target: ReplyTarget = {
      id: m.id,
      floor: m.floor,
      name: m.name,
      content: m.content,
      // 顶层楼层：parentId=本楼层；嵌套回复：parentId=父楼层（与站点提交链路一致）
      parentId: m.quote ? m.quote.parentId : m.id,
      level: m.quote ? 3 : 0,
      replyCommentId: m.id,
    };
    cb.onReply(target);
  } else {
    cb.onReply(null);
  }
}

export function buildMessageRow(m: ChatMessage, cb: ChatCallbacks, user: UserInfo | null): HTMLElement {
  const kind = reactionKindOf(m);
  const wrap = el("div", { class: `wc-msg${m.isSelf ? " is-self" : ""}` });
  wrap.dataset.mid = m.id;

  const av = document.createElement("img");
  av.className = "wc-avatar";
  av.loading = "lazy";
  av.src = cb.avatarUrl(m.author) || fallbackAvatar(m.name);
  av.onerror = () => {
    av.onerror = null;
    av.src = fallbackAvatar(m.name);
  };
  on(av, "click", () => cb.onAvatar(m.name));
  wrap.append(av);

  const col = el("div", { class: "wc-msg-col" });
  const meta = el("div", { class: "wc-msg-meta" });
  meta.append(
    el("div", { class: "wc-msg-author" }, m.kind === "postscript" ? `${m.name}（后记）` : m.name),
  );
  const floorTxt = m.floor > 0 ? `#${m.floor} ${formatFloorDate(m.createdAt)}` : formatFloorDate(m.createdAt);
  meta.append(el("div", { class: "wc-msg-floor" }, floorTxt));
  col.append(meta);

  const bubble = el("div", { class: "wc-bubble" });
  if (m.quote) {
    const quote = el("div", { class: "wc-quote" });
    quote.append(el("span", { class: "wc-quote-name" }, `${m.quote.name}`));
    const qt = el("span", { class: "wc-quote-text" });
    qt.innerHTML = renderEmojiHtml(snippet(m.quote.content, 120));
    quote.append(qt);
    on(quote, "click", () => cb.onDecorate("定位原楼层"));
    bubble.append(quote);
  }
  const content = el("div", { class: "wc-msg-content" });
  content.innerHTML = renderMarkdown(m.content || "（无内容）", m.emojiMap);
  bindContentLinks(content, cb);
  bubble.append(content);
  col.append(bubble);

  // 表态行（已有表情/打赏/金币池，与原站展示形式一致）
  const rcRow = renderReactionRow(cb.reaction(), m, kind);
  if (rcRow) col.append(rcRow);

  const menuActions = {
    onReply: () => replyAction(m, cb),
    onCopy: async () => {
      await copyText(m.content);
    },
  };

  // 右键气泡 → 表情回复菜单（表情选择条 + 引用回复 + 复制）
  on(bubble, "contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openReactionMenu(cb.reaction(), m, kind, e.clientX, e.clientY, menuActions);
  });

  const tools = el("div", { class: "wc-msg-tools" });
  const emojiTool = el("span", { class: "wc-msg-tool" });
  emojiTool.append(icon("smile"), "表情");
  on(emojiTool, "click", () => {
    openReactionMenuAnchored(cb.reaction(), m, kind, emojiTool.getBoundingClientRect(), menuActions);
  });
  tools.append(emojiTool);
  const reply = el("span", { class: "wc-msg-tool" });
  reply.append(icon("quote"), "引用回复");
  on(reply, "click", () => replyAction(m, cb));
  const copy = el("span", { class: "wc-msg-tool" });
  copy.append(icon("doc"), "复制");
  on(copy, "click", async () => {
    await copyText(m.content);
    void user;
  });
  tools.append(reply, copy);
  col.append(tools);

  wrap.append(col);
  return wrap;
}

function bindContentLinks(scope: HTMLElement, cb: ChatCallbacks) {
  scope.querySelectorAll<HTMLImageElement>("img.wc-md-img").forEach((img) => {
    on(img, "click", () => window.open(img.src, "_blank", "noopener"));
  });
  scope.querySelectorAll<HTMLAnchorElement>("a.wc-md-link").forEach((a) => {
    on(a, "click", (e) => {
      e.preventDefault();
      const href = a.dataset.href ?? a.getAttribute("href") ?? "";
      if (href.startsWith("/")) {
        window.history.pushState({}, "", href);
      } else {
        window.open(href, "_blank", "noopener");
      }
    });
  });
  void cb;
}

export function renderMessages(
  container: HTMLElement,
  state: AppState,
  cb: ChatCallbacks,
) {
  clear(container);
  const msgs = state.messages;

  if (state.commentsLoading && !msgs.length) {
    container.append(el("div", { class: "wc-msgs-state" }, "加载中…"));
    return;
  }
  if (!msgs.length) {
    container.append(el("div", { class: "wc-msgs-state" }, "暂无内容"));
    return;
  }

  let lastT = 0;
  for (const m of msgs) {
    const t = time(m.createdAt);
    if (!lastT || t - lastT > TIME_DIVIDER_GAP_MIN * 60000) {
      container.append(el("div", { class: "wc-divider" }, el("span", null, formatDivider(m.createdAt))));
    }
    lastT = t;
    container.append(buildMessageRow(m, cb, state.user));
  }

  if (state.commentsPage < state.commentsTotalPages) {
    const more = el("div", { class: "wc-msgs-state" });
    if (state.commentsLoading) {
      more.textContent = "加载中…";
    } else {
      const b = el("button", { type: "button" }, "查看更早的回复");
      on(b, "click", cb.onLoadComments);
      more.append(b);
    }
    container.append(more);
  }
}

export function renderComposer(
  container: HTMLElement,
  state: AppState,
  cb: ChatCallbacks,
): HTMLTextAreaElement | null {
  clear(container);

  if (!state.user) {
    const card = el("div", { class: "wc-composer-card" });
    card.append(el("div", { class: "wc-login-hint" }, "登录后即可参与回复"));
    const hint = el("div", { class: "wc-login-hint-row" });
    const b = el("button", { type: "button" }, "去登录");
    on(b, "click", cb.onLogin);
    hint.append(b);
    card.append(hint);
    container.append(card);
    return null;
  }

  const card = el("div", { class: "wc-composer-card" });

  if (state.replyTarget) {
    const bar = el("div", { class: "wc-quote-bar" });
    const label = el("span", { style: "flex:none;color:var(--wc-blue);" }, "引用");
    bar.append(label, el("span", { class: "wc-quote-bar-text" }, `${state.replyTarget.name}：${snippet(state.replyTarget.content, 60)}`));
    const close = el("span", { class: "wc-quote-bar-close", title: "取消引用" });
    close.append(icon("close"));
    on(close, "click", () => cb.onReply(null));
    bar.append(close);
    card.append(bar);
  }

  const tools = el("div", { class: "wc-composer-tools" });
  for (const t of ["smile", "scissors", "image", "folder", "plus"] as const) {
    const b = el("span", { class: "wc-composer-tool", title: "功能开发中" });
    b.append(icon(t));
    on(b, "click", () => cb.onDecorate("该功能暂未开放"));
    tools.append(b);
  }
  card.append(tools);

  const row = el("div", { class: "wc-input-row" });
  const ta = document.createElement("textarea");
  ta.className = "wc-input";
  ta.rows = 1;
  const title = state.post?.title ?? "";
  ta.placeholder = state.replyTarget
    ? `回复 ${state.replyTarget.name}…`
    : title
      ? `发送给 《${title}》`
      : "输入回复，Enter 发送";
  on(ta, "input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  });
  on(ta, "keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const v = ta.value.trim();
      if (v) cb.onSend(v);
    }
  });
  const send = el("button", { class: "wc-send-btn", type: "button" }, "发送");
  const syncSend = () => {
    send.disabled = !ta.value.trim();
  };
  syncSend();
  on(ta, "input", syncSend);
  on(send, "click", () => {
    const v = ta.value.trim();
    if (v) cb.onSend(v);
  });
  row.append(ta, send);
  card.append(row);

  container.append(card);
  return ta;
}

export function scrollMessagesToBottom(container: HTMLElement) {
  container.scrollTop = container.scrollHeight;
}

export function renderRouteByType(main: HTMLElement, route: ThemeRoute, state: AppState, cb: ChatCallbacks) {
  if (route.type === "post" && state.post) {
    clear(main);
    const head = el("div", { class: "wc-chat-head" });
    renderChatHead(head, state.post, cb);
    const msgs = el("div", { class: "wc-msgs" });
    const composer = el("div", { class: "wc-composer" });
    main.append(head, msgs, composer);
    renderMessages(msgs, state, cb);
    const ta = renderComposer(composer, state, cb);
    scrollMessagesToBottom(msgs);
    if (ta && state.replyTarget) ta.focus();
    return { msgs, composer };
  }
  renderEmpty(main);
  return null;
}
