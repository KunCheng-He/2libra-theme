/** 图片悬浮查看器：当前页内放大展示（不新开标签页），点遮罩 / 关闭按钮 / Esc 恢复 */
import { el, on } from "./el";
import { icon } from "./ui";

export function openImageViewer(root: ShadowRoot, src: string, alt = "") {
  // 避免重复叠加：先移除已有的查看器
  root.querySelector(".wc-overlay[data-imgview]")?.remove();

  const img = el("img", { class: "wc-imgview-img", src, alt });
  const closeBtn = el("button", { class: "wc-imgview-close", type: "button", title: "关闭（Esc）" });
  closeBtn.append(icon("close"));

  const overlay = el("div", { class: "wc-overlay wc-imgview", "data-imgview": "" });
  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  const close = () => {
    overlay.remove();
    window.removeEventListener("keydown", keydown, true);
  };

  on(closeBtn, "click", close);
  on(overlay, "click", (e) => {
    if (e.target === overlay) close();
  });
  // 点击大图本身不关闭，避免误触
  on(img, "click", (e) => e.stopPropagation());

  window.addEventListener("keydown", keydown, true);
  overlay.append(img, closeBtn);
  root.append(overlay);
}
