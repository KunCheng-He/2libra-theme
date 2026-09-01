/** 线性风格 SVG 图标（24 viewBox，currentColor 描边），企微观感 */

const svg = (inner: string): string =>
  `<svg class="wc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icons = {
  chat: svg(
    '<rect x="3.5" y="4.5" width="17" height="12.5" rx="3"/><path d="M8 17v3.2l3.8-3.2"/><path d="M8 10.7h.01M12 10.7h.01M16 10.7h.01" stroke-width="2.2"/>',
  ),
  contacts: svg(
    '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="9.6" r="2.4"/><path d="M7.4 17.2c.9-2.1 2.6-3.1 4.6-3.1s3.7 1 4.6 3.1"/>',
  ),
  doc: svg('<path d="M6 3.5h8.2L18 7.3V20.5H6Z"/><path d="M13.8 3.7V7.6H18"/><path d="M9 12h6.2M9 15.5h6.2"/>'),
  calendar: svg(
    '<rect x="3.8" y="5.3" width="16.4" height="15" rx="2.4"/><path d="M3.8 10h16.4M8.2 3.4v3.6M15.8 3.4v3.6"/>',
  ),
  meeting: svg(
    '<rect x="3.2" y="6" width="12.6" height="12" rx="2.6"/><path d="M15.8 10.6l5-3v8.8l-5-3"/>',
  ),
  workbench: svg(
    '<rect x="4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6"/>',
  ),
  gear: svg(
    '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1"/>',
  ),
  /* ---- 左侧导航 / 分组 ---- */
  mail: svg(
    '<rect x="3.2" y="5" width="17.6" height="14" rx="2.6"/><path d="m4.8 7.6 6 4.6c.7.5 1.7.5 2.4 0l6-4.6"/>',
  ),
  todo: svg(
    '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.2 12.2 2.4 2.4 5.2-5.4"/>',
  ),
  smartDoc: svg(
    '<path d="M6 3.5h8.2L18 7.3V20.5H6Z"/><path d="M13.8 3.7V7.6H18"/><path d="m9 13.8 2 2 4-4.4"/>',
  ),
  summary: svg(
    '<path d="M5 5.5h14M5 10h14M5 14.5h7.5"/><path d="m17.3 13.6.75 1.85 1.85.75-1.85.75-.75 1.85-.75-1.85-1.85-.75 1.85-.75Z" fill="currentColor" stroke-width="1.1"/>',
  ),
  drive: svg(
    '<path d="m12 3.8 7 3.9v8.6l-7 3.9-7-3.9V7.7Z"/><path d="m5 7.7 7 3.9 7-3.9M12 11.6v8.4"/>',
  ),
  advanced: svg(
    '<circle cx="7.6" cy="7.6" r="1.7"/><circle cx="16.4" cy="7.6" r="1.7"/><circle cx="7.6" cy="16.4" r="1.7"/><circle cx="16.4" cy="16.4" r="1.7"/>',
  ),
  unread: svg(
    '<rect x="3.2" y="5.5" width="17.6" height="13" rx="2.4"/><path d="m4.4 7.6 6.4 4.9c.7.5 1.7.5 2.4 0l6.4-4.9"/>',
  ),
  singleChat: svg(
    '<circle cx="9.5" cy="8.6" r="2.9"/><path d="M4.3 18.8c.8-2.9 2.8-4.4 5.2-4.4 1.3 0 2.5.4 3.5 1.2"/><rect x="14.2" y="12.6" width="6.3" height="5.4" rx="1.6"/>',
  ),
  groupChat: svg(
    '<circle cx="9.2" cy="9" r="2.8"/><path d="M3.9 18.6c.7-2.7 2.8-4.2 5.3-4.2s4.6 1.5 5.3 4.2"/><path d="M15.5 6.5a2.8 2.8 0 0 1 0 5M17.4 14.6c1.7.5 2.9 1.9 3.4 4"/>',
  ),
  internal: svg(
    '<path d="M12 4.6c4.8 0 8.4 2.9 8.4 6.9s-3.6 6.9-8.4 6.9c-1.1 0-2.1-.14-3.1-.42L5.4 19.5l1-3C4.5 15.1 3.6 13.4 3.6 11.5c0-4 3.6-6.9 8.4-6.9Z"/>',
  ),
  external: svg(
    '<path d="M6.5 3.8h8.2L18 7.3v13.2H6.5Z"/><path d="M14 4v3.7h3.8"/><path d="M9.5 11h5.4M9.5 14.5h5.4"/>',
  ),
  flag: svg(
    '<path d="m12 4.4 2.16 4.4 4.84.7-3.5 3.4.83 4.8L12 15.4l-4.33 2.3.83-4.8-3.5-3.4 4.84-.7Z"/>',
  ),
  building: svg(
    '<rect x="5" y="4" width="14" height="16.5" rx="1.2"/><path d="M9 8.2h1.6M13.4 8.2H15M9 12h1.6M13.4 12H15M9 15.8h1.6M13.4 15.8H15"/>',
  ),
  /* ---- 聊天顶栏 ---- */
  phone: svg(
    '<path d="M5.6 4.4h2.9l1.6 3.9-1.9 1.5a12.4 12.4 0 0 0 5.6 5.6l1.5-1.9 3.9 1.6v2.9a1.6 1.6 0 0 1-1.8 1.6C9.6 18.8 5.2 14.4 4 6.2a1.6 1.6 0 0 1 1.6-1.8Z"/>',
  ),
  screen: svg(
    '<rect x="3.5" y="4.8" width="17" height="11.6" rx="2"/><path d="M9.5 20.2h5M12 16.4v3.8"/><path d="m9.2 12.4 2.4-2.4 1.8 1.8 2.6-2.8" />',
  ),
  translate: svg(
    '<path d="M4 6h7.5M7.8 4v2M10 6c-.7 3.2-3 6-6 7.6M5.8 9.4c1.1 2.1 3.1 3.7 5.5 4.5"/><path d="m12.8 20 3.6-8.6L20 20M14.1 17.2h4.6"/>',
  ),
  refresh: svg('<path d="M18.6 8.6A7 7 0 1 0 19 12.4"/><path d="M19 4.2v4.6h-4.6"/>'),
  share: svg(
    '<path d="M12 14.2V4.4"/><path d="m8.2 7.8 3.8-3.8 3.8 3.8"/><path d="M6.2 11v7.3A1.7 1.7 0 0 0 7.9 20h8.2a1.7 1.7 0 0 0 1.7-1.7V11"/>',
  ),
  folder: svg(
    '<path d="M3.8 6.6A1.8 1.8 0 0 1 5.6 4.8h3.9l2 2.4h6.9a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5.6a1.8 1.8 0 0 1-1.8-1.8Z"/>',
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  smile: svg(
    '<circle cx="12" cy="12" r="8.4"/><path d="M8.6 14.2c.8 1.2 2 1.9 3.4 1.9s2.6-.7 3.4-1.9"/><path d="M9 9.8h.01M15 9.8h.01" stroke-width="2.4"/>',
  ),
  image: svg(
    '<rect x="3.8" y="4.8" width="16.4" height="14.4" rx="2.4"/><circle cx="9" cy="9.6" r="1.6"/><path d="m4.5 17.5 4.6-4.4 3.4 3.1 3.1-2.9 3.9 3.7"/>',
  ),
  at: svg(
    '<circle cx="12" cy="12" r="4"/><path d="M16 8v5.2c0 1.6 1.1 2.3 2.1 2.3 1.6 0 2.9-1.6 2.9-4.2A9 9 0 1 0 15.4 20"/>',
  ),
  scissors: svg(
    '<circle cx="6.5" cy="7" r="2.4"/><circle cx="6.5" cy="17" r="2.4"/><path d="M8.6 8.4 19.5 17M8.6 15.6 19.5 7"/>',
  ),
  dots: svg('<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="2.6"/>'),
  chevronDown: svg('<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>'),
  arrowLeft: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  quote: svg('<path d="M5 7h6v6H7.5c0 2 1 3.2 3.5 3.6M13.5 7h6v6H17c0 2 1 3.2 3.5 3.6" transform="scale(1,-1) translate(0,-24)"/>'),
  eye: svg('<path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.6"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  logo: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5" fill="#0082ef"/><rect x="5.2" y="6.2" width="13.6" height="9.4" rx="2.4" fill="#fff"/><path d="M8.4 15.6v3l3.4-3z" fill="#fff"/><path d="M8.7 10.9h.01M12 10.9h.01M15.3 10.9h.01" stroke="#0082ef" stroke-width="2" stroke-linecap="round"/></svg>`,
};

export type IconName = keyof typeof icons;
