/** 表情表态 / 打赏（调用 2libra 官方接口，金币扣用与站点前端一致） */
import type {
  Author,
  ChatMessage,
  DataApi,
  PostDetail,
  UserInfo,
} from "../../../../shared/types";
import { REACTION_COST, REWARD_LIMITS } from "../../../../shared/constants";
import { ApiError } from "../../../data/client";
import { fallbackAvatar } from "../../../data/format";
import { el, on } from "./el";
import { toast } from "./ui";

export type ReactionKind = "post" | "comment";

export interface ReactionEnv {
  root: ShadowRoot;
  dataApi: DataApi;
  post: PostDetail;
  user: UserInfo | null;
  avatarUrl(author: Author | null | undefined): string;
  /** 数据变更后刷新该消息行 */
  refreshMessage(id: string): void;
  onOpenUser(name: string): void;
}

export function reactionPathOf(post: PostDetail): string {
  return `/post/${post.node?.slug ?? "_"}/${post.short_id}`;
}

/** 站点 COIN_COST 展示逻辑：特殊表情表态他人内容时扣得更多且对方得金币 */
function costOf(kind: ReactionKind, emoji: string, recUserId: string, myId: string | undefined) {
  const special = (REACTION_COST.canGetCoinEmojis as readonly string[]).includes(emoji);
  const base = special
    ? kind === "post"
      ? REACTION_COST.specialPost
      : REACTION_COST.specialComment
    : kind === "post"
      ? REACTION_COST.post
      : REACTION_COST.comment;
  const mine = !!myId && recUserId === myId;
  return { text: `${base.send} 金币${special && !mine ? `，@作者 +${base.get} 金币` : ""}`, send: base.send };
}

/** 站点 rewards 可打赏条件（ec）：非自己内容、非自己的别名、未打赏过、非匿名帖 */
function canReward(env: ReactionEnv, m: ChatMessage): boolean {
  if (!env.user || env.post.is_anonymous_author) return false;
  if (m.author?.id && m.author.id === env.user.id) return false;
  if (m.aliasId && m.aliasId === selectedAliasId()) return false;
  if (m.rewards.some((r) => r.user?.id === env.user!.id)) return false;
  return true;
}

/** 站点前端用 localStorage["selected-alias"] 记录当前别名，用于阻止给自己别名打赏 */
function selectedAliasId(): string | null {
  try {
    return localStorage.getItem("selected-alias") || null;
  } catch {
    return null;
  }
}

/* ============ 表态（乐观更新 + 失败回滚，官方接口） ============ */

export async function toggleReaction(env: ReactionEnv, m: ChatMessage, kind: ReactionKind, emoji: string) {
  if (!env.user) {
    toast(env.root, "请先登录后再表态");
    return;
  }
  if (env.post.is_anonymous_author) {
    toast(env.root, "匿名贴发布者不能对匿名贴发布表情");
    return;
  }
  if ((m.myReactions ?? []).includes(emoji)) return; // 站点行为：已表态不可重复/撤销

  const snapReactions = (m.reactions ?? []).map((r) => ({ ...r }));
  const snapMine = [...(m.myReactions ?? [])];
  const idx = m.reactions.findIndex((r) => r.emoji === emoji);
  if (idx >= 0) m.reactions[idx] = { ...m.reactions[idx], count: m.reactions[idx].count + 1 };
  else m.reactions = [...m.reactions, { emoji, count: 1 }];
  m.myReactions = [...m.myReactions, emoji];
  env.refreshMessage(m.id);

  const cost = costOf(kind, emoji, m.author?.id ?? "", env.user.id);
  try {
    const res =
      kind === "post"
        ? await env.dataApi.togglePostReaction({
            postId: env.post.id,
            emoji,
            recUserId: m.author?.id ?? "",
            path: reactionPathOf(env.post),
            postTitle: env.post.title ?? "",
            nodeId: env.post.node?.id ?? "",
          })
        : await env.dataApi.toggleCommentReaction({
            commentId: m.id,
            emoji,
            recUserId: m.author?.id ?? "",
            path: reactionPathOf(env.post),
            comment: (m.content ?? "").slice(0, 100),
            locatedFloor: m.locatedFloor ?? 0,
            nodeId: env.post.node?.id ?? "",
          });
    if (!res || !res.type) throw new ApiError(0, "表态失败");
    // 同步 post 数据源，保证翻页重载一致
    if (kind === "post") {
      env.post.reactions_summary = m.reactions;
      env.post.my_reactions = m.myReactions;
    }
    toast(env.root, `已回复表情 · 消耗 ${Math.abs(cost.send)} 金币`);
  } catch (e) {
    m.reactions = snapReactions;
    m.myReactions = snapMine;
    env.refreshMessage(m.id);
    const msg = (e as ApiError)?.message ?? "表态失败";
    toast(env.root, msg);
  }
}

/* ============ 打赏（官方接口，滑动选择金额） ============ */

