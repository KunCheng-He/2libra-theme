import { DEFAULTS, MIRROR_KEYS, STORAGE_KEYS } from "./constants";

export interface ExtConfig {
  enabled: boolean;
  themeId: string;
}

/** 读取配置（先同步镜像，后异步校准） */
export async function loadConfig(): Promise<ExtConfig> {
  try {
    const obj = await chrome.storage.local.get([STORAGE_KEYS.enabled, STORAGE_KEYS.themeId]);
    const enabled = obj[STORAGE_KEYS.enabled] as unknown;
    const themeId = obj[STORAGE_KEYS.themeId] as unknown;
    return {
      enabled: typeof enabled === "boolean" ? enabled : DEFAULTS.enabled,
      themeId: typeof themeId === "string" ? themeId : DEFAULTS.themeId,
    };
  } catch {
    return { enabled: DEFAULTS.enabled, themeId: DEFAULTS.themeId };
  }
}

/** 同步快速读取（sessionStorage 镜像；content script 启动期避免闪烁） */
export function quickReadEnabled(): boolean | null {
  try {
    const v = sessionStorage.getItem(MIRROR_KEYS.enabled);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

export function mirrorEnabled(enabled: boolean) {
  try {
    sessionStorage.setItem(MIRROR_KEYS.enabled, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function saveConfig(patch: Partial<ExtConfig>): Promise<void> {
  const obj: Record<string, boolean | string> = {};
  if (typeof patch.enabled === "boolean") {
    obj[STORAGE_KEYS.enabled] = patch.enabled;
    mirrorEnabled(patch.enabled);
  }
  if (typeof patch.themeId === "string") obj[STORAGE_KEYS.themeId] = patch.themeId;
  if (Object.keys(obj).length) await chrome.storage.local.set(obj);
}

/** 监听配置变化（popup 写入后通知 content） */
export function onConfigChange(fn: (cfg: Partial<ExtConfig>) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    const patch: Partial<ExtConfig> = {};
    const enabled = changes[STORAGE_KEYS.enabled]?.newValue as unknown;
    const themeId = changes[STORAGE_KEYS.themeId]?.newValue as unknown;
    if (typeof enabled === "boolean") {
      patch.enabled = enabled;
    }
    if (typeof themeId === "string") {
      patch.themeId = themeId;
    }
    if (Object.keys(patch).length) {
      if (typeof patch.enabled === "boolean") mirrorEnabled(patch.enabled);
      fn(patch);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
