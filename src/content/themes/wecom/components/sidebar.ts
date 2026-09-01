import type { UserInfo } from "../../../../shared/types";
import { el, clear, on } from "./el";
import { icon, type IconName } from "./ui";
import { fallbackAvatar } from "../../../data/format";

export interface SidebarCallbacks {
  onAvatarClick(): void;
  onNavChat(): void;
  onDecorate(name: string): void;
}

interface NavItem {
  key: string;
  label: string;
  ic: IconName;
  dot?: boolean;
}

const NAV_MAIN: NavItem[] = [
  { key: "chat", label: "消息", ic: "chat" },
  { key: "mail", label: "邮件", ic: "mail" },
  { key: "doc", label: "文档", ic: "doc" },
  { key: "calendar", label: "日程", ic: "calendar" },
  { key: "todo", label: "待办", ic: "todo" },
  { key: "meeting", label: "会议", ic: "meeting" },
  { key: "smart-doc", label: "智能文档", ic: "smartDoc", dot: true },
  { key: "summary", label: "智能总结", ic: "summary" },
  { key: "workbench", label: "工作台", ic: "workbench" },
  { key: "contacts", label: "通讯录", ic: "contacts" },
  { key: "drive", label: "微盘", ic: "drive" },
  { key: "advanced", label: "高级功能", ic: "advanced" },
];

const NAV_GROUPS: NavItem[] = [
  { key: "unread", label: "未读", ic: "unread" },
  { key: "mention", label: "@我", ic: "at" },
  { key: "single", label: "单聊", ic: "singleChat" },
  { key: "group", label: "群聊", ic: "groupChat" },
  { key: "internal", label: "内部聊天", ic: "internal" },
  { key: "external", label: "外部聊天", ic: "external" },
  { key: "flag", label: "标记", ic: "flag" },
  { key: "company", label: "我的企业", ic: "building" },
];

export function renderSidebar(
  container: HTMLElement,
  user: UserInfo | null,
  avatarSrc: string,
  unread: number | null,
  cb: SidebarCallbacks,
) {
  clear(container);

  /* 顶部：头像 + 用户名 */
  const me = el("div", { class: "wc-nav-me", title: user?.username ?? "未登录" });
  const av = document.createElement("img");
  av.className = "wc-nav-avatar";
  av.src = avatarSrc || fallbackAvatar(user?.username ?? "?");
  av.onerror = () => {
    av.onerror = null;
    av.src = fallbackAvatar(user?.username ?? "?");
  };
  on(av, "click", cb.onAvatarClick);
  const name = el("span", { class: "wc-nav-me-name", title: user?.username ?? "" }, user?.username ?? "未登录");
  on(name, "click", cb.onAvatarClick);
  me.append(av, name);

  /* 主导航 */
  const nav = el("nav", { class: "wc-nav-list" });
  for (const item of NAV_MAIN) {
    const btn = el("button", {
      class: `wc-nav-item${item.key === "chat" ? " is-active" : ""}`,
      type: "button",
    });
    btn.append(icon(item.ic));
    btn.append(el("span", { class: "wc-nav-label" }, item.label));
    if (item.key === "chat" && unread != null && unread > 0) {
      btn.append(el("span", { class: "wc-nav-badge" }, unread > 99 ? "99+" : String(unread)));
    }
    if (item.dot) btn.append(el("span", { class: "wc-nav-dot" }));
    on(btn, "click", () => {
      if (item.key === "chat") {
        cb.onNavChat();
        return;
      }
      cb.onDecorate(item.label);
    });
    nav.append(btn);
  }

  /* 分组 */
  const wrap = el("div", { class: "wc-nav-groups" });
  wrap.append(el("div", { class: "wc-nav-section" }, "分组"));
  const glist = el("div", { class: "wc-nav-list" });
  for (const item of NAV_GROUPS) {
    const btn = el("button", { class: "wc-nav-item", type: "button" });
    btn.append(icon(item.ic));
    btn.append(el("span", { class: "wc-nav-label" }, item.label));
    if (item.key === "unread" && unread != null && unread > 0) {
      btn.append(el("span", { class: "wc-nav-count" }, unread > 99 ? "99+" : String(unread)));
    }
    on(btn, "click", () => cb.onDecorate(item.label));
    glist.append(btn);
  }
  wrap.append(glist);

  container.append(me, nav, wrap);
  return { avatarImg: av };
}
