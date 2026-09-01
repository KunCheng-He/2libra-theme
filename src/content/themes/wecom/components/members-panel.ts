import type { Author, ChatMessage, PostDetail } from "../../../../shared/types";
import { el, clear, on } from "./el";
import { icon } from "./ui";
import { fallbackAvatar } from "../../../data/format";

export interface MembersCallbacks {
  avatarUrl(author: Author | null | undefined): string;
  onPick(name: string): void;
  onDecorate(name: string): void;
}

/** 从消息流提取参与者（保持首次出现顺序，楼主置顶） */
function participants(post: PostDetail, messages: ChatMessage[]): { owner: Author; members: Author[] } {
  const seen = new Set<string>();
  const owner = post.author;
  if (owner?.id) seen.add(owner.id);
  const members: Author[] = [];
  for (const m of messages) {
    const a = m.author;
    if (!a?.id || seen.has(a.id)) continue;
    seen.add(a.id);
    members.push(a);
  }
  return { owner, members };
}

function rowEl(a: Author, cb: MembersCallbacks, tag?: string): HTMLElement {
  const row = el("div", { class: "wc-mb-row", title: a.username });
  const img = document.createElement("img");
  img.className = "wc-mb-avatar";
  img.loading = "lazy";
  img.src = cb.avatarUrl(a) || fallbackAvatar(a.username);
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackAvatar(a.username);
  };
  row.append(img, el("span", { class: "wc-mb-name" }, a.username));
  if (tag) row.append(el("span", { class: "wc-mb-tag" }, tag));
  on(row, "click", () => cb.onPick(a.username));
  return row;
}

export function renderMembersPanel(
  container: HTMLElement,
  post: PostDetail | null,
  messages: ChatMessage[],
  cb: MembersCallbacks,
) {
  clear(container);
  container.classList.toggle("is-empty", !post);
  if (!post) return;

  /* 面板头 */
  const head = el("div", { class: "wc-mb-head" });
  const { owner, members } = participants(post, messages);
  head.append(
    el("span", { class: "wc-mb-title" }, "群成员"),
    el("span", { class: "wc-mb-count" }, `·${members.length + 1}`),
  );
  const headActions = el("span", { class: "wc-mb-head-actions" });
  for (const [ic, title] of [
    ["mail", "群邮件"],
    ["dots", "更多"],
  ] as const) {
    const b = el("button", { class: "wc-mb-ic", title, type: "button" });
    b.append(icon(ic));
    on(b, "click", () => cb.onDecorate(title));
    headActions.append(b);
  }
  head.append(headActions);
  container.append(head);

  const scroll = el("div", { class: "wc-mb-scroll" });

  /* 群主/管理员 = 楼主 */
  scroll.append(el("div", { class: "wc-mb-section is-owner" }, "群主/管理员"));
  scroll.append(rowEl(owner, cb, "群主"));

  /* 群成员 = 回复者 */
  if (members.length) {
    scroll.append(el("div", { class: "wc-mb-section" }, "群成员"));
    for (const a of members) scroll.append(rowEl(a, cb));
  }

  container.append(scroll);
}
