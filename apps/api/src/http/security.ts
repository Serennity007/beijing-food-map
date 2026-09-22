import type { IncomingMessage } from 'node:http';
import { ApiError } from '@qianwei/contracts';
import type { AppConfig } from '../env';

/** 写操作要过 Origin / Sec-Fetch-Site 检查；CORS 头由同一份白名单驱动。 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CORRELATION_HEADER = 'idempotency-key';

export interface CorsHeaders {
  [key: string]: string;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(cfg: AppConfig, origin: string | null | undefined): boolean {
  if (!origin) return true; // 无 Origin：同源导航、健康检查、curl
  if (origin === 'null') return false;
  return cfg.allowedOrigins.includes(origin.replace(/\/$/, ''));
}

/** 同源判断：Origin 的 host 与请求 Host 相同（Vite 代理到 :8787 时也成立）。 */
export function isSameOrigin(req: IncomingMessage, origin: string): boolean {
  const host = req.headers.host;
  if (!host) return false;
  return originHost(origin) === host;
}

export function assertWriteAllowed(cfg: AppConfig, req: IncomingMessage, method: string): void {
  if (SAFE_METHODS.has(method)) return;
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  if (origin && !isAllowedOrigin(cfg, origin) && !isSameOrigin(req, origin)) {
    throw new ApiError('FORBIDDEN', '请求来源不在允许列表内', 403);
  }
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site === 'cross-site') {
    throw new ApiError('FORBIDDEN', '跨站请求被拒绝', 403);
  }
}

export function corsHeaders(cfg: AppConfig, req: IncomingMessage): CorsHeaders | null {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  if (!origin) return null;
  if (!isAllowedOrigin(cfg, origin) && !isSameOrigin(req, origin)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': `content-type, ${CORRELATION_HEADER}`,
    'access-control-expose-headers': 'x-request-id',
    'access-control-max-age': '600',
    vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  };
}

/** 登录按 IP+账号限流（进程内滑动窗口，免费层单实例够用）。 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  take(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      const wait = Math.ceil((list[0]! + this.windowMs - now) / 1000);
      return { ok: false, retryAfterSec: Math.max(1, wait) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) {
      for (const [k, v] of [...this.hits.entries()]) {
        const fresh = v.filter((t) => t > cutoff);
        if (fresh.length === 0) this.hits.delete(k);
        else this.hits.set(k, fresh);
      }
    }
    return { ok: true, retryAfterSec: 0 };
  }

  reset(): void {
    this.hits.clear();
  }
}
