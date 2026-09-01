import type { IconName } from "./icons";
import { icons } from "./icons";

export type { IconName };

export function icon(name: IconName): HTMLElement {
  const span = document.createElement("span");
  span.innerHTML = icons[name];
  return (span.firstElementChild ?? span) as HTMLElement;
}

export function iconHtml(name: IconName): string {
  return icons[name];
}

let toastWrap: HTMLElement | null = null;

export function toast(root: ShadowRoot, msg: string, ms = 2200) {
  let wrap = root.querySelector(".wc-toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "wc-toast-wrap";
    root.append(wrap);
  }
  const t = document.createElement("div");
  t.className = "wc-toast";
  t.textContent = msg;
  wrap.append(t);
  setTimeout(() => {
    t.style.transition = "opacity .2s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 220);
  }, ms);
}

/** 节点头像色（按 slug 稳定取色） */
const NODE_COLORS = ["#4A89FC", "#00B96B", "#F0A32E", "#9B59B6", "#E96A6A", "#3FB1B7", "#7B8CA6", "#5C6BC0"];
export function nodeColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return NODE_COLORS[Math.abs(h) % NODE_COLORS.length];
}
