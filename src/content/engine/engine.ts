import { loadConfig, onConfigChange, quickReadEnabled, mirrorEnabled, type ExtConfig } from "../../shared/storage";
import type { ThemePack, ThemeRoute } from "../../shared/types";
import { dataApi } from "../data/api";
import { registry } from "../themes/registry";
import { adoptHostStyle, destroyHost, ensureShadowRoot, hideHost, releaseHostStyle, showHost, startHostGuard } from "./host";
import { createRouter } from "./router";

type State = "idle" | "active" | "fallback";

class Engine {
  private state: State = "idle";
  private theme: ThemePack | null = null;
  private cfg: ExtConfig = { enabled: true, themeId: "wecom" };
  private router = createRouter();
  private unsubRoute: (() => void) | null = null;
  private booting = false;
  private fixingHost = false;
  private fixCount = 0;
  private lastFixAt = 0;

  async boot() {
    if (this.booting) return;
    this.booting = true;

    // 同步镜像预判，尽快进入伪装态（后续异步校准）
    const quick = quickReadEnabled();
    if (quick === false) {
      this.cfg.enabled = false;
    }

    this.cfg = await loadConfig();
    mirrorEnabled(this.cfg.enabled);

    onConfigChange((patch) => {
      Object.assign(this.cfg, patch);
      void this.apply();
    });

    this.unsubRoute = this.router.subscribe(() => void this.onRouteChange());

    if (this.cfg.enabled && quick !== false) {
      await this.tryEnable();
    } else if (this.cfg.enabled && quick === false) {
      // mirror 认为关闭、storage 认为开启：以 storage 为准，启用
      await this.tryEnable();
    }
    this.booting = false;
  }

  /** 探测站点：接口结构不符合预期则不接管（改版保护） */
  private async probe(): Promise<boolean> {
    try {
      const nodes = await Promise.race([
        dataApi.getNodeTree(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("probe timeout")), 8000)),
      ]);
      return Array.isArray(nodes) && nodes.length > 0 && Array.isArray(nodes[0].children);
    } catch {
      return false;
    }
  }

  private async tryEnable() {
    if (this.state === "active") return;
    const ok = await this.probe();
    if (!ok) {
      console.warn("[2lt] 站点探测失败，保持原版界面");
      this.state = "fallback";
      return;
    }
    const theme = registry.get(this.cfg.themeId);
    if (!theme) {
      this.state = "fallback";
      return;
    }
    await this.activate(theme);
  }

  private async activate(theme: ThemePack) {
    adoptHostStyle();
    const root = ensureShadowRoot();
    showHost();
    try {
      await theme.mount({
        root,
        data: dataApi,
        router: this.router,
        escapeHatch: () => this.escapeHatch(),
      });
      this.theme = theme;
      this.state = "active";
      startHostGuard(() => this.handleHostRemoved());
      // 挂载完成后再解析路由（挂载期间可能已发生导航）
      const route = theme.matchRoute(location.pathname, location.search);
      if (route) {
        theme.onRouteChange(route, this.router.href);
      } else {
        // 首屏即处于未映射路由（聚合页/登录/设置等）→ 回退原版
        await this.escapeHatch();
      }
    } catch (e) {
      console.error("[2lt] 主题挂载失败，回退原版", e);
      await this.deactivateTheme();
      hideHost();
      releaseHostStyle();
      this.state = "fallback";
    }
  }

  /** 自愈：站点脚本（如 React 水合恢复）清除了宿主节点/接管属性时，重建并重新挂载主题 */
  private handleHostRemoved() {
    if (this.fixingHost || this.state !== "active" || !this.theme) return;
    // 去抖：短时间内被反复清除则放弃重挂，避免与站点清除逻辑死循环
    const now = Date.now();
    this.fixCount = now - this.lastFixAt < 10_000 ? this.fixCount + 1 : 1;
    this.lastFixAt = now;
    if (this.fixCount > 3) {
      console.error("[2lt] 宿主节点被站点反复清除，放弃重挂，回退原版界面");
      void this.escapeHatch();
      return;
    }
    this.fixingHost = true;
    console.warn("[2lt] 宿主节点被站点清除，重建并重新挂载主题");
    const theme = this.theme;
    void (async () => {
      try {
        await this.deactivateTheme(); // 旧 ShadowRoot 已随宿主失联，仅清理主题状态/定时器
        destroyHost();                // 必须整体重建（新元素才有新 ShadowRoot）
        await this.activate(theme);
      } finally {
        this.fixingHost = false;
      }
    })();
  }

  private async deactivateTheme() {
    if (!this.theme) return;
    try {
      await this.theme.unmount();
    } catch (e) {
      console.warn("[2lt] 主题卸载异常", e);
    }
    this.theme = null;
  }

  private async disable() {
    await this.deactivateTheme();
    hideHost();
    releaseHostStyle();
    this.state = "idle";
  }

  /** 回退保护：卸载主题 UI、恢复原版显示，但保持监听（回到支持的路由时自动重新接管） */
  private async escapeHatch() {
    await this.deactivateTheme();
    hideHost();
    releaseHostStyle();
    this.state = "fallback";
  }

  private async apply() {
    if (!this.cfg.enabled) {
      if (this.state !== "idle") await this.disable();
      return;
    }
    if (this.state === "active") {
      // 主题可能被切换
      const theme = registry.get(this.cfg.themeId);
      if (theme === this.theme) return;
      await this.deactivateTheme();
      hideHost();
      releaseHostStyle();
      this.state = "fallback";
    }
    await this.tryEnable();
  }

  private async onRouteChange() {
    if (!this.cfg.enabled) return;
    const url = this.router.href;

    if (this.state === "active" && this.theme) {
      const route = this.theme.matchRoute(location.pathname, location.search);
      if (route) {
        this.theme.onRouteChange(route, url);
        return;
      }
      // 进入未映射路由（登录/设置等）→ 回退原版
      await this.escapeHatch();
      return;
    }

    if (this.state === "fallback") {
      // 从未映射路由回到受支持路由 → 重新接管
      const theme = registry.get(this.cfg.themeId);
      if (!theme) return;
      const route = theme.matchRoute(location.pathname, location.search);
      if (!route) return;
      await this.tryEnable();
    }
  }

  /** 当前路由是否受支持（供外部诊断） */
  currentRoute(): ThemeRoute | null {
    if (!this.theme) return null;
    return this.theme.matchRoute(location.pathname, location.search);
  }
}

export const engine = new Engine();
