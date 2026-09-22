import {
  ATTITUDES,
  BUSINESS_STATUSES,
  DISCLOSURES,
  ApiError,
  PLACE_STATUSES,
  RISK_STATUSES,
  Store,
  type CollectionItemRecord,
  type Disclosure,
  type ReportTicket,
  type Restaurant,
  type SessionUser,
  type SystemCollectionKind,
} from '@qianwei/contracts';
import type { AppConfig } from '../env';
import { Router, type Ctx, type RouteDef } from './router';
import { assertId, parseMapQuery } from './query';
import { RateLimiter } from './security';
import { sessionCookie, sendBinary } from './responses';
import { bBool, bDate, bEnum, bNumRaw, bStr, bStrArray, need } from './body';

const MODERATION_ACTIONS = ['approve', 'reject', 'hide'] as const;
const REPORT_KINDS: readonly ReportTicket['kind'][] = ['closed', 'wrong_location', 'wrong_info', 'abuse'];
const SYSTEM_KINDS: readonly SystemCollectionKind[] = ['want', 'visited', 'private_stash'];
const ENDORSEMENT_ACTIONS = ['verify', 'revoke'] as const;

export interface Services {
  store: Store;
  cfg: AppConfig;
  /** 就绪探针：真的往 SQLite 写一行再删掉。 */
  readiness: () => boolean;
  logins: RateLimiter;
}

function idParam(ctx: Ctx, name: string): string {
  return assertId(ctx.params[name] ?? '', name);
}

