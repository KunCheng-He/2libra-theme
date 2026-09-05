import type { RouterApi } from "../../shared/types";

type Listener = (url: string) => void;

/**
 * 轻量路由：劫持隔离世界的 history.pushState/replaceState（主题 UI 是唯一导航来源），
 * 叠加 popstate 监听。URL 始终保持真实 2libra 路由。
 */
export function createRouter(): RouterApi {
  const listeners = new Set<Listener>();
  let current = location.pathname + location.search;

  const emit = () => {
    const url = location.pathname + location.search;
    if (url === current) return; // 多来源触发去重（isolated 包装 / 站点软导航轮询）
    current = url;
    for (const fn of listeners) {
      try {
        fn(current);
      } catch (e) {
        console.warn("[2lt] router listener error", e);
      }
    }
  };

  const wrap = (method: "pushState" | "replaceState") => {
    const orig = history[method].bind(history);
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const ret = orig(...args);
      emit();
      return ret;
    } as History["pushState"];
  };

  let installed = false;
  const ensureInstalled = () => {
    if (installed) return;
    installed = true;
    wrap("pushState");
    wrap("replaceState");
    window.addEventListener("popstate", emit);
    // 站点自身（MAIN world）的软导航不经过隔离世界的包装，轮询兜底：
    // 回退态下用户点击原版链接回到受支持路由时，可自动重新接管
    setInterval(emit, 250);
  };

  ensureInstalled();

  return {
    get href() {
      return location.pathname + location.search;
    },
    push(url: string) {
      if (url === location.pathname + location.search) return;
      history.pushState({}, "", url);
    },
    replace(url: string) {
      history.replaceState({}, "", url);
    },
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
