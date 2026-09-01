import "./popup.css";
import { DEFAULTS, STORAGE_KEYS } from "../shared/constants";

interface ThemeMeta {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
}

const THEMES: ThemeMeta[] = [
  { id: "wecom", name: "办公 IM 风格", desc: "企业微信桌面端样式", enabled: true },
  { id: "ide-dark", name: "IDE 风格", desc: "即将推出", enabled: false },
  { id: "terminal", name: "终端风格", desc: "即将推出", enabled: false },
];

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const chatSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="12.5" rx="3"/><path d="M8 17v3.2l3.8-3.2"/></svg>`;
const codeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4"/></svg>`;
const termSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 4 4-4 4M12 17h7"/></svg>`;
const ICONS: Record<string, string> = { wecom: chatSvg, "ide-dark": codeSvg, terminal: termSvg };

async function load(): Promise<{ enabled: boolean; themeId: string }> {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.enabled, STORAGE_KEYS.themeId]);
  const enabled = obj[STORAGE_KEYS.enabled] as unknown;
  const themeId = obj[STORAGE_KEYS.themeId] as unknown;
  return {
    enabled: typeof enabled === "boolean" ? enabled : DEFAULTS.enabled,
    themeId: typeof themeId === "string" ? themeId : DEFAULTS.themeId,
  };
}

function renderThemes(current: string, enabled: boolean) {
  const list = $("#theme-list");
  list.innerHTML = "";
  for (const t of THEMES) {
    const item = document.createElement("div");
    item.className =
      "theme-item" + (t.id === current ? " is-active" : "") + (t.enabled ? "" : " is-disabled");
    item.innerHTML = `
      <span class="theme-icon">${ICONS[t.id] ?? ""}</span>
      <span class="theme-main">
        <span class="theme-name">${t.name}</span><br/>
        <span class="theme-desc">${t.desc}</span>
      </span>
      <svg class="theme-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
    if (t.enabled) {
      item.addEventListener("click", async () => {
        await chrome.storage.local.set({ [STORAGE_KEYS.themeId]: t.id });
        renderThemes(t.id, enabled);
      });
    }
    list.append(item);
  }
}

async function init() {
  const { enabled, themeId } = await load();
  const toggle = $<HTMLInputElement>("#enabled");
  const status = $("#status");
  toggle.checked = enabled;
  status.textContent = enabled ? "伪装已启用" : "伪装已停用";
  status.className = `status ${enabled ? "on" : "off"}`;
  renderThemes(themeId, enabled);

  toggle.addEventListener("change", async () => {
    await chrome.storage.local.set({ [STORAGE_KEYS.enabled]: toggle.checked });
    status.textContent = toggle.checked ? "伪装已启用" : "伪装已停用";
    status.className = `status ${toggle.checked ? "on" : "off"}`;
  });
}

void init();
