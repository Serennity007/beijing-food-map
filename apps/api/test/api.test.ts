import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, QUERY, REASON, serverToday, start, submitBody, type Harness } from './helpers';
import { normalizeTarget } from '../src/http/handlers';
import { routeKeys } from '../src/app';
import type { MapItemsResponse, Page, Restaurant, Submission } from '@qianwei/contracts';

const openers: Array<() => Promise<void>> = [];
async function withServer(): Promise<Harness> {
  const h = await start();
  openers.push(() => h.close());
  return h;
}

after(async () => {
  for (const close of openers) await close();
  openers.length = 0;
});

describe('运行状态', () => {
  test('health/live 与 health/ready 返回信封且不泄露内部信息', async () => {
    const h = await withServer();
    const live = await new Client(h.base).get<{ status: string }>('/health/live');
    assert.equal(live.status, 200);
    assert.equal(live.data?.status, 'ok');
    assert.ok(live.meta?.requestId);

    const ready = await new Client(h.base).get<{ status: string }>('/health/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.data, { status: 'ready' });
    assert.equal(JSON.stringify(ready.data).includes('sqlite'), false);
    assert.equal(JSON.stringify(ready.data).includes(h.cfg.sqlitePath), false);

    // 根路径别名（部署探针）
    const alias = await fetch(`${h.base.replace(/\/api\/v1$/, '')}/health/live`);
    assert.equal(alias.status, 200);
  });
});

describe('地图与列表', () => {
  test('低 zoom 返回聚合，snapshot 在 /map/items 与 /restaurants 之间共用', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    const items = await c.get<MapItemsResponse>(`/map/items${QUERY}`);
    assert.equal(items.status, 200);
    assert.equal(items.data?.mode, 'clusters');
    assert.ok((items.data?.total_matched ?? 0) > 0, 'totalMatched 应大于 0');
    assert.equal(items.data?.coord_system, 'GCJ02');
    const snapshot = items.data?.snapshot_id ?? '';
    assert.ok(snapshot.startsWith('snap-'));

    const page = await c.get<Page<Restaurant>>(`/restaurants${QUERY}&snapshot=${snapshot}&limit=5`);
    assert.equal(page.status, 200);
    assert.equal(page.data?.snapshot_id, snapshot, '列表必须复用同一快照');
    assert.equal(page.data?.items.length, 5);
    const firstPageIds = new Set((page.data?.items ?? []).map((r) => r.id));
    assert.ok(page.data?.next_cursor && !firstPageIds.has(page.data.next_cursor), 'next_cursor 指向下一页首条');

    // 翻页游标继续可用（同一快照）
    const next = await c.get<Page<Restaurant>>(`/restaurants${QUERY}&snapshot=${snapshot}&cursor=${page.data?.next_cursor}&limit=5`);
    assert.equal(next.status, 200);
    assert.notEqual(next.data?.items[0]?.id, page.data?.items[0]?.id);

    // 同一快照再次取地图也允许（说明两侧规范化查询一致）
    const again = await c.get<MapItemsResponse>(`/map/items${QUERY}&snapshot=${snapshot}`);
    assert.equal(again.status, 200);
    assert.equal(again.data?.snapshot_id, snapshot);

    // 换个查询条件再拿同一快照：指纹不同 -> 409
    const other = await c.get<MapItemsResponse>(`/map/items${QUERY.replace('view=southwest', 'view=guizhou')}&snapshot=${snapshot}`);
    assert.equal(other.status, 409);
    assert.equal(other.error?.code, 'QUERY_EXPIRED');
  });

  test('limit 超上限与非法枚举返回 400 + fieldErrors', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    const tooBig = await c.get(`/restaurants${QUERY}&limit=51`);
    assert.equal(tooBig.status, 400);
    assert.equal(tooBig.error?.code, 'VALIDATION_ERROR');
    assert.ok(tooBig.error?.fieldErrors?.limit);

    const badView = await c.get(`/map/items?west=116&south=39&east=117&north=40&zoom=12&view=川渝`);
    assert.equal(badView.status, 400);
    assert.equal(badView.error?.code, 'VALIDATION_ERROR');
    assert.ok(badView.error?.fieldErrors?.view);

    const halfBounds = await c.get('/map/items?west=116.4&zoom=12');
    assert.equal(halfBounds.status, 400);
    assert.ok(halfBounds.error?.fieldErrors?.bounds);

    const notNumber = await c.get('/map/items?west=abc&south=39&east=117&north=40&zoom=12');
    assert.equal(notNumber.status, 400);
    assert.ok(notNumber.error?.fieldErrors?.west);
  });

  test('详情：不存在与私有统一 404；搜索给出候选但标明需核验', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    const missing = await c.get('/restaurants/NOPE');
    assert.equal(missing.status, 404);
    assert.equal(missing.error?.code, 'NOT_FOUND');

    const detail = await c.get<{ id: string; feedback_page: { items: unknown[] }; my_current_feedback: unknown }>('/restaurants/R01');
    assert.equal(detail.status, 200);
    assert.equal(detail.data?.id, 'R01');
    assert.equal(detail.data?.my_current_feedback, null, '未登录时不带个人反馈');
    assert.ok(detail.data!.feedback_page.items.length > 0);

    const search = await c.get<{ own: Restaurant[]; provider_candidates: unknown[] }>('/restaurants/search?q=%E9%85%B8%E6%B1%A4');
    assert.equal(search.status, 200);
    assert.ok(search.data && search.data.own.length > 0);

    const empty = await c.get<{ own: unknown[]; provider_candidates: { name: string }[] }>('/restaurants/search?q=%E6%89%BE%E4%B8%8D%E5%88%B0%E7%9A%84%E5%BA%97');
    assert.ok(empty.data && empty.data.own.length === 0);
    assert.ok(empty.data && empty.data.provider_candidates.length === 1);
    assert.match(empty.data!.provider_candidates[0]!.name, /未入库/);

    const noQ = await c.get('/restaurants/search');
    assert.equal(noQ.status, 400);
  });
});

