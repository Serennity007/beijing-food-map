import { ApiError } from '@qianwei/contracts';
import type { JsonRecord } from '../db/repository';

/** HTTP 层只做"形状"校验；领域规则（20 字理由、窗口、披露计票等）全部由 Store 负责。 */

function fail(field: string, message: string): never {
  throw new ApiError('VALIDATION_ERROR', message, 400, { [field]: message });
}

export function bRaw(body: JsonRecord, key: string): unknown {
  return body[key];
}

export function bStr(body: JsonRecord, key: string, opts: { required?: boolean; max?: number; min?: number } = {}): string | null {
  const v = body[key];
  if (v === undefined || v === null) {
    if (opts.required) fail(key, `${key} 必填`);
    return null;
  }
  if (typeof v !== 'string') fail(key, `${key} 必须是字符串`);
  const t = v.trim();
  if (opts.max !== undefined && t.length > opts.max) fail(key, `${key} 最长 ${opts.max} 字符`);
  if (opts.min !== undefined && t.length < opts.min) fail(key, `${key} 至少 ${opts.min} 字符`);
  return t;
}

export function bEnum<T extends string>(
  body: JsonRecord,
  key: string,
  allowed: readonly T[],
  opts: { required?: boolean; fallback?: T } = {},
): T | null {
  const v = bStr(body, key, { required: opts.required, max: 64 });
  if (v === null) return opts.fallback ?? null;
  if (!(allowed as readonly string[]).includes(v)) fail(key, `${key} 只能是 ${allowed.join(' | ')}`);
  return v as T;
}

export function bBool(body: JsonRecord, key: string, fallback: boolean): boolean {
  const v = body[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') fail(key, `${key} 必须是布尔值`);
  return v;
}

export function bNum(
  body: JsonRecord,
  key: string,
  opts: { required?: boolean; min?: number; max?: number; integer?: boolean } = {},
): number | null {
  return bNumRaw(body[key], key, opts);
}

/** 同 bNum，但值从别处取出（例如 expected_version / expectedVersion 两个键名兼容）。 */
export function bNumRaw(
  v: unknown,
  key: string,
  opts: { required?: boolean; min?: number; max?: number; integer?: boolean } = {},
): number | null {
  if (v === undefined || v === null) {
    if (opts.required) fail(key, `${key} 必填`);
    return null;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(key, `${key} 必须是数字`);
  if (opts.integer && !Number.isInteger(v)) fail(key, `${key} 必须是整数`);
  if (opts.min !== undefined && v < opts.min) fail(key, `${key} 不能小于 ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) fail(key, `${key} 不能大于 ${opts.max}`);
  return v;
}

export function bStrArray(body: JsonRecord, key: string, opts: { max?: number; itemMax?: number } = {}): string[] {
  const v = body[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) fail(key, `${key} 必须是数组`);
  if (opts.max !== undefined && v.length > opts.max) fail(key, `${key} 最多 ${opts.max} 项`);
  return v.map((item, idx) => {
    if (typeof item !== 'string') fail(key, `${key}[${idx}] 必须是字符串`);
    const t = item.trim();
    if (opts.itemMax !== undefined && t.length > opts.itemMax) fail(key, `${key}[${idx}] 最长 ${opts.itemMax} 字符`);
    return t;
  });
}

export function bDate(body: JsonRecord, key: string, opts: { required?: boolean } = {}): string | null {
  const v = bStr(body, key, { required: opts.required, max: 10 });
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(key, `${key} 必须是 YYYY-MM-DD`);
  return v;
}

/** required 系列助手的类型收窄：拿到 null 就是缺字段。 */
export function need<T>(value: T | null, key: string): T {
  if (value === null || value === undefined) fail(key, `${key} 必填`);
  return value;
}
