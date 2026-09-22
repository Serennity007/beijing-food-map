import type { ServerResponse } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { ApiError, ERROR_HTTP_STATUS, type ErrorCode } from '@qianwei/contracts';
import { RuleViolation } from '@qianwei/contracts';
import { ConfigError } from '../env';
import { StartupError } from '../db/sqlite';
import type { JsonRecord } from '../db/repository';

/** 成功/失败信封。除 500 之外一律回显领域文案（都是给用户看的中文提示）。 */

export interface ResponseMeta {
  requestId: string;
}

/** Set-Cookie 需要数组形式，其余是单值。 */
export type HttpHeaders = Record<string, string | string[]>;

export interface Failure {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

const GENERIC_INTERNAL = '服务器内部错误，请稍后重试';

export function classify(err: unknown): Failure {
  if (err instanceof ApiError) {
    const mapped = ERROR_HTTP_STATUS[err.code as ErrorCode];
    const status = mapped ?? (err.status >= 400 && err.status <= 599 ? err.status : 400);
    const fieldErrors = err.fieldErrors;
    return fieldErrors
      ? { status, code: err.code, message: err.message, fieldErrors }
      : { status, code: err.code, message: err.message };
  }
  if (err instanceof RuleViolation) {
    return { status: 400, code: 'VALIDATION_ERROR', message: err.message };
  }
  if (err instanceof SyntaxError) {
    return { status: 400, code: 'VALIDATION_ERROR', message: '请求体不是合法 JSON' };
  }
  if (err instanceof ConfigError || err instanceof StartupError) {
    return { status: 500, code: 'INTERNAL', message: GENERIC_INTERNAL };
  }
  return { status: 500, code: 'INTERNAL', message: GENERIC_INTERNAL };
}

export function isExpectedClientError(err: unknown): boolean {
  return err instanceof ApiError || err instanceof RuleViolation || err instanceof SyntaxError;
}

function sendJson(res: ServerResponse, status: number, payload: unknown, extraHeaders: HttpHeaders): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}

export function sendOk(
  res: ServerResponse,
  data: unknown,
  meta: ResponseMeta,
  extraHeaders: HttpHeaders = {},
  status = 200,
): void {
  sendJson(res, status, { data, meta: { requestId: meta.requestId } }, { 'x-request-id': meta.requestId, ...extraHeaders });
}

export function sendFailure(
  res: ServerResponse,
  failure: Failure,
  meta: ResponseMeta,
  extraHeaders: HttpHeaders = {},
): void {
  const error: JsonRecord & { code: string; message: string } = { code: failure.code, message: failure.message };
  if (failure.fieldErrors) error['fieldErrors'] = failure.fieldErrors;
  sendJson(
    res,
    failure.status,
    { error, meta: { requestId: meta.requestId } },
    { 'x-request-id': meta.requestId, ...extraHeaders },
  );
}

/** 图片等资源直接写字节，不套 JSON 信封（只有 /media/:id 用）。 */
export function sendBinary(
  res: ServerResponse,
  bytes: Buffer,
  contentType: string,
  meta: ResponseMeta,
  extraHeaders: HttpHeaders = {},
  status = 200,
): void {
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': bytes.byteLength,
    'cache-control': 'private, max-age=60',
    'x-content-type-options': 'nosniff',
    'x-request-id': meta.requestId,
    ...extraHeaders,
  });
  res.end(bytes);
}

// ------------------------------------------------------------------ cookie

export function readSessionCookie(req: IncomingMessage): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== 'qw_session') continue;
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    // 只接受会话 id 的形状，避免任何注入或超长值
    return /^[A-Za-z0-9:_-]{1,128}$/.test(value) ? value : null;
  }
  return null;
}

export function sessionCookie(value: string, opts: { secure: boolean; clear?: boolean }): string {
  const attrs = ['HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (opts.secure) attrs.push('Secure');
  attrs.push(opts.clear ? 'Max-Age=0' : 'Max-Age=2592000');
  if (opts.clear) attrs.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return `qw_session=${opts.clear ? '' : encodeURIComponent(value)}; ${attrs.join('; ')}`;
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]).split(',')[0]!.trim();
  return req.socket.remoteAddress ?? 'unknown';
}