describe('会话与权限', () => {
  test('写接口无会话 401；登录下发 HttpOnly Cookie；logout 清 Cookie', async () => {
    const h = await withServer();
    const today = await serverToday(h);
    const anon = new Client(h.base);
    const denied = await anon.req('POST', '/submissions', { body: submitBody(today) });
    assert.equal(denied.status, 401);
    assert.equal(denied.error?.code, 'UNAUTHORIZED');
    assert.equal(denied.headers.get('set-cookie'), null);

    const u = new Client(h.base);
    const login = await u.login('U01');
    assert.equal(login.status, 200);
    assert.equal(login.data?.user.id, 'U01');
    assert.ok(u.cookie);
    const setCookie = login.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Path=\//);
    assert.doesNotMatch(setCookie, /Secure/); // 非 production 不加 Secure
    assert.equal(JSON.stringify(login.data).includes('session_id'), false, '会话 id 不进响应体');

    const me = await u.get<{ id: string }>('/me');
    assert.equal(me.data?.id, 'U01');

    const wrongCode = await new Client(h.base).login('U01', '123456');
    assert.equal(wrongCode.status, 400);
    assert.equal(wrongCode.error?.code, 'VALIDATION_ERROR');

    const out = await u.req('POST', '/auth/logout');
    assert.equal(out.status, 200);
    assert.equal(u.cookie, null);
  });

  test('/admin/* 需要审核角色：普通用户 403，审核员 200', async () => {
    const h = await withServer();
    const user = new Client(h.base);
    await user.login('U01');
    const forbidden = await user.get('/admin/queue');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.error?.code, 'FORBIDDEN');
    const alsoForbidden = await user.req('PATCH', '/admin/restaurants/R01/status', { body: { business_status: 'OPEN' } });
    assert.equal(alsoForbidden.status, 403);

    const mod = new Client(h.base);
    await mod.login('M01');
    const queue = await mod.get<{ id: string; is_author_self: boolean }[]>('/admin/queue');
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(queue.data));
    assert.ok((queue.data ?? []).length > 0);
    assert.ok((queue.data ?? []).every((e) => typeof e.is_author_self === 'boolean'));
  });

  test('跨账号私有资源统一 404（不泄露存在性）', async () => {
    const h = await withServer();
    const owner = new Client(h.base);
    await owner.login('U01');
    const mine = await owner.get<{ id: string }>('/collections/COL0001');
    assert.equal(mine.status, 200);
    assert.equal(mine.data?.id, 'COL0001');

    const other = new Client(h.base);
    await other.login('U02');
    const stolen = await other.get('/collections/COL0001');
    assert.equal(stolen.status, 404, '他人的清单必须 404 而不是 403');
    assert.equal(stolen.error?.code, 'NOT_FOUND');
    const patchStolen = await other.req('PATCH', '/collections/COL0001', { body: { title: '改写' } });
    assert.equal(patchStolen.status, 404);
    const deleteStolen = await other.req('DELETE', '/collections/COL0001');
    assert.equal(deleteStolen.status, 404);
  });

  test('登录按 IP+账号限流 -> 429 RATE_LIMITED', async () => {
    const h = await start({ loginRateLimit: { max: 2, windowMs: 60_000 } });
    openers.push(() => h.close());
    const results = await Promise.all([0, 1, 2, 3].map(() => new Client(h.base).login('U03')));
    assert.equal(results[0]?.status, 200);
    assert.equal(results[1]?.status, 200);
    assert.equal(results[2]?.status, 429);
    assert.equal(results[2]?.error?.code, 'RATE_LIMITED');
    // 另一个账号不受影响（按 IP+user 计数）
    const otherUser = await new Client(h.base).login('U04');
    assert.equal(otherUser.status, 200);
  });
});

