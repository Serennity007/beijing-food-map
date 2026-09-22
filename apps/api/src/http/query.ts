import { ApiError, CONTRACT_VERSION, BEIJING_BOUNDS, LAYERS, VIEWS, type Bounds, type MapQuery } from '@qianwei/contracts';

/**
 * /map/items 与 /restaurants 必须用同一份规范化查询：
 * Store 用查询指纹校验快照，两份解析只要有一点不一致就会误报 QUERY_EXPIRED。
 */

export const MAX_PAGE_LIMIT = 50;
export const DEFAULT_LIMIT = 20;
export const DEFAULT_ZOOM = 11;
export const MAX_SNAPSHOT_LEN = 80;

export interface PagedMapQuery {
  query: MapQuery;
  snapshot: string | null;
  cursor: string | null;
  limit: number;
}

function bad(field: string, message: string): never {
  throw new ApiError('VALIDATION_ERROR', message, 400, { [field]: message });
}

function raw(search: URLSearchParams, key: string): string | null {
  const v = search.get(key);
  if (v === null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function num(search: URLSearchParams, key: string, opts: { min: number; max: number; integer?: boolean; optional?: boolean }): number | null {
  const v = raw(search, key);
  if (v === null) return opts.optional ? null : bad(key, `${key} 必填`);
  if (!/^-?\d+(\.\d+)?$/.test(v)) bad(key, `${key} 必须是数字`);
  if (opts.integer && !/^-?\d+$/.test(v)) bad(key, `${key} 必须是整数`);
  const n = Number(v);
  if (!Number.isFinite(n)) bad(key, `${key} 不是有限数字`);
  if (n < opts.min || n > opts.max) bad(key, `${key} 必须在 ${opts.min}—${opts.max} 之间`);
  return n;
}

function oneOf<T extends string>(search: URLSearchParams, key: string, allowed: readonly T[], fallback: T): T {
  const v = raw(search, key);
  if (v === null) return fallback;
  if (!(allowed as readonly string[]).includes(v)) bad(key, `${key} 只能是 ${allowed.join(' | ')}`);
  return v as T;
}

function bool(search: URLSearchParams, key: string, fallback: boolean): boolean {
  const v = raw(search, key);
  if (v === null) return fallback;
  if (['1', 'true', 'yes'].includes(v.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(v.toLowerCase())) return false;
  return bad(key, `${key} 只能是 1 或 0`);
}

function text(search: URLSearchParams, key: string, maxLen: number): string | null {
  const v = raw(search, key);
  if (v === null) return null;
  if (v.length > maxLen) bad(key, `${key} 最长 ${maxLen} 字符`);
  return v;
}

function bounds(search: URLSearchParams): Bounds {
  const keys = ['west', 'south', 'east', 'north'] as const;
  const provided = keys.filter((k) => raw(search, k) !== null);
  if (provided.length === 0) return { ...BEIJING_BOUNDS };
  if (provided.length !== keys.length) bad('bounds', 'west/south/east/north 必须同时提供');
  const west = num(search, 'west', { min: -180, max: 180 });
  const east = num(search, 'east', { min: -180, max: 180 });
  const south = num(search, 'south', { min: -90, max: 90 });
  const north = num(search, 'north', { min: -90, max: 90 });
  if ((west as number) >= (east as number)) bad('west', 'west 必须小于 east');
  if ((south as number) >= (north as number)) bad('south', 'south 必须小于 north');
  return { west: west as number, south: south as number, east: east as number, north: north as number };
}

export function parseMapQuery(search: URLSearchParams): PagedMapQuery {
  const contract = raw(search, 'contract_version');
  if (contract !== null && contract !== CONTRACT_VERSION) {
    bad('contract_version', `合同版本不匹配（当前 ${CONTRACT_VERSION}）`);
  }
  const zoom = num(search, 'zoom', { min: 0, max: 22, integer: true, optional: true }) ?? DEFAULT_ZOOM;
  const budget = num(search, 'budget', { min: 1, max: 100000, optional: true });
  const limitRaw = num(search, 'limit', { min: 1, max: MAX_PAGE_LIMIT, integer: true, optional: true });
  const limit = limitRaw === null ? DEFAULT_LIMIT : Number(limitRaw);
  const query: MapQuery = {
    bounds: bounds(search),
    zoom,
    view: oneOf(search, 'view', VIEWS, 'guizhou'),
    budget_max: budget,
    include_unknown_budget: bool(search, 'include_unknown', false),
    dish_or_tag: text(search, 'dish', 50),
    layer: oneOf(search, 'layer', LAYERS, 'qualified'),
    contract_version: CONTRACT_VERSION,
  };
  return {
    query,
    snapshot: text(search, 'snapshot', MAX_SNAPSHOT_LEN),
    cursor: text(search, 'cursor', MAX_SNAPSHOT_LEN),
    limit,
  };
}

/** 详情/写接口的 id 形状校验：只允许种子与 nextId 生成的字符集。 */
export function assertId(value: string, field: string, maxLen = 64): string {
  const v = value.trim();
  if (!v) bad(field, `${field} 必填`);
  if (v.length > maxLen) bad(field, `${field} 最长 ${maxLen} 字符`);
  if (!/^[A-Za-z0-9:_#\u4e00-\u9fa5.-]+$/.test(v)) bad(field, `${field} 含非法字符`);
  return v;
}
