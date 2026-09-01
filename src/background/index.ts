import { DEFAULTS, STORAGE_KEYS } from "../shared/constants";

function setBadge(enabled: boolean) {
  const text = enabled ? "ON" : "";
  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color: "#0082ef" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const obj = await chrome.storage.local.get([STORAGE_KEYS.enabled, STORAGE_KEYS.themeId]);
  const patch: Record<string, boolean | string> = {};
  if (typeof obj[STORAGE_KEYS.enabled] !== "boolean") patch[STORAGE_KEYS.enabled] = DEFAULTS.enabled;
  if (typeof obj[STORAGE_KEYS.themeId] !== "string") patch[STORAGE_KEYS.themeId] = DEFAULTS.themeId;
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  setBadge(obj[STORAGE_KEYS.enabled] !== false);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !(STORAGE_KEYS.enabled in changes)) return;
  setBadge(changes[STORAGE_KEYS.enabled].newValue !== false);
});

// SW 唤醒时恢复 badge
void (async () => {
  const obj = await chrome.storage.local.get(STORAGE_KEYS.enabled);
  setBadge(obj[STORAGE_KEYS.enabled] !== false);
})();