export async function createReward(env: ReactionEnv, m: ChatMessage, kind: ReactionKind, amount: number) {
  if (!env.user) {
    toast(env.root, "请先登录后再表态");
    return;
  }
  const path =
    kind === "comment"
      ? `${reactionPathOf(env.post)}?commentId=${m.id}${Math.ceil((m.locatedFloor || 0) / 30) > 1 ? `&p=${Math.ceil((m.locatedFloor || 0) / 30)}` : ""}`
      : reactionPathOf(env.post);
  try {
    await env.dataApi.createReward({
      type: kind,
      amount,
      postId: env.post.id,
      commentId: kind === "comment" ? m.id : undefined,
      path,
    });
    m.rewards = [
      ...m.rewards,
      { id: `local-${Date.now()}`, amount, user: env.user as unknown as Author, created_at: new Date().toISOString() },
    ];
    if (kind === "post") env.post.rewards = m.rewards;
    env.refreshMessage(m.id);
    toast(env.root, `打赏成功 · 支出 ${amount} 金币`);
  } catch (e) {
    toast(env.root, (e as ApiError)?.message ?? "打赏失败");
  }
}

/* ============ 表态行（与原站展示形式一致：emoji+数量 chips / 打赏头像 / 金币池） ============ */

function chipEl(emoji: string, count: number, mine: boolean): HTMLElement {
  const chip = el("div", { class: `wc-rc-chip${mine ? " is-mine" : ""}` });
  chip.append(el("span", { class: "wc-rc-emoji" }, emoji), el("span", { class: "wc-rc-count" }, String(count)));
  return chip;
}

