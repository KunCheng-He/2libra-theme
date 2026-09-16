/** 站点原生弹窗「保留显示」：被伪装的是整页接管层，站点自身的每日签到检定弹窗需原样展示。
 *  站点逻辑（每日首次进入自动签到、每日仅一次）保持运行，弹窗由站点自行打开/关闭，本模块只负责：
 *  1. 检测签到检定 / 签到成功弹窗；
 *  2. 弹窗所在顶层容器改为不绘制（veil），弹窗本体置顶（showModal → top layer）；
 *  3. 弹窗被站点卸载后还原接管隐藏。 */

const NATIVE_ATTR = "data-2lt-native-modal";
const VEIL_ATTR = "data-2lt-veil";
const TITLE_RE = /^(签到检定|签到成功)$/;
const TITLE_HINT_RE = /签到检定|签到成功/;

let observer: MutationObserver | null = null;
let frame = 0;
let marked: HTMLDialogElement | null = null;
let veiled: Element | null = null;

/** 文本特征识别，不依赖站点的工具类名（仅用 daisyUI 语义类 + 文案） */
function isCheckinDialog(node: Element): node is HTMLDialogElement {
  if (node.tagName !== "DIALOG" || !node.classList.contains("modal")) return false;
  if (!node.classList.contains("modal-open") && !node.hasAttribute("open")) return false;
  const box = node.querySelector(".modal-box");
  if (!box || !TITLE_HINT_RE.test(box.textContent ?? "")) return false;
  const hasTitle = Array.from(box.querySelectorAll("*")).some(
    (el) => el.children.length === 0 && TITLE_RE.test((el.textContent ?? "").trim()),
  );
  return hasTitle && !!node.querySelector(".modal-action button");
}

/** 弹窗到 body 之间的顶层子节点（React 树根；弹窗若直挂 body 则为自身） */
function topLevelAncestor(el: Element): Element | null {
  let node: Element | null = el;
  while (node && node.parentElement && node.parentElement !== document.body) {
    node = node.parentElement;
  }
  return node && node.parentElement === document.body ? node : null;
}

function mark(dlg: HTMLDialogElement) {
  marked = dlg;
  dlg.setAttribute(NATIVE_ATTR, "");
  const root = topLevelAncestor(dlg);
  if (root && root !== dlg) {
    root.setAttribute(VEIL_ATTR, "");
    veiled = root;
  }
  // 站点仅用 daisyUI 类保持可见（未调用 showModal），这里补上原生模态语义以越过宿主覆盖层
  try {
    if (!dlg.open) dlg.showModal();
  } catch (e) {
    console.warn("[2lt] 原生弹窗置顶失败，退回 CSS 层级", e);
  }
}

function unmark() {
  marked?.removeAttribute(NATIVE_ATTR);
  veiled?.removeAttribute(VEIL_ATTR);
  marked = null;
  veiled = null;
}

function scan() {
  frame = 0;
  if (marked && marked.isConnected && isCheckinDialog(marked)) return;
  const found = Array.from(document.querySelectorAll("dialog.modal")).find(isCheckinDialog) ?? null;
  if (found) {
    if (found !== marked) {
      unmark();
      mark(found);
    }
    return;
  }
  if (marked) unmark();
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(scan);
}

export function startNativeModalKeeper() {
  if (observer) return;
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "open"],
  });
  scan();
}

export function stopNativeModalKeeper() {
  observer?.disconnect();
  observer = null;
  if (frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  unmark();
}
