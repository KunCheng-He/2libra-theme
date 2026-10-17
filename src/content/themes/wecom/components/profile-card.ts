/** 企微伪装版『个人信息卡片』：点击侧栏头像弹出。
 *  功能对齐原版首页用户卡：等级/经验进度、今日活跃度刻度、未读、金币、
 *  我的帖子、连签、潘多拉盒子（弹窗保持原版）。所有动作均在伪装界面内完成。 */
import type { MyStats, UserInfo } from "../../../../shared/types";
import type { DataApi } from "../../../../shared/types";
import { el, clear, on } from "./el";
import { icon } from "./ui";
import { fallbackAvatar } from "../../../data/format";
import { createPandoraIcon, closePandoraModal } from "./pandora";

export interface ProfileCallbacks {
  onClose(): void;
  /** 查看我的帖子（会话列表切换为我的帖子，伪装不变） */
  onMyPosts(): void;
  /** 未登录时引导 */
  onLogin(): void;
  /** ✍️ 发帖（提示暂不开放） */
  onNewPost(): void;
  /** 🔔 查看未读（会话列表切换为未读消息，打开即标记已读） */
  onBell(): void;
  /** 连签按钮（展示签到概要） */
  onSign(stats: MyStats | null): void;
  toast(msg: string): void;
}

