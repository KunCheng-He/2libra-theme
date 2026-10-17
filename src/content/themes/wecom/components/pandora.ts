/** 潘多拉盒子（逆向自 2libra.com 站点前端，逻辑与样式保持原版）：
 *  - 图标入口：每日可开盒 / 质变窗口内可见；开过且窗口已过自动消失（次日重置）；
 *  - 开盒：POST /api/pandora/open（覆盖进行中事件先确认）；
 *  - 质变（翻转一次）：POST /api/pandora/reroll，窗口内且次数未用完；
 *  - 弹窗：稀有度卡片（原版 SVG 模板）+ aura 光环 + 揭示扫光 + 双倒计时 + 环形质变进度。
 *  - 头像效果：按用户 pandora_info.avatar_effect 应用（透明/缩小/旋转/缩放/扭曲/光环）。 */
import type { PandoraAvatarState, PandoraBox, DataApi } from "../../../../shared/types";
import { RARITY_CARD_HTML } from "./pandora-cards";
import { el, on } from "./el";
import { icons } from "./icons";

export interface PandoraEnv {
  root: ShadowRoot;
  data: DataApi;
  toast(msg: string): void;
  /** 效果生效后刷新自身界面（如重绘侧栏头像） */
  onEffectApplied?(): void;
}

/* aura 光环角度动画需要注册自定义属性（@property 在 Shadow DOM 样式表内不可靠） */
if (typeof CSS !== "undefined" && typeof (CSS as { registerProperty?: unknown }).registerProperty === "function") {
  for (const name of ["--pandora-aura-angle", "--pfx-aura-angle"]) {
    try {
      (CSS as unknown as {
        registerProperty: (d: { name: string; syntax: string; inherits: boolean; initialValue: string }) => void;
      }).registerProperty({
        name,
        syntax: "<angle>",
        inherits: false,
        initialValue: "0deg",
      });
    } catch {
      /* 已注册 / 不支持：光环退化为静态渐变 */
    }
  }
}

/* ============ 工具 ============ */

/** 倒计时（与站点一致 m:ss；目标已过 → done 文案） */
function countdown(target: number, now: number, done: string): string | null {
  if (!Number.isFinite(target)) return null;
  const s = Math.floor(Math.max(0, target - now) / 1000);
  const m = Math.floor(s / 60);
  return now >= target ? done : `${m}:${String(s % 60).padStart(2, "0")}`;
}

