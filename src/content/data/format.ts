/** 时间与头像等展示工具 */

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function hm(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/** 企微风格时段前缀 */
function period(d: Date): string {
  const h = d.getHours();
  if (h < 6) return "凌晨";
  if (h < 12) return "上午";
  if (h === 12) return "中午";
  if (h < 18) return "下午";
  return "晚上";
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 消息流分割线：`上午 10:23` / `昨天 下午 3:41` / `8月20日 星期三` / `2025年12月3日` */
export function formatDivider(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return `${period(d)} ${hm(d)}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return `昨天 ${period(d)} ${hm(d)}`;
  if (d.getFullYear() === now.getFullYear()) {
    const w = `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
    return now.getTime() - d.getTime() < 6 * 864e5 ? w : `${w} ${period(d)} ${hm(d)}`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 会话列表时间：`10:23` / `昨天` / `周四` / `8/20` / `2024/12/3` */
export function formatListTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return hm(d);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "昨天";
  if (now.getTime() - d.getTime() < 6 * 864e5) return `周${WEEK[d.getDay()]}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 消息楼层日期：`2025-8-7` */
export function formatFloorDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 内容摘要（去 markdown 记号；保留下划线，避免破坏 :doge_ninja: 等表情记号） */
export function snippet(md: string, max = 46): string {
  const s = md
    .replace(/```[\s\S]*?```/g, "[代码]")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[图片]")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** 大写字母 / 数字轮廓的 svg data-uri 兜底头像 */
export function fallbackAvatar(name: string): string {
  const ch = (name?.trim()?.[0] ?? "?").toUpperCase();
  const palette = ["#4A89FC", "#00B96B", "#F5A623", "#9B59B6", "#E96A6A", "#3FB1B7", "#7B8CA6", "#5C6BC0"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const bg = palette[Math.abs(hash) % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${bg}"/><text x="48" y="64" font-size="44" text-anchor="middle" fill="#fff" font-family="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">${ch}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 复制文本（失败降级） */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  }) as T;
}
