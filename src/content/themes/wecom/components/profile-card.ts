import type { UserInfo } from "../../../../shared/types";
import { el, clear, on } from "./el";
import { icon } from "./ui";
import { copyText, fallbackAvatar } from "../../../data/format";

export interface ProfileCallbacks {
  onClose(): void;
  onCopy(text: string): void;
  onMyPosts(): void;
  onLogin(): void;
}

export function renderProfileCard(
  root: ShadowRoot,
  user: UserInfo | null,
  avatarSrc: string,
  cb: ProfileCallbacks,
) {
  root.querySelector(".wc-profile")?.remove();
  if (!user) return;

  const card = el("div", { class: "wc-profile" });

  const av = document.createElement("img");
  av.className = "wc-profile-avatar";
  av.src = avatarSrc || fallbackAvatar(user.username);
  av.onerror = () => {
    av.onerror = null;
    av.src = fallbackAvatar(user.username);
  };
  card.append(av, el("div", { class: "wc-profile-name" }, user.username));

  const idRow = el("div", { class: "wc-profile-id", title: "点击复制 ID" });
  idRow.append(icon("doc"), `ID: ${user.id}`);
  on(idRow, "click", async () => {
    const ok = await copyText(user.id);
    cb.onCopy(ok ? user.id : "");
  });
  card.append(idRow);

  const badges = (user.equipped_badges ?? []).slice(0, 8);
  if (badges.length) {
    const bwrap = el("div", { class: "wc-profile-badges" });
    for (const b of badges) {
      const img = document.createElement("img");
      img.src = b.badge.icon_url;
      img.title = b.badge.name;
      bwrap.append(img);
    }
    card.append(bwrap);
  }

  const actions = el("div", { class: "wc-profile-actions" });
  const posts = el("button", { class: "wc-btn is-primary", type: "button" }, "我的帖子");
  on(posts, "click", cb.onMyPosts);
  actions.append(posts);
  card.append(actions);

  // 点击卡片外部关闭
  setTimeout(() => {
    const close = (e: Event) => {
      if (!card.contains(e.target as Node)) {
        card.remove();
        root.removeEventListener("click", close, true);
      }
    };
    root.addEventListener("click", close, true);
  }, 0);

  root.append(card);
}

export function removeProfileCard(root: ShadowRoot) {
  root.querySelector(".wc-profile")?.remove();
}
