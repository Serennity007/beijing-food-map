import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot } from '../src/bootstrap';
import type { Booted } from '../src/bootstrap';
import { API_BASE_PATH, type AppConfig } from '../src/env';
import { addDays } from '@qianwei/contracts';

/** 测试脚手架：临时 SQLite 文件 + 端口 0 的真实 HTTP 监听。 */

export interface Harness {
  cfg: AppConfig;
  base: string;
  dir: string;
  booted: Booted;
  close: () => Promise<void>;
}

export function makeConfig(overrides: Partial<AppConfig> = {}): { cfg: AppConfig; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'qw-api-test-'));
  const cfg: AppConfig = {
    nodeEnv: 'development',
    port: 0,
    host: '127.0.0.1',
    sqlitePath: join(dir, 'demo.sqlite'),
    allowedOrigins: ['http://localhost:5173'],
    loginRateLimit: { max: 1000, windowMs: 60_000 },
    maxBodyBytes: 256 * 1024,
    ...overrides,
  };
  return { cfg, dir };
}

/** 复用已有 sqlite 文件重启（验证写穿与冷启动恢复）。 */
export async function restart(prev: Harness, overrides: Partial<AppConfig> = {}): Promise<Harness> {
  const { cfg, dir } = makeConfig({ ...prev.cfg, ...overrides, sqlitePath: prev.cfg.sqlitePath });
  const booted = boot(cfg);
  const port = await booted.app.listen();
  return {
    cfg,
    dir,
    booted,
    base: `http://127.0.0.1:${port}${API_BASE_PATH}`,
    close: async () => {
      await booted.app.close();
      booted.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows 上文件句柄可能还没释放 */
      }
    },
  };
}

export async function start(overrides: Partial<AppConfig> = {}): Promise<Harness> {
  const { cfg, dir } = makeConfig(overrides);
  const booted = boot(cfg);
  const port = await booted.app.listen();
  return {
    cfg,
    dir,
    booted,
    base: `http://127.0.0.1:${port}${API_BASE_PATH}`,
    close: async () => {
      await booted.app.close();
      booted.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows 上文件句柄可能还没释放 */
      }
    },
  };
}

export interface Reply<T = unknown> {
  status: number;
  data: T | null;
  error: { code: string; message: string; fieldErrors?: Record<string, string> } | null;
  meta: { requestId: string } | null;
  headers: Headers;
}

export function parseReply<T>(res: Response, text: string): Reply<T> {
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  return {
    status: res.status,
    data: (json['data'] ?? null) as T | null,
    error: (json['error'] ?? null) as Reply<T>['error'],
    meta: (json['meta'] ?? null) as Reply<T>['meta'],
    headers: res.headers,
  };
}

export class Client {
  cookie: string | null = null;

  constructor(private readonly base: string) {}

  async req<T = unknown>(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string>; useCookie?: boolean } = {},
  ): Promise<Reply<T>> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (this.cookie && opts.useCookie !== false) headers.cookie = this.cookie;
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const setCookies = res.headers.getSetCookie();
    for (const c of setCookies) {
      const pair = c.split(';')[0] ?? '';
      if (pair.startsWith('qw_session=')) {
        const value = pair.slice('qw_session='.length);
        this.cookie = value === '' || value === 'undefined' ? null : `qw_session=${value}`;
      }
    }
    return parseReply<T>(res, await res.text());
  }

  async login(userId: string, code = '888888'): Promise<Reply<{ user: { id: string; roles: string[] } }>> {
    return this.req('POST', '/auth/login', { body: { user_id: userId, code }, useCookie: false });
  }

  get<T = unknown>(path: string) {
    return this.req<T>('GET', path);
  }
}

/** 今天由服务器决定（Asia/Shanghai），测试不依赖本机时区。 */
export async function serverToday(h: Harness): Promise<string> {
  const r = await new Client(h.base).get<string>('/today');
  if (!r.data) throw new Error('/today 未返回日期');
  return r.data;
}

export const REASON =
  '测试反馈（合成，非真实探店）：酸汤底发酵感明显、米粉软硬度合适，这条记录用于验证 HTTP 外壳、幂等与审核链路。';

export function submitBody(today: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    restaurant_id: 'R17',
    visited_date: addDays(today, -3),
    attitude: 'recommend',
    dish_names: ['凯里红酸汤鱼'],
    reason: REASON,
    // 种子图：F046 = U01 在 R17 的已过审反馈，媒体归属必须与投稿人一致
    media_ids: ['MMF046'],
    disclosure: 'none',
    require_media_for_recommend: true,
    ...over,
  };
}

export const QUERY =
  '?west=115.42&south=39.44&east=117.52&north=41.06&zoom=11&view=southwest&include_unknown=0&layer=qualified';