function fmtFull(iso: string | undefined | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 是否处于质变窗口：deadline 未到且次数未用完 */
function canReroll(box: PandoraBox | null, now: number): boolean {
  if (!box || !box.reroll_deadline_at) return false;
  const t = new Date(box.reroll_deadline_at).getTime();
  return Number.isFinite(t) && box.reroll_used < box.reroll_limit && now < t;
}

/* ============ 图标入口 + 弹窗 ============ */

const SLOTS: { env: PandoraEnv; dialog: HTMLDialogElement | null; timer: ReturnType<typeof setInterval> | null }[] = [];

function cleanupEntry(entry: (typeof SLOTS)[number]) {
  if (entry.timer) clearInterval(entry.timer);
  entry.timer = null;
  entry.dialog?.remove();
  entry.dialog = null;
}

export function closePandoraModal(root: ShadowRoot): void {
  for (const entry of SLOTS) {
    if (entry.env.root === root) cleanupEntry(entry);
  }
  root.querySelector(".pc-confirm")?.remove();
}

export function closeAllPandoraModals(): void {
  for (const entry of [...SLOTS]) cleanupEntry(entry);
}

/** 创建潘多拉图标（点击走原版开盒/质变流程）。不可用时返回 null。 */
export async function createPandoraIcon(env: PandoraEnv): Promise<HTMLElement | null> {
  const today = await env.data.getPandoraToday();
  if (!today) return null;
  const now = Date.now();
  const canOpen = !!today.can_open;
  const reroll = canReroll(today.box, now);
  if (!canOpen && !reroll) return null;

  const tip = "潘多拉盒子：开了就要负责 👀。";
  const box = el("button", {
    class: "wc-pandora-entry",
    type: "button",
    title: tip,
  });
  const img = document.createElement("img");
  img.src = "https://r2.2libra.com/site/pandora.png";
  img.alt = "pandora";
  img.draggable = false;
  box.append(img);

  const click = async () => {
    if (env.root.querySelector(".wc-pandora")) return;
    let activeExtended = !!today.active_extended;
    try {
      // 与站点一致：点击时重新校准状态
      const fresh = await env.data.getPandoraToday();
      if (fresh) {
        activeExtended = !!fresh.active_extended;
        today.box = fresh.box;
        today.can_open = fresh.can_open;
      }
    } catch {}
    const proceed = async () => {
      try {
        const nb = await env.data.openPandora();
        showBoxModal(env, nb);
        try {
          sessionStorage.setItem("pandora_box_opened_at", String(Date.now()));
        } catch {}
      } catch (e) {
        env.toast((e as Error).message || "开启盒子失败");
      }
    };
    if (activeExtended) {
      askOpenConfirm(env, proceed);
      return;
    }
    void proceed();
  };
  on(box, "click", () => void click());
  return box;
}

function askOpenConfirm(env: PandoraEnv, onOk: () => void): void {
  const host = el("div", { class: "pc-confirm" });
  host.append(
    el("div", { class: "pc-confirm-box" },
      el("div", { class: "pc-confirm-title" }, "确认开启盒子"),
      el("div", { class: "pc-confirm-msg" }, "当前事件未结束，是否确认开启盒子，开启盒子后会覆盖当前的事件。"),
      el("div", { class: "pc-confirm-act" },
        el("button", { class: "pc-btn", type: "button" }, "取消"),
        el("button", { class: "pc-btn is-primary", type: "button" }, "确认开启"),
      ),
    ),
  );
  const [cancel, ok] = host.querySelectorAll("button");
  on(ok, "click", () => {
    host.remove();
    onOk();
  });
  on(cancel, "click", () => host.remove());
  on(host, "click", (e) => {
    if (e.target === host) host.remove();
  });
  env.root.append(host);
}

/** 展示盒子弹窗（原版样式） */
function showBoxModal(env: PandoraEnv, box: PandoraBox | null): void {
  if (!box) return;
  closePandoraModal(env.root);

  const entry: (typeof SLOTS)[number] = { env, dialog: null, timer: null };
  SLOTS.push(entry);

  const dlg = el("dialog", { class: "wc-pandora" });
  const wrap = el("div", { class: "wc-pandora-wrap" });

  /* 关闭按钮（原版右上圆钮） */
  const closeBtn = el("button", { class: "pclose", type: "button", title: "关闭", "aria-label": "关闭潘多拉盒子" });
  closeBtn.innerHTML = icons.close;
  on(closeBtn, "click", () => dlg.close());
  wrap.append(closeBtn);

  /* 卡片 + hover-3d 倾斜分区 + 质变按钮（原版结构） */
  const reveal = el("div", { class: "pandora-card-reveal" });
  const stage = el("div", { class: "hover-3d" }, reveal);
  for (let i = 0; i < 8; i++) stage.append(el("div")); // hover 分区（站点 tilt 效果）

  /* 质变按钮：环形倒计时 */
  const C = 2 * Math.PI * 17;
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ring.setAttribute("class", "pc-ring");
  ring.setAttribute("viewBox", "0 0 40 40");
  ring.setAttribute("aria-hidden", "true");
  const circleBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const circleRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  for (const c of [circleBg, circleRing]) {
    c.setAttribute("cx", "20");
    c.setAttribute("cy", "20");
    c.setAttribute("r", "17");
    c.setAttribute("fill", "none");
  }
  circleBg.setAttribute("stroke", "rgba(255,255,255,0.22)");
  circleBg.setAttribute("stroke-width", "2");
  circleRing.setAttribute("stroke", "rgba(255,255,255,0.96)");
  circleRing.setAttribute("stroke-width", "2");
  circleRing.setAttribute("stroke-linecap", "round");
  ring.append(circleBg, circleRing);
  const flipBtn = el("button", { class: "pc-flip", type: "button" });
  flipBtn.innerHTML = icons.refresh;
  const flipWrap = el("div", { class: "pc-flip-wrap" }, ring, flipBtn);
  const flipRow = el("div", { class: "pc-flip-row" }, flipWrap);

  let current: PandoraBox | null = box;
  let busy = false;

  /** （重）渲染卡片：box 每次变化重建节点 → 揭示扫光重新播放（与站点 key 重置一致） */
  const renderCard = () => {
    if (!current) return;
    const b = current;
    const tpl = RARITY_CARD_HTML[b.rarity] ?? RARITY_CARD_HTML.bronze;
    const slot =
      `<div class="pc-top"><div class="pc-name"></div><div class="pc-title"></div></div>` +
      `<div class="pc-foot"><div class="pc-cnt"></div><div class="pc-exp"></div></div>`;
    const frag = document.createElement("div");
    frag.innerHTML = tpl.replace("__SLOT__", slot);
    const card = frag.firstElementChild as HTMLElement | null;
    if (!card) return;
    card.classList.add("pandora-card");
    card.setAttribute("data-key", `${b.box_instance_id}-${b.event_code}-${b.tier_code ?? "?"}-${b.reroll_used}`);
    (card.querySelector(".pc-name") as HTMLElement).textContent = b.event_name || b.event_title || "潘多拉";
    (card.querySelector(".pc-title") as HTMLElement).textContent = b.event_title ?? "";
    tick();
    reveal.innerHTML = "";
    reveal.append(card);
  };

  const renderFlip = (now: number) => {
    const ok = canReroll(current, now);
    if (!ok) {
      flipRow.remove();
      return;
    }
    const purple = !!current?.force_purple_reroll;
    flipWrap.classList.toggle("is-purple", purple);
    flipBtn.classList.toggle("is-purple", purple);
    flipBtn.disabled = busy;
    const o = current?.open_at ? new Date(current.open_at).getTime() : NaN;
    const d = current?.reroll_deadline_at ? new Date(current.reroll_deadline_at).getTime() : NaN;
    let p = 0;
    if (Number.isFinite(o) && Number.isFinite(d)) {
      const span = d - o;
      p = span <= 0 ? 0 : Math.min(1, Math.max(0, (Math.max(0, d - now)) / span));
    }
    circleRing.setAttribute("stroke-dasharray", String(C));
    circleRing.setAttribute("stroke-dashoffset", String(C * (1 - p)));
    const cd = countdown(d, now, "已截止") ?? "-";
    flipWrap.title = `${purple ? "紫色刷新" : "质变"}倒计时：${cd}`;
    if (!flipRow.isConnected) wrap.append(flipRow);
  };

  const tick = () => {
    const now = Date.now();
    const cnt = reveal.querySelector(".pc-cnt") as HTMLElement | null;
    if (cnt && current) {
      const a = new Date(current.apply_at).getTime();
      cnt.textContent = `生效倒计时：${countdown(a, now, "已生效") ?? "-"}`;
    }
    const exp = reveal.querySelector(".pc-exp") as HTMLElement | null;
    if (exp && current) exp.textContent = `效果截止：${fmtFull(current.expire_at)}`;
    renderFlip(now);
  };

  const doReroll = async () => {
    if (!current || busy) return;
    busy = true;
    flipBtn.disabled = true;
    try {
      current = await env.data.rerollPandora(current.box_instance_id);
      renderCard(); // 新卡片 + 扫光重播
      try {
        sessionStorage.setItem("pandora_box_opened_at", String(Date.now()));
      } catch {}
    } catch (e) {
      env.toast((e as Error).message || "质变失败");
    } finally {
      busy = false;
    }
  };
  on(flipBtn, "click", () => void doReroll());

  dlg.addEventListener("close", () => {
    cleanupEntry(entry);
  });
  entry.dialog = dlg;

  wrap.append(stage);
  dlg.append(wrap);

  renderCard();
  entry.timer = setInterval(tick, 100);
  env.root.append(dlg);
  try {
    dlg.showModal();
  } catch {
    /* 已被同轮移除 */
  }
}

/* ============ 头像效果 ============ */

const AURA_KINDS = new Set(["aura-silver", "aura-gold", "aura-rainbow"]);

/** 给 <img> 应用该用户的潘多拉头像效果（非 active 无效果） */
export function applyPandoraEffect(img: HTMLImageElement, info: PandoraAvatarState | null | undefined): void {
  if (!info || !info.active) return;
  const eff = (info.avatar_effect || "").toLowerCase();
  if (!eff || eff === "none") return;

  if (AURA_KINDS.has(eff)) {
    const halo = el("span", { class: `pfx-aura pfx-aura-${eff.slice(5)}` });
    img.replaceWith(halo);
    halo.append(img);
    halo.style.setProperty("--pfx-aura-dur", eff === "aura-gold" ? "8s" : "6s");
    return;
  }
  const cls: Record<string, string> = {
    transparent: "pfx-transparent",
    shrink: "pfx-shrink",
    spin: "pfx-spin",
    zoom: "pfx-zoom",
    skew: "pfx-skew",
  };
  const c = cls[eff];
  if (!c) return;
  img.classList.add(c);
  if (c === "pfx-skew") {
    const deg = typeof info.avatar_skew_angle === "number" ? info.avatar_skew_angle : 12;
    img.style.transform = `skewX(${deg}deg)`;
  }
}

/** 用户是否有可见头像效果（供侧栏/聊天气泡埋点） */
export function hasAvatarEffect(info: PandoraAvatarState | null | undefined): boolean {
  return !!info && info.active && !!info.avatar_effect && info.avatar_effect !== "none";
}
