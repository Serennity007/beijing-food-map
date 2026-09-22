import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ApiError, Store } from '@qianwei/contracts';
import { API_BASE_PATH, type AppConfig } from './env';
import { DocumentRepository, parseDump, type DocKind, type DumpedState, type JsonRecord } from './db/repository';
import { buildRouter, type Services } from './http/handlers';
import { buildOpenApi } from './http/openapi';
import { clientIp, classify, isExpectedClientError, readSessionCookie, sendFailure, sendOk, type Failure, type HttpHeaders } from './http/responses';
import { assertWriteAllowed, corsHeaders, RateLimiter } from './http/security';
import type { Ctx, RouteDef, Router as RouterType } from './http/router';
import type { DatabaseSync } from 'node:sqlite';

/**
 * HTTP 外壳：解析 → 校验形状 → 调 Store → 写穿持久化 → 信封输出。
 * 业务规则一律在 @qianwei/contracts 的 Store 内，这里不复制任何判断。
 */

export interface AppDeps {
  config: AppConfig;
  store: Store;
  repo: DocumentRepository;
  db: DatabaseSync;
  readiness: () => boolean;
}

export interface App {
  server: Server;
  router: RouterType;
  store: Store;
  repo: DocumentRepository;
  listen: () => Promise<number>;
  close: () => Promise<void>;
  /** 供测试断言：某类记录是否真的落盘。 */
  lastPersisted: () => DocKind[];
}

const ROOT_INFO = {
  name: '京城黔味地图 API',
  base_path: API_BASE_PATH,
  openapi: `${API_BASE_PATH}/openapi.json`,
  health: [`${API_BASE_PATH}/health/live`, `${API_BASE_PATH}/health/ready`],
  data_notice: '全部为合成测试数据（is_test_data=true），不代表真实门店、真实探店或真实票数。',
};

function rawSegments(url: string): { path: string[]; search: URLSearchParams } {
  const qi = url.indexOf('?');
  const rawPath = qi < 0 ? url : url.slice(0, qi);
  const search = new URLSearchParams(qi < 0 ? '' : url.slice(qi + 1));
  const segments: string[] = [];
  for (const seg of rawPath.split('/')) {
    if (seg === '') continue;
    try {
      segments.push(decodeURIComponent(seg));
    } catch {
      throw new ApiError('VALIDATION_ERROR', '路径含非法转义', 400);
    }
  }
  return { path: segments, search };
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buf.length;
    if (size > maxBytes) throw new ApiError('VALIDATION_ERROR', `请求体超过上限 ${maxBytes} 字节`, 400);
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') return {};
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError('VALIDATION_ERROR', '请求体必须是 JSON 对象', 400);
  }
  return parsed as JsonRecord;
}

/** 相对 /api/v1 的路径；也接受 /health/*、/openapi.json 与根路径别名（部署探针用）。 */
function toApiPath(segments: string[]): string[] | null {
  const base = API_BASE_PATH.split('/').filter((s) => s.length > 0);
  if (segments.length >= base.length && base.every((seg, i) => segments[i] === seg)) return segments.slice(base.length);
  const head = segments[0] ?? '';
  if (['health', 'openapi.json'].includes(head) || segments.length === 0) return segments;
  return null;
}

export function createApp(deps: AppDeps): App {
  const { config, store, repo } = deps;
  const logins = new RateLimiter(config.loginRateLimit.max, config.loginRateLimit.windowMs);
  const services: Services = { store, cfg: config, readiness: deps.readiness, logins };
  const router = buildRouter(services);
  let persisted: DocKind[] = [];

  const openApiOnce = buildOpenApi(router.all);

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = randomUUID();
    const cors = corsHeaders(config, req);
    const headers: HttpHeaders = { ...(cors ?? {}) };
    const method = (req.method ?? 'GET').toUpperCase();
    try {
      if (method === 'OPTIONS') {
        res.writeHead(204, { ...headers, 'access-control-max-age': '600' });
        res.end();
        return;
      }
      const { path, search } = rawSegments(req.url ?? '/');
      const apiPath = toApiPath(path);
      if (apiPath === null) throw new ApiError('NOT_FOUND', '接口不存在', 404);
      if (apiPath.length === 0) {
        sendOk(res, ROOT_INFO, { requestId }, headers);
        return;
      }
      if (apiPath.length === 1 && apiPath[0] === 'openapi.json') {
        if (method !== 'GET') throw new ApiError('NOT_FOUND', '接口不存在', 404);
        sendOk(res, openApiOnce, { requestId }, headers, 200);
        return;
      }
      const matched = router.match(method, apiPath);
      if (!matched) throw new ApiError('NOT_FOUND', '接口不存在', 404);
      assertWriteAllowed(config, req, method);

      const body = method === 'GET' || method === 'HEAD' ? {} : await readBody(req, config.maxBodyBytes);
      const sessionId = readSessionCookie(req);
      const ctx: Ctx = {
        store,
        req,
        res,
        requestId,
        params: matched.params,
        search,
        body,
        sessionId,
        ip: clientIp(req),
        secureCookie: config.nodeEnv === 'production',
        setCookie: [],
        user: () => store.requireUser(sessionId),
        uid: () => store.requireUser(sessionId).id,
      };
      const data = await matched.route.handler(ctx);
      const withCookies = (h: HttpHeaders): HttpHeaders => (ctx.setCookie.length ? { ...h, 'set-cookie': ctx.setCookie } : h);
      if (matched.route.raw) {
        // 处理器已自行写出字节流（图片），不再套信封
        if (!res.headersSent && !res.writableEnded) sendOk(res, data ?? null, { requestId }, withCookies(headers), matched.route.status ?? 200);
        return;
      }
      if (matched.route.writes) {
        persisted = repo.save(snapshot(store));
      }
      sendOk(res, data === undefined ? null : data, { requestId }, withCookies(headers), matched.route.status ?? 200);
    } catch (err) {
      const failure: Failure = classify(err);
      if (failure.status >= 500) {
        // 只记请求 id 与状态；不输出堆栈、环境变量或请求内容
        process.stderr.write(`[api] ${requestId} ${method} 未预期错误 -> ${failure.status}\n`);
      } else if (!isExpectedClientError(err)) {
        process.stderr.write(`[api] ${requestId} ${method} 请求被拒 -> ${failure.status} ${failure.code}\n`);
      }
      if (res.headersSent || res.writableEnded) {
        res.destroy();
        return;
      }
      sendFailure(res, failure, { requestId }, headers);
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res);
  });
  server.keepAliveTimeout = 5000;
  server.headersTimeout = 10_001;

  return {
    server,
    router,
    store,
    repo,
    listen: async () => {
      server.listen(config.port, config.host);
      await once(server, 'listening');
      const address = server.address();
      return typeof address === 'object' && address ? address.port : config.port;
    },
    close: async () => {
      if (server.listening) {
        server.close();
        await once(server, 'close');
      }
    },
    lastPersisted: () => persisted,
  };
}

export function snapshot(store: Store): DumpedState {
  return parseDump(store.dumpState());
}

export function routeKeys(routes: RouteDef[]): string[] {
  return routes.map((r) => `${r.method} ${r.path}`);
}
