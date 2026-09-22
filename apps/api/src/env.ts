/**
 * 配置入口：只读 PORT / HOST / NODE_ENV / SQLITE_PATH / ALLOWED_ORIGINS
 * （外加可选的 LOGIN_RATE_LIMIT_PER_MIN）。
 * 任何校验失败只报"变量名"，绝不把变量值写进日志或响应。
 */

export type NodeEnv = 'production' | 'development' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  sqlitePath: string;
  allowedOrigins: string[];
  loginRateLimit: { max: number; windowMs: number };
  maxBodyBytes: number;
}

export const API_BASE_PATH = '/api/v1';
export const SESSION_COOKIE = 'qw_session';
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
export const DEFAULT_SQLITE_PATH = './data/demo.sqlite';
export const DEFAULT_PORT = 8787;

/** 配置错误单独一类，便于启动阶段以退出码 1 失败。 */
export class ConfigError extends Error {}

function trim(v: string | undefined): string {
  return (v ?? '').trim();
}

function normalizeNodeEnv(raw: string): NodeEnv {
  const v = raw.toLowerCase();
  if (v === 'production' || v === 'prod') return 'production';
  if (v === 'test') return 'test';
  if (v === '' || v === 'development' || v === 'dev') return 'development';
  throw new ConfigError(`NODE_ENV 只接受 production | development | test（当前值非法，未回显）`);
}

function parseIntEnv(raw: string, name: string): number {
  if (!/^\d+$/.test(raw)) throw new ConfigError(`${name} 必须是整数字符串（当前值非法，未回显）`);
  return Number(raw);
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  const list = trim(raw)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter((s) => s.length > 0);
  const origins = list.length > 0 ? list : DEFAULT_ALLOWED_ORIGINS;
  for (const o of origins) {
    if (o === '*') throw new ConfigError('ALLOWED_ORIGINS 不允许 *（会话使用 Cookie，必须显式白名单）');
    if (!/^https?:\/\/[^/]+$/.test(o)) throw new ConfigError('ALLOWED_ORIGINS 必须是逗号分隔的 scheme://host[:port]（不含路径）');
  }
  return origins;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = normalizeNodeEnv(trim(env.NODE_ENV));

  const portRaw = trim(env.PORT);
  let port = DEFAULT_PORT;
  if (portRaw !== '') {
    port = parseIntEnv(portRaw, 'PORT');
    if (port < 1 || port > 65535) throw new ConfigError('PORT 必须在 1—65535 之间');
  }

  const hostRaw = trim(env.HOST);
  const host = hostRaw !== '' ? hostRaw : '127.0.0.1';
  if (!/^[A-Za-z0-9:._-]+$/.test(host)) throw new ConfigError('HOST 只能是合法的主机名或 IP');

  const sqlitePath = trim(env.SQLITE_PATH) || DEFAULT_SQLITE_PATH;

  const rateRaw = trim(env.LOGIN_RATE_LIMIT_PER_MIN);
  let max = 10;
  if (rateRaw !== '') {
    max = parseIntEnv(rateRaw, 'LOGIN_RATE_LIMIT_PER_MIN');
    if (max < 1 || max > 1000) throw new ConfigError('LOGIN_RATE_LIMIT_PER_MIN 必须在 1—1000 之间');
  }

  return {
    nodeEnv,
    port,
    host,
    sqlitePath,
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    loginRateLimit: { max, windowMs: 60_000 },
    maxBodyBytes: 256 * 1024,
  };
}

/** 只有 production 才给 Cookie 加 Secure；demo 部署也走非 production，见 runbook。 */
export function isProduction(cfg: AppConfig): boolean {
  return cfg.nodeEnv === 'production';
}
