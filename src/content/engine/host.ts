import hostCss from "./host.css";

const HOST_ATTR = "data-2lt-host";
const ON_ATTR = "data-2lt-on";

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let hostSheet: CSSStyleSheet | null = null;
let guard: MutationObserver | null = null;

/** 注入接管样式：隐藏 Next 原应用（保留运行） */
export function adoptHostStyle() {
  if (hostSheet) return;
  hostSheet = new CSSStyleSheet();
  hostSheet.replaceSync(hostCss);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, hostSheet];
}

export function releaseHostStyle() {
  if (!hostSheet) return;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== hostSheet);
  hostSheet = null;
}

/** 创建（或复用）挂载根；Shadow DOM 隔离站点样式 */
export function ensureShadowRoot(): ShadowRoot {
  if (shadow) return shadow;
  host = document.createElement("div");
  host.setAttribute(HOST_ATTR, "");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;";
  shadow = host.attachShadow({ mode: "open", delegatesFocus: true });
  (document.documentElement ?? document.body).appendChild(host);
  return shadow;
}

export function showHost() {
  document.documentElement.setAttribute(ON_ATTR, "");
  if (host) host.style.display = "";
}

export function hideHost() {
  stopHostGuard();
  document.documentElement.removeAttribute(ON_ATTR);
  if (host) host.style.display = "none";
}

export function destroyHost() {
  hideHost();
  host?.remove();
  host = null;
  shadow = null;
}

export function getShadowRoot(): ShadowRoot | null {
  return shadow;
}

/** 存活监护：站点脚本（如 React 水合恢复）会清除 <html> 下的外来节点与属性；被清除时回调引擎重建 */
export function startHostGuard(onRemoved: () => void) {
  stopHostGuard();
  guard = new MutationObserver(() => {
    const sheetGone = !!hostSheet && !document.adoptedStyleSheets.includes(hostSheet);
    if (!host || !host.isConnected || !document.documentElement.hasAttribute(ON_ATTR) || sheetGone) {
      onRemoved();
    }
  });
  guard.observe(document.documentElement, { childList: true, attributes: true });
}

export function stopHostGuard() {
  guard?.disconnect();
  guard = null;
}
