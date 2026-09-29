/**
 * 配置入口：只读 PORT / HOST / NODE_ENV / SQLITE_PATH / ALLOWED_ORIGINS
 * （外加登录限流、SESSION_SECRET、SESSION_TTL_SECONDS、COOKIE_SECURE，
 *   以及短信发送、微信内容安全、上传存储的上线上线配置）。
 * 任何校验失败只报"变量名"，绝不把变量值写进日志或响应。
 */

import path from 'node:path';

export type NodeEnv = 'production' | 'development' | 'test';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  sqlitePath: string;
  allowedOrigins: string[];
  loginRateLimit: { max: number; windowMs: number };
  maxBodyBytes: number;
  sessionSecret?: string;
  sessionTtlSeconds?: number;
  secureCookie?: boolean;
  /** 短信验证码发送方式：console=写日志（非生产）；http=通用 Webhook 网关；none=未配置（production 缺省）。 */
  smsProvider: 'console' | 'http' | 'none';
  smsHttpUrl?: string;
  smsHttpToken?: string;
  /** 同手机号发码限流（默认 1 条/分钟；测试可放宽窗口）。 */
  smsSendRateLimit: { max: number; windowMs: number };
  /** 微信内容安全（msgSecCheck）凭据；两者齐备才启用。 */
  wechatAppid?: string;
  wechatAppSecret?: string;
  /** 真实图片上传的对象存储目录（磁盘适配）。 */
  uploadDir: string;
  maxUploadBytes: number;
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

  const sessionSecret = trim(env.SESSION_SECRET);
  if ((sessionSecret && sessionSecret.length < 32) || (nodeEnv === 'production' && !sessionSecret)) throw new ConfigError('SESSION_SECRET 至少 32 个字符，生产环境必填');
  const secure = trim(env.COOKIE_SECURE);
  if (secure && !['true', 'false'].includes(secure)) throw new ConfigError('COOKIE_SECURE 必须为 true 或 false');
  if (nodeEnv === 'production' && secure === 'false') throw new ConfigError('生产环境必须开启 COOKIE_SECURE');
  const sessionTtlSeconds = parseIntEnv(trim(env.SESSION_TTL_SECONDS) || '2592000', 'SESSION_TTL_SECONDS');
  if (sessionTtlSeconds < 60 || sessionTtlSeconds > 2592000) throw new ConfigError('SESSION_TTL_SECONDS 必须在 60—2592000 之间');

  const smsRaw = trim(env.SMS_PROVIDER).toLowerCase();
  let smsProvider: 'console' | 'http' | 'none' = smsRaw === '' ? (nodeEnv === 'production' ? 'none' : 'console') : (smsRaw as 'console' | 'http' | 'none');
  if (!['console', 'http', 'none'].includes(smsProvider)) throw new ConfigError('SMS_PROVIDER 只接受 console | http | none（当前值非法，未回显）');
  const smsHttpUrl = trim(env.SMS_HTTP_URL) || undefined;
  if (smsProvider === 'http' && !smsHttpUrl) throw new ConfigError('SMS_PROVIDER=http 时必须提供 SMS_HTTP_URL');
  if (smsProvider === 'console' && nodeEnv === 'production') throw new ConfigError('生产环境禁止 SMS_PROVIDER=console（验证码会写进日志），请用 http 或 none');
  const smsHttpToken = trim(env.SMS_HTTP_TOKEN) || undefined;

  const wechatAppid = trim(env.WECHAT_APPID) || undefined;
  const wechatAppSecret = trim(env.WECHAT_APP_SECRET) || undefined;
  if (!!wechatAppid !== !!wechatAppSecret) throw new ConfigError('WECHAT_APPID 与 WECHAT_APP_SECRET 必须成对提供');

  const uploadDir = trim(env.UPLOAD_DIR) || path.join(path.dirname(sqlitePath), 'uploads');
  const maxUploadMbRaw = trim(env.MAX_UPLOAD_MB) || '8';
  if (!/^\d+$/.test(maxUploadMbRaw)) throw new ConfigError('MAX_UPLOAD_MB 必须是整数字符串（当前值非法，未回显）');
  const maxUploadBytes = Number(maxUploadMbRaw) * 1024 * 1024;
  if (maxUploadBytes < 64 * 1024 || maxUploadBytes > 32 * 1024 * 1024) throw new ConfigError('MAX_UPLOAD_MB 必须在 0.0625—32 之间（按字节校验 64KB—32MB）');

  return {
    sessionSecret: sessionSecret || undefined,
    sessionTtlSeconds,
    secureCookie: nodeEnv === 'production' || secure === 'true',
    nodeEnv,
    port,
    host,
    sqlitePath,
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    loginRateLimit: { max, windowMs: 60_000 },
    maxBodyBytes: 256 * 1024,
    smsProvider,
    smsHttpUrl,
    smsHttpToken,
    smsSendRateLimit: { max: 1, windowMs: 60_000 },
    wechatAppid,
    wechatAppSecret,
    uploadDir,
    maxUploadBytes,
  };
}

/** 是否生产运行模式；Cookie Secure 还可以由 COOKIE_SECURE 独立开启。 */
export function isProduction(cfg: AppConfig): boolean {
  return cfg.nodeEnv === 'production';
}
