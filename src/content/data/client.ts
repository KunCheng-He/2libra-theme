import { SITE_ORIGIN } from "../../shared/constants";
import type { ApiEnvelope } from "../../shared/types";

export class ApiError extends Error {
  code: number;
  needLogin: boolean;
  constructor(code: number, message: string, needLogin = false) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.needLogin = needLogin;
  }
}

function readAccessToken(): string | null {
  try {
    const t = localStorage.getItem("access_token");
    return t && t.length > 8 ? t : null;
  } catch {
    return null;
  }
}

const LOGIN_HINTS = ["未登录", "登录", "token", "unauthorized", "401"];

/** same-origin 请求：带凭据与站点一致的 Bearer 认证 */
export async function request<T>(path: string, init: RequestInit & { timeout?: number } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = readAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeout ?? 15000);
  try {
    const res = await fetch(SITE_ORIGIN + path, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      credentials: "include",
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!data || typeof data.c !== "number") {
      throw new ApiError(-1, "响应解析失败，站点可能已改版");
    }
    if (data.c !== 0) {
      const msg = String(data.m ?? "请求失败");
      const needLogin = res.status === 401 || LOGIN_HINTS.some((h) => msg.includes(h));
      throw new ApiError(data.c, msg, needLogin);
    }
    return data.d;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(-2, "请求超时");
    throw new ApiError(-3, "网络请求失败");
  } finally {
    clearTimeout(timer);
  }
}

export const get = <T>(path: string) => request<T>(path);
export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
