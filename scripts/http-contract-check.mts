/**
 * SPA↔后端契约自检：用前端真实的 Http 客户端打本地 API，逐接口对账。
 * 前置：后端已在 127.0.0.1:8787 监听（`npm run dev:api` 或 `npm run start:api`）。
 * 会写入演示库，跑完用 `npm run seed:test` 回到基线。
 */
import { Http } from '../apps/web/src/data/http';

const BASE = 'http://127.0.0.1:8787/api/v1';
const jar = new Map<string, string>();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {});
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.set('cookie', cookie);
  const res = await realFetch(input as string, { ...init, headers });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    const i = pair!.indexOf('=');
    jar.set(pair!.slice(0, i), pair!.slice(i + 1));
  }
  return res;
}) as typeof fetch;

const ok: string[] = [];
let failed = false;
function step(name: string, cond: unknown, detail = '') {
  if (failed) return; // 第一条失败即定性为不通过，后续断言只会被级联错误污染
  if (cond) ok.push(`✔ ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    ok.push(`✘ ${name}${detail ? ` — ${detail}` : ''}`);
    failed = true;
  }
}

// 第一条失败之后，后面的写请求可能连带抛错；兜成可读的一行 + 非零退出
process.on('unhandledRejection', (reason) => {
  console.log(ok.join('\n'));
  console.log(`\nHTTP 契约自检中断：${reason instanceof Error ? reason.message : '未知错误'}`);
  process.exitCode = 1;
});

const api = new Http(BASE);
const q = {
  bounds: { west: 115.42, south: 39.44, east: 117.52, north: 41.06 },
  zoom: 11,
  view: 'southwest' as const,
  budget_max: null,
  include_unknown_budget: false,
  dish_or_tag: null,
  layer: 'qualified' as const,
};

const map = await api.mapItems(q);
step('mapItems', map.items.length > 0, `${map.mode} ${map.items.length} 点 / 匹配 ${map.total_matched}`);
const page = await api.listRestaurants(q, map.snapshot_id, null, 5);
step('listRestaurants 复用快照', page.snapshot_id === map.snapshot_id, `${page.items.length} 条，cursor=${page.next_cursor}`);
const one = page.items[0]!;
const detail = await api.detail(one.id);
step('detail', detail.id === one.id, `${detail.name} community=${detail.community}`);
step('匿名 detail 不泄露我的反馈', detail.my_current_feedback === null);
const urls = await api.mediaUrls(detail.photo_media_ids);
step('mediaUrls', Object.keys(urls).length === detail.photo_media_ids.length, `${Object.keys(urls).length} 张`);
const search = await api.search('折耳根');
step('search 别名', search.own.length > 0, `自有 ${search.own.length} · 候选 ${search.provider_candidates.length}`);

step('未登录 me 为 null', (await api.me()) === null);
await api.login('U02', '888888');
const me = await api.me();
step('登录后 me', me?.id === 'U02', me?.display_name ?? '');
const submitted = await api.submit({
  restaurant_id: 'R16',
  visited_date: '2026-09-10',
  attitude: 'recommend',
  dish_names: ['折耳根拌豆腐'],
  reason: 'HTTP 契约自检（合成数据，非真实探店）：这条记录只验证前端到后端的写路径是否可用。',
  media_ids: [],
  disclosure: 'none',
  idempotency_key: 'http-check-1',
  require_media_for_recommend: false,
} as never);
step('submit', submitted.id.length > 0, `${submitted.id} v${submitted.version} ${submitted.status}`);
const again = await api.submit({
  restaurant_id: 'R16',
  visited_date: '2026-09-10',
  attitude: 'recommend',
  dish_names: ['折耳根拌豆腐'],
  reason: 'HTTP 契约自检（合成数据，非真实探店）：这条记录只验证前端到后端的写路径是否可用。',
  media_ids: [],
  disclosure: 'none',
  idempotency_key: 'http-check-1',
  require_media_for_recommend: false,
} as never);
step('幂等：同键同内容返回同结果', again.id === submitted.id && again.version === submitted.version);

const mySubs = await api.mySubmissions();
step('mySubmissions', mySubs.some((s) => s.id === submitted.id), `${mySubs.length} 条`);

// 会话 → 用户身份的换算只能有一处：曾把 sessionId 当 userId 用，这里恒为 null 且无人报错
const mineOnR16 = (await api.detail('R16')).my_current_feedback;
step(
  'detail 回填我的反馈',
  mineOnR16 !== null && submitted.id.startsWith(`${mineOnR16.visit_id}#`) && mineOnR16.attitude === 'recommend',
  mineOnR16 ? `${mineOnR16.visit_id} ${mineOnR16.content_status}` : 'null',
);

const mediaId = await api.uploadTestPhoto('R16');
step('uploadTestPhoto', mediaId.startsWith('MM'), mediaId);
const afterMedia = await api.mediaUrls([mediaId]);
step('未过审图片对作者可解析', Object.keys(afterMedia).length === 1);

const cols = await api.collections();
step('collections', cols.length >= 1, `${cols.length} 个清单`);
const col = await api.createCollection('HTTP 自检清单', null);
step('createCollection', col.title === 'HTTP 自检清单', col.id);
const upd = await api.updateCollection(col.id, { title: 'HTTP 自检清单（改名）', description: '前端→后端契约自检' });
step('updateCollection', upd.title.includes('改名') && upd.description !== null, `v${upd.version}`);
await api.toggleSystemItem('R16', 'want', true);
const withItem = await api.updateCollectionItem(col.id, 'R16', { note: '自检笔记', note_shareable: true });
step('updateCollectionItem', withItem.items.some((i) => i.restaurant_id === 'R16'), `${withItem.items.length} 条`);
const pub = await api.requestPublication(col.id, ['R16']);
step('requestPublication', pub.status === 'PENDING_REVIEW', `${pub.id} gen=${pub.generation}`);
const beforeRevoke = await api.collections();
step('待审期间线上清单不报错', beforeRevoke.some((c) => c.id === col.id));

// 审核侧：换 M01 批准发布申请
await api.logout();
await api.login('M01', '888888');
const adminReports = await api.reportQueue();
step('reportQueue 审核员可见且带门店摘要', adminReports.length > 0 && adminReports.every(r => 'restaurant_name' in r));
const queue = await api.moderationQueue();
step('moderationQueue 含待审发布', queue.some((e) => e.id === pub.id), `${queue.length} 条`);
const mod = await api.moderate({ target: pub.id, action: 'approve', expected_version: pub.generation });
step('moderate 批准发布', mod.ok === true);
// 清单只属于作者：换回 U02 才能在自己的列表里读到发布状态
await api.logout();
await api.login('U02', '888888');
const published = (await api.collections()).find((c) => c.id === col.id)!;
step('清单已发布并有 token', published.publication_status === 'PUBLISHED', published.active_token ?? '');
const snap = await api.sharedSnapshot(published.active_token ?? '');
step('sharedSnapshot 可读', snap.items.length === 1, `${snap.title} · ${snap.items.length} 家`);
await api.unpublish(col.id);
try {
  await api.sharedSnapshot(published.active_token ?? '');
  step('撤回后 token 失效', false);
} catch (e) {
  step('撤回后 token 失效', (e as { code?: string }).code === 'NOT_FOUND');
}
await api.deleteCollection(col.id);
step('deleteCollection', !(await api.collections()).some((c) => c.id === col.id));

const reports = await api.myReports();
step('myReports 可读', Array.isArray(reports), `${reports.length} 条`);
await api.logout();
await api.login('M01', '888888');
const audit = await api.auditLog();
step('auditLog', audit.length > 0, `${audit.length} 条`);

console.log(ok.join('\n'));
if (failed) {
  console.log('\nHTTP 契约自检未通过');
  process.exitCode = 1;
} else {
  console.log(`\nHTTP 契约自检通过：${ok.length} 项`);
}
