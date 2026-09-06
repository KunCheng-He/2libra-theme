/**
 * 站点自定义表情（如 :doge_ninja:）。
 * 逆向自站点前端：/api/emojis/all 提供全量目录（code → img_url+size），
 * 评论/帖子数据的 emojis 字段提供该条内容用到的映射（优先级更高）；
 * 图片统一托管在 r2.2libra.com，站点将 :code: 渲染为行内图片（medium ≈ 2em）。
 */

import { R2_ORIGIN } from "../../shared/constants";
import { get } from "./client";

export const EMOJI_CODE_RE = /:([a-zA-Z0-9_]+):/g;

/** 全局目录：":code:" → 图片路径（含 ?size= 查询） */
const catalog = new Map<string, string>();

let catalogPromise: Promise<void> | null = null;

/** 拉取全量表情目录（模块级去重；失败静默，评论内映射仍可兜底） */
export function loadEmojiCatalog(): Promise<void> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        const d = await get<{ list?: { code?: string; img_url?: string; size?: string }[] | null }>("/api/emojis/all");
        const list = Array.isArray(d) ? d : d?.list;
        for (const e of list ?? []) {
          if (e?.code && e?.img_url && !catalog.has(e.code)) {
            catalog.set(e.code, `${e.img_url}?size=${e.size || "medium"}`);
          }
        }
      } catch {
        catalogPromise = null;
      }
    })();
  }
  return catalogPromise;
}

/** 学习某条内容自带的 emojis 映射（覆盖全局目录，与站点合并顺序一致） */
export function learnEmojis(map: Record<string, string> | null | undefined) {
  if (!map) return;
  for (const [code, path] of Object.entries(map)) {
    if (code && path) catalog.set(code, path);
  }
}

/** 解析表情图片地址；不在目录中返回 null（避免把普通文本误替换成裂图） */
export function emojiSrc(code: string, override?: Record<string, string> | null): string | null {
  const path = override?.[code] ?? catalog.get(code);
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${R2_ORIGIN}${path}`;
}