describe('投稿、幂等与审核', () => {
  test('理由不足 20 字 -> 400 VALIDATION_ERROR + fieldErrors', async () => {
    const h = await withServer();
    const today = await serverToday(h);
    const c = new Client(h.base);
    await c.login('U01');
    const short = await c.req('POST', '/submissions', { body: submitBody(today, { reason: '太短了' }) });
    assert.equal(short.status, 400);
    assert.equal(short.error?.code, 'VALIDATION_ERROR');
    assert.equal(short.error?.fieldErrors?.reason, '至少 20 字');

    const noDisclosure = await c.req('POST', '/submissions', { body: submitBody(today, { disclosure: null }) });
    assert.equal(noDisclosure.status, 400);
    assert.ok(noDisclosure.error?.fieldErrors?.disclosure);

    const future = await c.req('POST', '/submissions', { body: submitBody(today, { visited_date: '2999-01-01' }) });
    assert.equal(future.status, 400);

    const recommendNoDish = await c.req('POST', '/submissions', { body: submitBody(today, { dish_names: [] }) });
    assert.equal(recommendNoDish.status, 400);
    assert.ok(recommendNoDish.error?.fieldErrors?.dish_names);
  });

  test('Idempotency-Key：同键同内容返回同结果，同键换内容 409', async () => {
    const h = await withServer();
    const today = await serverToday(h);
    const c = new Client(h.base);
    await c.login('U01');
    const body = submitBody(today);
    const first = await c.req<Submission>('POST', '/submissions', { body, headers: { 'idempotency-key': 'k-demo-1' } });
    assert.equal(first.status, 201);
    const replay = await c.req<Submission>('POST', '/submissions', { body, headers: { 'idempotency-key': 'k-demo-1' } });
    assert.equal(replay.status, 201);
    assert.equal(replay.data?.id, first.data?.id, '重放返回同一投稿');
    assert.equal(replay.data?.version, first.data?.version);

    const list = await c.get<Submission[]>('/me/submissions');
    const countBefore = list.data!.filter((s) => s.id === first.data?.id).length;
    await c.req<Submission>('POST', '/submissions', { body, headers: { 'idempotency-key': 'k-demo-1' } });
    const countAfter = (await c.get<Submission[]>('/me/submissions')).data!.filter((s) => s.id === first.data?.id).length;
    assert.equal(countAfter, countBefore, '重放不得新增版本');

    const conflict = await c.req<Submission>('POST', '/submissions', {
      body: submitBody(today, { reason: `${'换成完全不同的内容，长度也足够二十字以上，用来触发幂等冲突。'.repeat(2)}` }),
      headers: { 'idempotency-key': 'k-demo-1' },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.error?.code, 'IDEMPOTENCY_CONFLICT');

    const otherUserSameKey = new Client(h.base);
    await otherUserSameKey.login('U02');
    // 图片归属必须与投稿人一致：先走 demo 上传接口拿一张 U02 自己的合成图
    const uploaded = await otherUserSameKey.req<{ id: string }>('POST', '/uploads/test-photo', { body: { restaurant_id: 'R17' } });
    assert.equal(uploaded.status, 201);
    assert.match(uploaded.data!.id, /^MM/);
    const independent = await otherUserSameKey.req<Submission>('POST', '/submissions', {
      body: submitBody(today, { media_ids: [uploaded.data!.id] }),
      headers: { 'idempotency-key': 'k-demo-1' },
    });
    assert.equal(independent.status, 201, '幂等键按用户隔离');
    const foreign = await new Client(h.base).get<{ owner_user_id: string }>(`/media/${uploaded.data!.id}`);
    assert.equal(foreign.status, 404, '未过审的图对匿名访问者 404');
  });

  test('审核通过写穿，并且 admin patch 让旧快照 409', async () => {
    const h = await withServer();
    const today = await serverToday(h);
    const author = new Client(h.base);
    await author.login('U01');
    const submitted = await author.req<Submission>('POST', '/submissions', { body: submitBody(today) });
    assert.equal(submitted.status, 201);
    const target = submitted.data!.id;
    const version = submitted.data!.version;

    const mod = new Client(h.base);
    await mod.login('M01');
    const queue = await mod.get<{ id: string }[]>('/admin/queue');
    assert.ok(queue.data!.some((e) => e.id === target), '队列里能找到这条待审投稿');

    const conflict = await mod.req('POST', `/admin/moderation/${encodeURIComponent(target)}/actions`, {
      body: { action: 'approve', reason: '测试通过', expected_version: version + 5 },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.error?.code, 'VERSION_CONFLICT');

    const approved = await mod.req<{ ok: boolean; restaurant: Restaurant | null }>(
      'POST',
      `/admin/moderation/${encodeURIComponent(target)}/actions`,
      { body: { action: 'approve', reason: '测试通过', expected_version: version } },
    );
    assert.equal(approved.status, 200);
    assert.equal(approved.data?.ok, true);
    assert.equal(approved.data?.restaurant?.id, 'R17');

    const colonForm = await mod.req('POST', `/admin/moderation/${normalizeTarget(target).replace('#v', ':')}/actions`, {
      body: { action: 'approve', reason: '重复审核', expected_version: version },
    });
    assert.equal(colonForm.status, 409, '已处理过的版本再批准应 409');

    // 快照在结果集版本变化后失效；R17 种子为 VERIFIED，改成 PENDING 才会递增 location_version
    const fresh = await author.get<MapItemsResponse>(`/map/items${QUERY}`);
    const snap = fresh.data!.snapshot_id;
    const patched = await mod.req<Restaurant>('PATCH', '/admin/restaurants/R17/status', {
      body: { place_status: 'PENDING', reason: '测试改回待核验' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data?.place_status, 'PENDING');
    assert.ok((patched.data?.location_version ?? 0) > 1, '变更核验状态要递增 location_version');
    const expired = await author.get<MapItemsResponse>(`/map/items${QUERY}&snapshot=${snap}`);
    assert.equal(expired.status, 409);
    assert.equal(expired.error?.code, 'QUERY_EXPIRED');
    const listExpired = await author.get(`/restaurants${QUERY}&snapshot=${snap}`);
    assert.equal(listExpired.status, 409);
  });

  test('撤回反馈后不复活旧版本；举报与我的举报可读', async () => {
    const h = await withServer();
    const today = await serverToday(h);
    const c = new Client(h.base);
    await c.login('U01');
    const detail = await c.get<{ id: string; my_current_feedback: { content_status: string } | null }>('/restaurants/R01');
    assert.equal(detail.data?.my_current_feedback?.content_status, 'APPROVED');

    // PUT 我的反馈：更新同一 visit 的新版本（图片必须仍是本人名下的 MMF001）
    const updated = await c.req<Submission>('PUT', '/restaurants/R01/my-feedback', {
      body: submitBody(today, { reason: `${REASON}（第二次修改，仍是合成内容）` }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data?.id, 'VF001#v2');

    const withdrawn = await c.req('DELETE', '/restaurants/R01/my-feedback');
    assert.equal(withdrawn.status, 200);
    assert.deepEqual(withdrawn.data, { ok: true });
    const after = await c.get<{ my_current_feedback: unknown }>('/restaurants/R01');
    assert.equal(after.data?.my_current_feedback, null, '撤回后不应再显示我的当前反馈');
    const again = await c.req('DELETE', '/restaurants/R01/my-feedback');
    assert.equal(again.status, 404);

    const report = await c.req<{ id: string }>('POST', '/reports', { body: { restaurant_id: 'R08', kind: 'closed', detail: '测试举报（合成）：卷闸门贴着闭店告示。' } });
    assert.equal(report.status, 201);
    const mine = await c.get<{ id: string; restaurant_id: string }[]>('/me/reports');
    assert.ok(mine.data!.some((r) => r.id === report.data?.id));
    const badKind = await c.req('POST', '/reports', { body: { restaurant_id: 'R08', kind: 'spam', detail: '非法 kind' } });
    assert.equal(badKind.status, 400);
  });
});

describe('清单与分享', () => {
  test('建清单、加条目、申请公开、撤回后旧 token 失效', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    await c.login('U01');
    const created = await c.req<{ id: string; version: number }>('POST', '/collections', { body: { title: '测试·HTTP 清单', description: '合成数据' } });
    assert.equal(created.status, 201);
    const colId = created.data!.id;

    const patched = await c.req<{ title: string; version: number }>('PATCH', `/collections/${colId}`, { body: { title: '测试·改名' } });
    assert.equal(patched.status, 200);
    assert.equal(patched.data?.title, '测试·改名');
    assert.ok((patched.data?.version ?? 0) > (created.data?.version ?? 0));

    const item = await c.req<{ items: { restaurant_id: string; note_shareable: boolean }[] }>(
      'PUT',
      `/collections/${colId}/items/R01`,
      { body: { note: '测试笔记', note_shareable: true, position: 0 } },
    );
    assert.equal(item.status, 200);
    assert.equal(item.data?.items[0]?.restaurant_id, 'R01');
    assert.equal(item.data?.items[0]?.note_shareable, true);

    const pub = await c.req<{ id: string; status: string; generation: number }>('POST', `/collections/${colId}/publication-requests`, {
      body: { share_item_ids: ['R01'] },
    });
    assert.equal(pub.status, 201);
    assert.equal(pub.data?.status, 'PENDING_REVIEW');

    const mod = new Client(h.base);
    await mod.login('M01');
    const approved = await mod.req('POST', `/admin/moderation/${pub.data?.id}/actions`, {
      body: { action: 'approve', reason: '同意公开', expected_version: pub.data?.generation },
    });
    assert.equal(approved.status, 200);
    const published = await c.get<{ active_token: string | null }>(`/collections/${colId}`);
    const token = published.data?.active_token;
    assert.ok(token);
    const shared = await new Client(h.base).get<{ items: { pending_verification: boolean }[] }>(`/shared-collections/${token}`);
    assert.equal(shared.status, 200);
    assert.equal(shared.data?.items[0]?.pending_verification, false);

    const unpublished = await c.req<{ active_token: string | null }>('POST', `/collections/${colId}/unpublish`);
    assert.equal(unpublished.status, 200);
    assert.equal(unpublished.data?.active_token, null);
    const revoked = await new Client(h.base).get(`/shared-collections/${token}`);
    assert.equal(revoked.status, 404, '撤回后旧 token 永不恢复');

    const removed = await c.req<{ items: unknown[] }>('DELETE', `/collections/${colId}/items/R01`);
    assert.equal(removed.status, 200);
    assert.equal(removed.data?.items.length, 0);
    const deleted = await c.req('DELETE', `/collections/${colId}`);
    assert.deepEqual(deleted.data, { ok: true });
    const gone = await c.get(`/collections/${colId}`);
    assert.equal(gone.status, 404);
  });

  test('系统清单开关保持互斥：想吃与吃过不能同时命中', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    await c.login('U01');
    const on = await c.req<{ id: string; items: { restaurant_id: string }[] }[]>('PUT', '/restaurants/R03/collection-item', {
      body: { kind: 'want', on: true },
    });
    assert.equal(on.status, 200);
    const want = on.data!.find((x) => x.id === 'SYS-U01-want');
    const visited = on.data!.find((x) => x.id === 'SYS-U01-visited');
    assert.ok(want?.items.some((i) => i.restaurant_id === 'R03'));
    assert.ok(!visited?.items.some((i) => i.restaurant_id === 'R03'));

    const off = await c.req<{ id: string; items: { restaurant_id: string }[] }[]>('PUT', '/restaurants/R03/collection-item', {
      body: { kind: 'want', on: false },
    });
    assert.ok(!off.data!.find((x) => x.id === 'SYS-U01-want')?.items.some((i) => i.restaurant_id === 'R03'));
    const badKind = await c.req('PUT', '/restaurants/R03/collection-item', { body: { kind: 'shopping', on: true } });
    assert.equal(badKind.status, 400);
  });

  test('背书与合并：作者不能自审、合并需要 admin 且校验版本', async () => {
    const h = await withServer();
    const mod = new Client(h.base);
    await mod.login('M01');
    const revoke = await mod.req<Restaurant>('POST', '/admin/editorial-endorsements/revoke', {
      body: { restaurant_id: 'R05', reason: '测试撤回背书' },
    });
    assert.equal(revoke.status, 200);
    assert.equal(revoke.data?.endorsement, 'REVOKED');
    const verifySelf = await (async () => {
      const editor = new Client(h.base);
      await editor.login('E01'); // E01 是 R05 背书的作者，即使有 editor 角色也不是审核者
      return editor.req('POST', '/admin/editorial-endorsements/verify', { body: { restaurant_id: 'R05' } });
    })();
    assert.equal(verifySelf.status, 403, '无审核角色先 403');

    const admin = new Client(h.base);
    await admin.login('A01');
    const verify = await admin.req<Restaurant>('POST', '/admin/editorial-endorsements/verify', { body: { restaurant_id: 'R05' } });
    assert.equal(verify.status, 200);
    assert.equal(verify.data?.endorsement, 'ACTIVE');

    const mergeByMod = await mod.req('POST', '/admin/restaurants/R02/merge', {
      body: { target_id: 'R01', reason: '同一实体', expected_version: 1 },
    });
    assert.equal(mergeByMod.status, 403, '合并仅限 admin');
    const merged = await admin.req<{ canonical: string }>('POST', '/admin/restaurants/R02/merge', {
      body: { target_id: 'R01', reason: '同一实体重复候选', expected_version: 1 },
    });
    assert.equal(merged.status, 200);
    assert.equal(merged.data?.canonical, 'R01');
    const redirected = await admin.get<Restaurant>('/restaurants/R02');
    assert.equal(redirected.data?.id, 'R01', '旧 ID 永久重定向到 canonical');
    const conflictMerge = await admin.req('POST', '/admin/restaurants/R03/merge', {
      body: { target_id: 'R04', reason: '版本不对', expected_version: 99 },
    });
    assert.equal(conflictMerge.status, 409);
  });
});

describe('文档与安全边界', () => {
  test('openapi.json 覆盖全部路由，且没有未文档化条目', async () => {
    const h = await withServer();
    const res = await new Client(h.base).get<{
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
      'x-undocumented-routes': string[];
    }>('/openapi.json');
    assert.equal(res.status, 200);
    assert.equal(res.data?.openapi, '3.0.3');
    const documented = Object.entries(res.data!.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((m) => `${m.toUpperCase()} ${path.replace(/\{[^}]+\}/g, (seg) => `:${seg.slice(1, -1)}`)}`),
    );
    const routes = routeKeys(h.booted.app.router.all);
    assert.deepEqual([...documented].sort(), [...routes].sort());
    assert.deepEqual(res.data?.['x-undocumented-routes'], []);
    assert.ok(res.data!.components.schemas.Restaurant);
    assert.ok(res.data!.components.securitySchemes.cookieAuth);

    const missing = await new Client(h.base).get('/nope/nothing');
    assert.equal(missing.status, 404);
    assert.equal(missing.error?.message, '接口不存在');
  });

  test('写请求带非白名单 Origin -> 403；白名单 Origin 带 CORS 头', async () => {
    const h = await withServer();
    const bad = await fetch(`${h.base}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: '{}',
    });
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get('access-control-allow-origin'), null);

    const good = await fetch(`${h.base}/map/items${QUERY}`, { headers: { origin: 'http://localhost:5173' } });
    assert.equal(good.status, 200);
    assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(good.headers.get('access-control-allow-credentials'), 'true');

    const preflight = await fetch(`${h.base}/submissions`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-methods')?.includes('DELETE'), true);

    const crossSite = await fetch(`${h.base}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' },
      body: '{}',
    });
    assert.equal(crossSite.status, 403);
  });
  test('未预期异常只回通用文案，不含堆栈；body 非法 JSON -> 400', async () => {
    const h = await withServer();
    const res = await fetch(`${h.base}/submissions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    const text = await res.text();
    assert.equal(res.status, 400);
    assert.match(text, /VALIDATION_ERROR/);
    assert.doesNotMatch(text, /at .*\.ts:\d+/);

    const tooBig = await fetch(`${h.base}/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'x'.repeat(300 * 1024) }),
    });
    assert.equal(tooBig.status, 400);
    assert.match(await tooBig.text(), /请求体超过上限/);

    const arrayBody = await fetch(`${h.base}/collections`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' });
    assert.equal(arrayBody.status, 400);
  });
});

before(() => {
  // 常量自检：投稿理由必须过 20 字门槛，审核目标 id 不能带 #v 分隔符
  assert.ok(REASON.length >= 20, 'REASON 需满足 Store 的最小字数校验');
  assert.equal(normalizeTarget('PUB0001'), 'PUB0001');
});