export function renderReactionRow(env: ReactionEnv, m: ChatMessage, kind: ReactionKind | null): HTMLElement | null {
  if (!kind) return null;
  const chips = (m.reactions ?? []).filter((r) => r.count > 0);
  const totalReward = (m.rewards ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  if (!chips.length && totalReward <= 0 && m.rewardPool <= 0) return null;

  const row = el("div", { class: "wc-rc-row" });
  for (const r of chips) {
    const mine = (m.myReactions ?? []).includes(r.emoji);
    const chip = chipEl(r.emoji, r.count, mine);
    chip.dataset.tip = mine ? "已表态" : "点击表态";
    on(chip, "click", (e) => {
      e.stopPropagation();
      void toggleReaction(env, m, kind, r.emoji);
    });
    row.append(chip);
  }

  if (totalReward > 0) {
    const chip = el("div", { class: "wc-rc-chip is-reward" });
    const avs = el("span", { class: "wc-rc-avs" });
    for (const r of m.rewards.slice(0, 20)) {
      const img = document.createElement("img");
      img.className = "wc-rc-av";
      img.loading = "lazy";
      img.src = env.avatarUrl(r.user) || fallbackAvatar(r.user?.username ?? "?");
      img.dataset.tip = `@${r.user?.username ?? "?"} +${r.amount} 金币`;
      const name = r.user?.username;
      if (name) on(img, "click", (e) => {
        e.stopPropagation();
        env.onOpenUser(name);
      });
      avs.append(img);
    }
    chip.append(avs, el("span", { class: "wc-rc-count is-gold" }, String(totalReward)));
    chip.dataset.tip = "收到打赏";
    row.append(chip);
  }

  if (m.rewardPool > 0) {
    const chip = el("div", { class: "wc-rc-chip is-pool" }, "💰", el("span", { class: "wc-rc-count" }, String(m.rewardPool)));
    chip.dataset.tip = "金币池中奖";
    row.append(chip);
  }
  return row;
}

/* ============ 悬浮层（右键菜单：表情选择条 + 打赏 + 常用操作） ============ */

interface FloatState {
  el: HTMLElement;
  close(): void;
}

const floatMap = new WeakMap<ShadowRoot, FloatState>();

export function closeReactionFloat(root: ShadowRoot) {
  floatMap.get(root)?.close();
}

function openFloat(root: ShadowRoot, menu: HTMLElement, x: number, y: number, aboveAnchor?: DOMRect) {
  closeReactionFloat(root);
  const layer = el("div", { class: "wc-rc-float" });
  layer.append(menu);
  root.append(layer);

  const close = () => {
    layer.remove();
    root.removeEventListener("pointerdown", onDocDown, true);
    root.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", close);
    floatMap.delete(root);
  };
  const onDocDown = (e: Event) => {
    if (!layer.contains(e.target as Node)) close();
  };
  const onScroll = () => close();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  root.addEventListener("pointerdown", onDocDown, true);
  root.addEventListener("scroll", onScroll, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", close);
  floatMap.set(root, { el: layer, close });

  // 定位（fixed 相对视口；弹出后测量并收敛到视口内）
  layer.style.visibility = "hidden";
  requestAnimationFrame(() => {
    const rect = layer.getBoundingClientRect();
    let px = x;
    let py: number;
    if (aboveAnchor) {
      px = aboveAnchor.left;
      py = aboveAnchor.top - rect.height - 6;
      if (py < 8) py = Math.min(aboveAnchor.bottom + 6, window.innerHeight - rect.height - 8);
    } else {
      py = y + 4;
    }
    px = Math.max(8, Math.min(px, window.innerWidth - rect.width - 8));
    py = Math.max(8, Math.min(py, window.innerHeight - rect.height - 8));
    layer.style.left = `${px}px`;
    layer.style.top = `${py}px`;
    layer.style.visibility = "";
  });
}

function sepEl(): HTMLElement {
  return el("span", { class: "wc-rc-sep" });
}

function emojiStrip(env: ReactionEnv, m: ChatMessage, kind: ReactionKind): HTMLElement {
  const strip = el("div", { class: "wc-rc-strip" });
  const main = env.post.node?.main_emojis ?? [];
  const sub = env.post.node?.sub_emojis ?? [];
  const summaryEmojiSet = new Set((m.reactions ?? []).map((r) => r.emoji));
  const build = (emoji: string) => {
    const mine = (m.myReactions ?? []).includes(emoji);
    const item = el("div", {
      class: `wc-rc-opt${mine ? " is-mine" : ""}`,
      "data-tip": costOf(kind, emoji, m.author?.id ?? "", env.user?.id).text,
    }, emoji);
    if (mine) item.classList.add("is-disabled");
    else on(item, "click", (e) => {
      e.stopPropagation();
      void toggleReaction(env, m, kind, emoji);
    });
    return item;
  };
  for (const e of main) strip.append(build(e));
  if (main.length && sub.length) strip.append(sepEl());
  for (const e of sub) strip.append(build(e));

  if (canReward(env, m)) {
    strip.append(sepEl());
    const rewardBtn = el("span", { class: "wc-rc-reward-btn" }, "打赏");
    on(rewardBtn, "click", (e) => {
      e.stopPropagation();
      openRewardSlider(env, m, kind, rewardBtn.getBoundingClientRect());
    });
    strip.append(rewardBtn);
  }
  return strip;
}

/** 打赏滑条（与站点一致 100–500 步进 50） */
function openRewardSlider(env: ReactionEnv, m: ChatMessage, kind: ReactionKind, anchor: DOMRect) {
  const menu = el("div", { class: "wc-rc-menu" });
  const bar = el("div", { class: "wc-rc-reward-bar" });
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(REWARD_LIMITS.min);
  slider.max = String(REWARD_LIMITS.max);
  slider.step = String(REWARD_LIMITS.step);
  slider.value = String(REWARD_LIMITS.min);
  slider.className = "wc-rc-range";
  const label = el("span", { class: "wc-rc-reward-amount" }, `${REWARD_LIMITS.min} 金币`);
  on(slider, "input", () => {
    label.textContent = `${slider.value} 金币`;
  });
  const ok = el("button", { class: "wc-rc-reward-ok", type: "button" }, "确认");
  on(ok, "click", async (e) => {
    e.stopPropagation();
    const amount = Number(slider.value);
    ok.setAttribute("disabled", "");
    closeReactionFloat(env.root);
    await createReward(env, m, kind, amount);
  });
  bar.append(slider, label, ok);
  menu.append(bar);
  openFloat(env.root, menu, anchor.left, anchor.bottom + 6);
}

export interface MenuActions {
  /** 引用回复（评论）；帖子为普通回复 */
  onReply(): void;
  onCopy(): void;
}

/** 聊天气泡右键菜单：表情选择条（主表情|副表情|打赏）+ 引用回复 + 复制 */
export function openReactionMenu(
  env: ReactionEnv,
  m: ChatMessage,
  kind: ReactionKind | null,
  x: number,
  y: number,
  actions: MenuActions,
  aboveAnchor?: DOMRect,
) {
  const menu = el("div", { class: "wc-rc-menu" });
  // 匿名帖屏蔽表态（与站点一致），后记无表态对象
  const anonymous = !!env.post.is_anonymous_author;
  if (kind && !anonymous) menu.append(emojiStrip(env, m, kind), el("div", { class: "wc-rc-menu-div" }));
  if (kind) {
    const reply = el("div", { class: "wc-rc-menu-item" }, kind === "comment" ? "引用回复" : "回复");
    on(reply, "click", () => {
      closeReactionFloat(env.root);
      actions.onReply();
    });
    menu.append(reply);
  }
  const copy = el("div", { class: "wc-rc-menu-item" }, "复制");
  on(copy, "click", () => {
    closeReactionFloat(env.root);
    actions.onCopy();
  });
  menu.append(copy);
  openFloat(env.root, menu, x, y, aboveAnchor);
}

/** 悬浮工具条「表情」入口：菜单锚定在按钮上方 */
export function openReactionMenuAnchored(
  env: ReactionEnv,
  m: ChatMessage,
  kind: ReactionKind | null,
  anchor: DOMRect,
  actions: MenuActions,
) {
  openReactionMenu(env, m, kind, anchor.left, anchor.top, actions, anchor);
}