/** 千分位（与原版展示一致） */
function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function renderProfileCard(
  root: ShadowRoot,
  user: UserInfo | null,
  avatarSrc: string,
  data: DataApi,
  cb: ProfileCallbacks,
) {
  root.querySelector(".wc-profile")?.remove();
  closePandoraModal(root);

  if (!user) {
    const card = el("div", { class: "wc-profile" });
    card.append(el("div", { class: "wc-profile-name" }, "未登录"));
    const login = el("button", { class: "wc-btn is-primary", type: "button" }, "去登录");
    on(login, "click", cb.onLogin);
    card.append(login);
    bindOutsideClose(root, card, cb);
    root.append(card);
    return;
  }

  const state: { stats: MyStats } = { stats: { exp: null, coins: 0, active: null, sign: null } };
  const card = el("div", { class: "wc-profile" });

  /* 头部：头像 + 姓名/徽章 + 邮箱 */
  const head = el("div", { class: "wc-profile-head" });

  const meta = el("div", { class: "wc-profile-meta" });
  const nameRow = el("div", { class: "wc-profile-name-row" });
  nameRow.append(el("div", { class: "wc-profile-name" }, user.username));
  const badges = (user.equipped_badges ?? []).slice(0, 3);
  if (badges.length) {
    const bwrap = el("div", { class: "wc-profile-badges" });
    for (const b of badges) {
      const img = document.createElement("img");
      img.src = b.badge.icon_url;
      img.title = b.badge.name;
      img.alt = b.badge.name;
      bwrap.append(img);
    }
    nameRow.append(bwrap);
  }
  meta.append(nameRow);

  if (user.email) {
    meta.append(el("div", { class: "wc-profile-mail" }, user.email));
  }
  head.append(meta);

  const av = document.createElement("img");
  av.className = "wc-profile-avatar";
  av.src = avatarSrc || fallbackAvatar(user.username);
  av.onerror = () => {
    av.onerror = null;
    av.src = fallbackAvatar(user.username);
  };
  head.insertBefore(av, meta);
  card.append(head);

  /* 等级 / 经验（异步填充） */
  const levelBar = el("div", { class: "wc-profile-level" });
  const activeStrip = el("div", { class: "wc-strip" });
  levelBar.append(activeStrip);
  const levelRow = el("div", { class: "wc-profile-level-row" });
  const lvLeft = el("div", { class: "wc-lv-left" }, "Lv.-");
  const lvRight = el("div", { class: "wc-lv-right" }, "- / -");
  levelRow.append(lvLeft, lvRight);
  levelBar.append(levelRow);
  const lvProg = el("i", { class: "wc-lv-progress" });
  levelBar.append(lvProg);
  card.append(levelBar);

  /* 未读 / 金币 行 */
  const statRow = el("div", { class: "wc-profile-stat" });
  const bell = el("button", { class: "wc-pill", type: "button", title: "查看未读消息" });
  bell.append(icon("bell"), "…");
  on(bell, "click", cb.onBell);
  statRow.append(bell);
  statRow.append(el("span", { class: "wc-stat-sep" }, "|"));
  const coinBtn = el("div", { class: "wc-pill is-coin" }, "💰 …");
  statRow.append(coinBtn);
  card.append(statRow);

  /* 动作行：发帖/我的帖子 + 潘多拉 + 连签 */
  const actions = el("div", { class: "wc-profile-actions" });
  const actLeft = el("div", { class: "wc-profile-actions-l" });
  const posts = el("button", { class: "wc-btn is-primary", type: "button" }, "✍️ 发帖");
  on(posts, "click", cb.onNewPost);
  actLeft.append(posts);
  const mine = el("button", { class: "wc-btn", type: "button" }, "我的帖子");
  on(mine, "click", cb.onMyPosts);
  actLeft.append(mine);
  actions.append(actLeft);

  const actRight = el("div", { class: "wc-profile-actions-r" });
  const signBtn = el("button", { class: "wc-btn", type: "button" }, "连签 …");
  on(signBtn, "click", () => cb.onSign(state.stats));
  actRight.append(signBtn);
  actions.append(actRight);
  card.append(actions);

  bindOutsideClose(root, card, cb);
  root.append(card);

  /* ---------- 异步数据填充 ---------- */
  void (async () => {
    const stats = await data.getMyStats();
    if (!card.isConnected) return;
    if (stats) {
      state.stats = { ...state.stats, ...stats };
    }

    /* 等级 / 经验 */
    const exp = state.stats.exp;
    if (exp) {
      clear(lvLeft);
      lvLeft.append(el("span", { class: "wc-lv" }, `Lv.${exp.level}`));
      if (exp.level > 0 && exp.expToNext > 0) {
        lvLeft.append(el("span", { class: "wc-lv-hint" }, `距 Lv.${exp.level + 1} 还差 ${fmt(exp.expToNext)} 经验`));
      }
      lvRight.textContent = `${fmt(exp.currentExp)} / ${fmt(exp.nextLevelExp)}`;
      lvProg.style.width = `${Math.min(100, Math.max(0, exp.progress))}%`;
    }

    /* 今日活跃度档位（顶部刻度 + 当前档进度） */
    const act = state.stats.active;
    clear(activeStrip);
    const marks = act?.marks ?? [10, 30, 60];
    for (const m of marks) {
      const tick = el("i");
      if (act && act.percent >= m) tick.classList.add("is-hit");
      tick.style.left = `${m}%`;
      activeStrip.append(tick);
    }
    if (act && act.percent > 0) {
      activeStrip.append(el("i", { class: "wc-strip-fill", style: `width:${act.percent}%` }));
    }

    /* 未读 / 金币 */
    const unread = await data.getUnreadCount();
    if (!card.isConnected) return;
    clear(bell);
    bell.append(icon("bell"), String(unread ?? 0));
    coinBtn.textContent = `💰 ${fmt(state.stats.coins)}`;

    /* 连签 */
    const sign = state.stats.sign ?? (await data.getSignStats());
    if (!card.isConnected) return;
    if (sign) state.stats.sign = sign;
    signBtn.textContent = `连签 ${fmt(sign?.streak ?? 0)} 天`;

    /* 潘多拉入口（可用时出现，与原站一致：可开盒或质变窗口内） */
    const pandora = await createPandoraIcon({ root, data, toast: cb.toast });
    if (!pandora || !card.isConnected || !actRight.isConnected) return;
    actRight.insertBefore(pandora, signBtn);
  })();
}

/* ---------- 工具 ---------- */

/** 点击卡片外部关闭（捕获监听，卡片卸载后自动移除监听） */
function bindOutsideClose(root: ShadowRoot, card: HTMLElement, cb: ProfileCallbacks): void {
  const close = (e: Event) => {
    if (!card.isConnected) {
      root.removeEventListener("click", close, true);
      return;
    }
    if (!card.contains(e.target as Node)) {
      closeCard();
    }
  };
  const closeCard = () => {
    card.remove();
    closePandoraModal(root);
    root.removeEventListener("click", close, true);
    cb.onClose();
  };
  setTimeout(() => {
    root.addEventListener("click", close, true);
  }, 0);
}

export function removeProfileCard(root: ShadowRoot) {
  root.querySelector(".wc-profile")?.remove();
  closePandoraModal(root);
}
