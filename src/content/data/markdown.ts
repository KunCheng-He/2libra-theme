/**
 * 极简安全 Markdown 渲染器（消息气泡用）。
 * 先整体 HTML 转义，再叠加白名单语法，杜绝 XSS。
 */

import { EMOJI_CODE_RE, emojiSrc } from "./emoji";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_URL = /^(https?:\/\/|\/)/i;

function linkify(url: string): string | null {
  const u = url.trim();
  if (!SAFE_URL.test(u)) return null;
  return u.replace(/"/g, "%22");
}

/** 行内语法：图片、链接、加粗、斜体、删除线、行内代码、站内表情 */
function renderInline(escaped: string, emojiMap?: Record<string, string> | null): string {
  let s = escaped;
  // 行内代码（优先，占位保护）
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000C${codes.length - 1}\u0000`;
  });
  // 站内表情 :code:（仅替换目录中存在的，避免误伤普通文本；对齐站点 medium ≈ 2em）
  s = s.replace(EMOJI_CODE_RE, (whole, name: string) => {
    const src = emojiSrc(`:${name}:`, emojiMap);
    return src ? `<img class="wc-md-emoji" src="${src}" alt=":${name}:" loading="lazy">` : whole;
  });
  // 图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
    const u = linkify(url);
    return u ? `<img class="wc-md-img" src="${u}" alt="${alt}" loading="lazy">` : alt;
  });
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, url: string) => {
    const u = linkify(url);
    return u ? `<a class="wc-md-link" href="${u}" data-href="${u}">${text}</a>` : text;
  });
  // 加粗 / 斜体 / 删除线
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  // 恢复行内代码
  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code class="wc-md-code">${codes[Number(i)]}</code>`);
  return s;
}

export function renderMarkdown(src: string, emojiMap?: Record<string, string> | null): string {
  const lines = escapeHtml(src).split(/\r?\n/);
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;
  let codeLang = "";

  const flushPara = () => {
    if (para.length) {
      out.push(`<p class="wc-md-p">${para.map((l) => renderInline(l, emojiMap)).join("<br>")}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(
        `<${list.type} class="wc-md-list">` +
          list.items.map((i) => `<li>${renderInline(i, emojiMap)}</li>`).join("") +
          `</${list.type}>`,
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote class="wc-md-quote">${quote.map((l) => renderInline(l, emojiMap)).join("<br>")}</blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const line of lines) {
    // 代码块
    if (code !== null) {
      if (/^```/.test(line.trim())) {
        out.push(`<pre class="wc-md-pre"><code>${code.join("\n")}</code></pre>`);
        code = null;
        codeLang = "";
      } else {
        code.push(line);
      }
      continue;
    }
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      flushAll();
      code = [];
      codeLang = fence[1] ?? "";
      continue;
    }
    // 空行
    if (!line.trim()) {
      flushAll();
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushAll();
      out.push(`<p class="wc-md-h"><strong>${renderInline(h[2], emojiMap)}</strong></p>`);
      continue;
    }
    // hr
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushAll();
      out.push('<hr class="wc-md-hr">');
      continue;
    }
    // 引用
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    // 列表
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.、]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      flushQuote();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul ? ul[1] : ol![1]) ?? "");
      continue;
    }
    flushList();
    flushQuote();
    para.push(line);
  }
  // 收尾
  if (code !== null && code.length) out.push(`<pre class="wc-md-pre"><code>${code.join("\n")}</code></pre>`);
  flushAll();
  void codeLang;
  return out.join("");
}

/** 纯文本（如引用预览）中的 :code: → 行内表情 <img>（先转义再替换，输出安全 HTML） */
export function renderEmojiHtml(text: string): string {
  return escapeHtml(text).replace(EMOJI_CODE_RE, (whole, name: string) => {
    const src = emojiSrc(`:${name}:`);
    return src ? `<img class="wc-md-emoji" src="${src}" alt=":${name}:" loading="lazy">` : whole;
  });
}