function idempotencyKey(ctx: Ctx): string | undefined {
  const header = ctx.req.headers['idempotency-key'];
  const fromHeader = typeof header === 'string' ? header.trim() : '';
  const fromBody = (bStr(ctx.body, 'idempotency_key', { max: 128 }) ?? '').trim();
  const key = fromHeader || fromBody;
  if (!key) return undefined;
  if (!/^[A-Za-z0-9:_#. -]{1,128}$/.test(key)) {
    throw new ApiError('VALIDATION_ERROR', 'Idempotency-Key 含非法字符', 400, { idempotency_key: '只允许字母、数字与 : _ # . -' });
  }
  return key;
}

function sessionUser(store: Store, sessionId: string | null): SessionUser | null {
  if (!sessionId) return null;
  try {
    return store.sessionUser(store.requireUser(sessionId).id);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return null;
    throw err;
  }
}

function submitInputFrom(ctx: Ctx, restaurantId: string) {
  return {
    restaurant_id: restaurantId,
    visited_date: need(bDate(ctx.body, 'visited_date', { required: true }), 'visited_date'),
    attitude: need(bEnum(ctx.body, 'attitude', ATTITUDES, { required: true }), 'attitude'),
    dish_names: bStrArray(ctx.body, 'dish_names', { max: 12, itemMax: 40 }),
    reason: bStr(ctx.body, 'reason', { required: true, max: 1000 }) ?? '',
    media_ids: bStrArray(ctx.body, 'media_ids', { max: 10, itemMax: 64 }),
    disclosure: bEnum<Disclosure>(ctx.body, 'disclosure', DISCLOSURES),
    idempotency_key: idempotencyKey(ctx),
    require_media_for_recommend: bBool(ctx.body, 'require_media_for_recommend', true),
  };
}

/** 审核返回体：Store.moderate 不返回门店，这里用公开方法补上（与 StaticClient 同逻辑）。 */
function moderateResult(store: Store, target: string): { ok: true; restaurant: Restaurant | null } {
  const visitId = target.split('#v')[0] ?? '';
  const visit = store.visits.find((v) => v.id === visitId);
  return { ok: true, restaurant: visit ? store.toDto(store.requireRestaurant(visit.restaurant_id)) : null };
}

/** 同时接受 expected_version（前端用的键）与 expectedVersion。 */
function expectedVersion(ctx: Ctx): number {
  const raw = ctx.body['expected_version'] ?? ctx.body['expectedVersion'];
  return need(bNumRaw(raw, 'expected_version', { required: true, integer: true, min: 1, max: 1_000_000 }), 'expected_version');
}

function collectionCopy<T extends { items: unknown[] }>(col: T): T {
  return { ...col, items: [...col.items] };
}

export function buildRouter(svc: Services): Router {
  const { store } = svc;
  const router = new Router();
  const routes: RouteDef[] = [
    // ------------------------------------------------------------ 运行状态
    {
      method: 'GET',
      path: '/health/live',
      summary: '进程存活（不触碰存储）',
      handler: () => ({ status: 'ok', service: 'qianwei-api' }),
    },
    {
      method: 'GET',
      path: '/health/ready',
      summary: '就绪：SQLite 文件可写且能读回',
      handler: () => {
        if (!svc.readiness()) throw new ApiError('PROVIDER_UNAVAILABLE', '存储未就绪，暂时无法处理请求', 503);
        return { status: 'ready' };
      },
    },
    { method: 'GET', path: '/today', summary: '服务器认定的 Asia/Shanghai 今天', handler: () => store.today() },

    // ------------------------------------------------------------ 地图与列表
    {
      method: 'GET',
      path: '/map/items',
      summary: '视野内地图实体（聚合或单店）',
      handler: (ctx) => {
        const parsed = parseMapQuery(ctx.search);
        return store.mapItems(parsed.query, parsed.snapshot);
      },
    },
    {
      method: 'GET',
      path: '/restaurants',
      summary: '与地图同一查询、同一快照的分页列表',
      handler: (ctx) => {
        const parsed = parseMapQuery(ctx.search);
        return store.listRestaurants(parsed.query, parsed.snapshot, parsed.cursor, parsed.limit);
      },
    },
    {
      method: 'GET',
      path: '/restaurants/search',
      summary: '站内搜索（自有门店 + 需人工核验的候选）',
      handler: (ctx) => {
        const q = ctx.search.get('q');
        if (q === null) throw new ApiError('VALIDATION_ERROR', '缺少查询词 q', 400, { q: '必填' });
        if (q.length > 50) throw new ApiError('VALIDATION_ERROR', '查询词最长 50 字符', 400, { q: '最长 50 字符' });
        return store.search(q);
      },
    },
    {
      method: 'GET',
      path: '/restaurants/:id',
      summary: '门店详情（缺失与私有统一 404）',
      handler: (ctx) => store.detail(idParam(ctx, 'id'), ctx.sessionId),
    },

    // ------------------------------------------------------------ 图片资源
    {
      method: 'GET',
      path: '/media/:id',
      summary: '图片字节流（未过审的只有作者与审核人员可读，其余一律 404）',
      raw: true,
      handler: (ctx) => {
        const mediaId = idParam(ctx, 'id');
        const asset = store.mediaOf(mediaId);
        // 可见性判断留在 Store：已过审公开，未过审只有作者与审核人员
        if (!asset || !store.canViewMedia(ctx.sessionId, mediaId)) {
          throw new ApiError('NOT_FOUND', '内容不存在', 404);
        }
        const dataUri = /^data:([^;,]+);base64,([\s\S]+)$/.exec(asset.url);
        if (!dataUri) throw new ApiError('NOT_FOUND', '内容不存在', 404);
        sendBinary(ctx.res, Buffer.from(dataUri[2]!, 'base64'), dataUri[1]!, { requestId: ctx.requestId });
        return undefined;
      },
    },
    {
      method: 'POST',
      path: '/uploads/test-photo',
      summary: 'demo 上传：登记一张标注为合成的图片（代替真实对象存储）',
      status: 201,
      writes: true,
      handler: (ctx) =>
        store.addTestMedia(ctx.sessionId, bStr(ctx.body, 'restaurant_id', { max: 64 })),
    },

    // ------------------------------------------------------------ 会话
    {
      method: 'POST',
      path: '/auth/login',
      summary: '内测账号登录（固定验证码只存在于 demo 环境）',
      writes: true,
      handler: (ctx) => {
        const userId = need(bStr(ctx.body, 'user_id', { required: true, max: 16 }), 'user_id');
        const code = need(bStr(ctx.body, 'code', { required: true, max: 16 }), 'code');
        const budget = svc.logins.take(`${ctx.ip}|${userId}`);
        if (!budget.ok) throw new ApiError('RATE_LIMITED', '登录尝试过于频繁，请稍后再试', 429);
        const r = store.login(userId, code);
        ctx.setCookie.push(sessionCookie(r.session_id, { secure: ctx.secureCookie }));
        return { user: r.user };
      },
    },
    {
      method: 'POST',
      path: '/auth/logout',
      summary: '注销当前会话',
      writes: true,
      handler: (ctx) => {
        if (ctx.sessionId) store.sessions.delete(ctx.sessionId);
        ctx.setCookie.push(sessionCookie('', { secure: ctx.secureCookie, clear: true }));
        return { ok: true };
      },
    },
    {
      method: 'GET',
      path: '/me',
      summary: '当前登录用户（未登录返回 data: null）',
      handler: (ctx) => sessionUser(store, ctx.sessionId),
    },
    {
      method: 'DELETE',
      path: '/me',
      summary: '注销账号：撤销会话与分享、隐藏 UGC、移出计票',
      writes: true,
      handler: (ctx) => {
        const r = store.deleteAccount(ctx.sessionId);
        ctx.setCookie.push(sessionCookie('', { secure: ctx.secureCookie, clear: true }));
        return r;
      },
    },
    {
      method: 'GET',
      path: '/me/submissions',
      summary: '我的投稿历史',
      handler: (ctx) => store.mySubmissions(ctx.sessionId),
    },
    {
      method: 'GET',
      path: '/me/reports',
      summary: '我提交的举报',
      handler: (ctx) => store.myReports(ctx.sessionId),
    },

    // ------------------------------------------------------------ 投稿与反馈
    {
      method: 'POST',
      path: '/submissions',
      status: 201,
      summary: '提交实吃反馈（Idempotency-Key 幂等）',
      writes: true,
      handler: (ctx) => {
        const rid = need(bStr(ctx.body, 'restaurant_id', { required: true, max: 16 }), 'restaurant_id');
        return store.submitFeedback(submitInputFrom(ctx, assertId(rid, 'restaurant_id')), ctx.sessionId).submission;
      },
    },
    {
      method: 'PUT',
      path: '/restaurants/:id/my-feedback',
      summary: '对该门店提交/更新我的反馈',
      writes: true,
      handler: (ctx) => store.submitFeedback(submitInputFrom(ctx, idParam(ctx, 'id')), ctx.sessionId).submission,
    },
    {
      method: 'DELETE',
      path: '/restaurants/:id/my-feedback',
      summary: '撤回我的反馈（不复活更早版本）',
      writes: true,
      handler: (ctx) => store.withdrawMyFeedback(idParam(ctx, 'id'), ctx.sessionId),
    },
    {
      method: 'PUT',
      path: '/restaurants/:id/collection-item',
      summary: '系统清单（想吃/吃过/私藏）开关',
      writes: true,
      handler: (ctx) => {
        const rid = idParam(ctx, 'id');
        const kind = need(bEnum<SystemCollectionKind>(ctx.body, 'kind', SYSTEM_KINDS, { required: true }), 'kind');
        const on = bBool(ctx.body, 'on', true);
        return store.toggleSystemCollectionItem(ctx.uid(), rid, kind, on);
      },
    },

    // ------------------------------------------------------------ 清单
    {
      method: 'GET',
      path: '/collections',
      summary: '我的全部清单（含系统清单）',
      handler: (ctx) => store.listCollectionsForUser(ctx.uid()),
    },
    {
      method: 'POST',
      path: '/collections',
      status: 201,
      summary: '新建自定义清单',
      writes: true,
      handler: (ctx) =>
        store.createCollection(
          ctx.uid(),
          need(bStr(ctx.body, 'title', { required: true, max: 60 }), 'title'),
          bStr(ctx.body, 'description', { max: 300 }),
        ),
    },
    {
      method: 'GET',
      path: '/collections/:id',
      summary: '清单详情（他人清单统一 404，不泄露存在性）',
      handler: (ctx) => collectionCopy(store.requireCollection(idParam(ctx, 'id'), ctx.uid())),
    },
    {
      method: 'PATCH',
      path: '/collections/:id',
      summary: '改标题/描述',
      writes: true,
      handler: (ctx) => {
        const col = store.requireCollection(idParam(ctx, 'id'), ctx.uid());
        if (ctx.body['title'] !== undefined) {
          const title = bStr(ctx.body, 'title', { max: 60 });
          if (!title) throw new ApiError('VALIDATION_ERROR', '标题必填', 400, { title: '请输入标题' });
          col.title = title;
        }
        if (ctx.body['description'] !== undefined) col.description = bStr(ctx.body, 'description', { max: 300 });
        col.version += 1;
        col.updated_at = new Date(store.now()).toISOString();
        return collectionCopy(col);
      },
    },
    {
      method: 'DELETE',
      path: '/collections/:id',
      summary: '删除清单并撤销其发布',
      writes: true,
      handler: (ctx) => store.deleteCollection(idParam(ctx, 'id'), ctx.uid()),
    },
    {
      method: 'PUT',
      path: '/collections/:id/items/:restaurantId',
      summary: '新增或更新清单条目（笔记/可公开/排序）',
      writes: true,
      handler: (ctx) => {
        const patch: Partial<CollectionItemRecord> & { remove?: boolean } = {};
        if (ctx.body['note'] !== undefined) patch.note = bStr(ctx.body, 'note', { max: 300 });
        if (ctx.body['note_shareable'] !== undefined) patch.note_shareable = bBool(ctx.body, 'note_shareable', false);
        if (ctx.body['position'] !== undefined) patch.position = bNumRaw(ctx.body['position'], 'position', { integer: true, min: 0, max: 999 }) ?? 0;
        if (ctx.body['media_ids'] !== undefined) patch.media_ids = bStrArray(ctx.body, 'media_ids', { max: 10, itemMax: 64 });
        return store.updateCollectionItem(idParam(ctx, 'id'), idParam(ctx, 'restaurantId'), patch, ctx.uid());
      },
    },
    {
      method: 'DELETE',
      path: '/collections/:id/items/:restaurantId',
      summary: '移除条目',
      writes: true,
      handler: (ctx) =>
        store.updateCollectionItem(idParam(ctx, 'id'), idParam(ctx, 'restaurantId'), { remove: true }, ctx.uid()),
    },
    {
      method: 'POST',
      path: '/collections/:id/publication-requests',
      status: 201,
      summary: '申请公开清单（进入人工审核）',
      writes: true,
      handler: (ctx) => {
        const ids = bStrArray(ctx.body, 'share_item_ids', { max: 50, itemMax: 16 });
        const pub = store.requestPublication(idParam(ctx, 'id'), ctx.uid(), ids);
        return { id: pub.id, status: pub.status, generation: pub.generation };
      },
    },
    {
      method: 'POST',
      path: '/collections/:id/unpublish',
      summary: '撤回公开（同一事务递增 generation，旧 token 永不恢复）',
      writes: true,
      handler: (ctx) => store.unpublishCollection(idParam(ctx, 'id'), ctx.uid()),
    },
    {
      method: 'GET',
      path: '/shared-collections/:token',
      summary: '公开分享快照（无需登录）',
      handler: (ctx) => store.sharedSnapshot(assertId(ctx.params['token'] ?? '', 'token', 80)),
    },

    // ------------------------------------------------------------ 举报
    {
      method: 'POST',
      path: '/reports',
      status: 201,
      summary: '举报门店问题（闭店结论仍需人工确认证据）',
      writes: true,
      handler: (ctx) =>
        store.createReport(
          {
            restaurant_id: assertId(need(bStr(ctx.body, 'restaurant_id', { required: true, max: 16 }), 'restaurant_id'), 'restaurant_id'),
            kind: need(bEnum<ReportTicket['kind']>(ctx.body, 'kind', REPORT_KINDS, { required: true }), 'kind'),
            detail: bStr(ctx.body, 'detail', { required: true, max: 500 }) ?? '',
          },
          ctx.sessionId,
        ),
    },

    // ------------------------------------------------------------ 后台
    { method: 'GET', path: '/admin/queue', summary: '审核队列（作者不能自审）', handler: (ctx) => store.moderationQueue(ctx.sessionId) },
    {
      method: 'GET',
      path: '/admin/audit-log',
      summary: '审计日志（最近 200 条倒序，仅审核人员可读）',
      handler: (ctx) => store.auditLog(ctx.sessionId),
    },
    {
      method: 'POST',
      path: '/admin/moderation/:target/actions',
      summary: '审核动作（乐观锁，版本冲突 409）',
      writes: true,
      handler: (ctx) => {
        const target = normalizeTarget(ctx.params['target'] ?? '');
        const action = need(bEnum(ctx.body, 'action', MODERATION_ACTIONS, { required: true }), 'action');
        const result = store.moderate(
          { target, action, reason: bStr(ctx.body, 'reason', { max: 300 }) ?? undefined, expected_version: expectedVersion(ctx) },
          ctx.sessionId,
        );
        return { ...result, ...moderateResult(store, target) };
      },
    },
    {
      method: 'PATCH',
      path: '/admin/restaurants/:id/status',
      summary: '核验/营业/风险状态变更（旧址票只作历史）',
      writes: true,
      handler: (ctx) =>
        store.patchRestaurantStatus(
          {
            id: idParam(ctx, 'id'),
            place_status: bEnum(ctx.body, 'place_status', PLACE_STATUSES) ?? undefined,
            business_status: bEnum(ctx.body, 'business_status', BUSINESS_STATUSES) ?? undefined,
            risk_status: bEnum(ctx.body, 'risk_status', RISK_STATUSES) ?? undefined,
            reason: bStr(ctx.body, 'reason', { max: 300 }) ?? undefined,
          },
          ctx.sessionId,
        ),
    },
    {
      method: 'POST',
      path: '/admin/restaurants/:id/merge',
      summary: '门店合并（旧 ID 永久重定向）',
      writes: true,
      handler: (ctx) =>
        store.mergeRestaurants(
          {
            source_id: idParam(ctx, 'id'),
            target_id: assertId(need(bStr(ctx.body, 'target_id', { required: true, max: 16 }), 'target_id'), 'target_id'),
            reason: bStr(ctx.body, 'reason', { required: true, max: 300 }) ?? '',
            expected_version: expectedVersion(ctx),
          },
          ctx.sessionId,
        ),
    },
    {
      method: 'POST',
      path: '/admin/editorial-endorsements/verify',
      summary: '核验编辑背书（背书作者即使身兼管理员也不能自审）',
      writes: true,
      handler: (ctx) => endorse(ctx, store, 'verify'),
    },
    {
      method: 'POST',
      path: '/admin/editorial-endorsements/revoke',
      summary: '撤回编辑背书',
      writes: true,
      handler: (ctx) => endorse(ctx, store, 'revoke'),
    },
  ];

  for (const r of routes) router.add(r);
  return router;
}

function endorse(ctx: Ctx, store: Store, action: (typeof ENDORSEMENT_ACTIONS)[number]) {
  return store.restoreEndorsement(
    {
      restaurant_id: assertId(need(bStr(ctx.body, 'restaurant_id', { required: true, max: 16 }), 'restaurant_id'), 'restaurant_id'),
      action,
      reason: bStr(ctx.body, 'reason', { max: 300 }) ?? undefined,
    },
    ctx.sessionId,
  );
}

/**
 * 审核目标在路径里，而 # 不能出现在 URL 路径中：
 * 前端用 V0092%23v1（解码后含 #v）；也兼容带分隔符的 V0092:v1 / V0092_v1。
 * 发布申请 PUB0001 这类不含分隔符的目标原样透传。
 */
export function normalizeTarget(raw: string): string {
  const t = raw.trim();
  if (!t) throw new ApiError('VALIDATION_ERROR', '审核目标必填', 400, { target: '必填' });
  if (t.length > 80 || !/^[A-Za-z0-9:_#.\u4e00-\u9fa5-]+$/i.test(t)) {
    throw new ApiError('VALIDATION_ERROR', '审核目标含非法字符', 400, { target: '形如 V0092%23v1' });
  }
  if (t.includes('#v')) return t;
  const m = /^(.*?)[_:]v?(\d+)$/i.exec(t);
  if (m && m[1] && m[2]) return `${m[1]}#v${m[2]}`;
  return t;
}
