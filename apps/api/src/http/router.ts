import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Store, UserRec } from '@qianwei/contracts';
import type { JsonRecord } from '../db/repository';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Ctx {
  store: Store;
  req: IncomingMessage;
  res: ServerResponse;
  requestId: string;
  /** 路径参数（已 percent-decode）。 */
  params: Record<string, string>;
  search: URLSearchParams;
  /** 已解析 JSON；无 body 时为 {}。 */
  body: JsonRecord;
  sessionId: string | null;
  ip: string;
  secureCookie: boolean;
  /** 处理器要写/清 Cookie 时往这里 push。 */
  setCookie: string[];
  /** Store.requireUser：无会话直接 401。 */
  user(): UserRec;
  uid(): string;
}

export type Handler = (ctx: Ctx) => unknown;

export interface RouteDef {
  method: HttpMethod;
  /** 相对 /api/v1 的模板，:name 为参数。 */
  path: string;
  summary: string;
  handler: Handler;
  /** 默认 200；创建类接口用 201。 */
  status?: number;
  /** 声明该接口会改动领域状态（写穿持久化对所有 2xx 都会跑，这里只做文档/日志用途）。 */
  writes?: boolean;
  /** 处理器自己写响应体（图片等非 JSON 资源）；返回 true 表示已写完。 */
  raw?: boolean;
}

interface Compiled {
  def: RouteDef;
  segments: string[];
  paramNames: string[];
}

export function splitPath(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

export class Router {
  private routes: Compiled[] = [];

  add(def: RouteDef): void {
    const segments = splitPath(def.path);
    const compiled: Compiled = {
      def,
      segments,
      paramNames: segments.filter((s) => s.startsWith(':')).map((s) => s.slice(1)),
    };
    this.routes.push(compiled);
    // 静态段优先：/restaurants/search 必须先于 /restaurants/:id 命中
    this.routes = [...this.routes].sort((a, b) => a.paramNames.length - b.paramNames.length || a.def.path.localeCompare(b.def.path));
  }

  match(method: string, segments: string[]): { route: Compiled['def']; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.def.method !== method) continue;
      if (r.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < r.segments.length; i += 1) {
        const pattern = r.segments[i]!;
        const value = segments[i]!;
        if (pattern.startsWith(':')) params[pattern.slice(1)] = value;
        else if (pattern !== value) {
          ok = false;
          break;
        }
      }
      if (ok) return { route: r.def, params };
    }
    return null;
  }

  get all(): RouteDef[] {
    return this.routes.map((r) => r.def);
  }
}
