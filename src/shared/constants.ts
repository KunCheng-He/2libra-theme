/** 站点与扩展全局常量 */

export const SITE_ORIGIN = "https://2libra.com";
export const R2_ORIGIN = "https://r2.2libra.com";

export const STORAGE_KEYS = {
  enabled: "2lt:enabled",
  themeId: "2lt:themeId",
} as const;

/** sessionStorage 同步镜像键（规避 storage 异步读取的首帧闪烁） */
export const MIRROR_KEYS = {
  enabled: "2lt:mirror:enabled",
} as const;

export const DEFAULTS = {
  enabled: true,
  themeId: "wecom",
} as const;

/** API 分页尺寸 */
export const PAGE_SIZE_POSTS = 20;
export const PAGE_SIZE_COMMENTS = 20;

/** 消息流时间分割线最小间隔（分钟） */
export const TIME_DIVIDER_GAP_MIN = 10;

/** 企微蓝 */
export const WECOM_BLUE = "#0082ef";
