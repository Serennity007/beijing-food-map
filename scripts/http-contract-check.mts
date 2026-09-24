/**
 * SPA↔后端契约自检：用前端真实的 Http 客户端打本地 API，逐接口对账。
 * 前置：后端已在 127.0.0.1:8787 监听（`npm run dev:api` 或 `npm run start:api`）。
 * 会写入演示库，跑完用 `npm run seed:test` 回到基线。
 */
import { Http } from '../apps/web/src/data/http';
import type { CandidateFacts } from '@qianwei/contracts';

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

/** 期望被拒：只关心"是否被拒"，具体 code 由后端与引擎保证。 */
async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

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

// ---------------------------------------------- 新门店候选与地点核验（阶段 1A，U02 提交）
const CAND_A: CandidateFacts = {
  name: '测试·自检新建店A',
  branch: null,
  address: '朝阳区望京自检路 8 号（合成地址）',
  floor_info: '2 层',
  cuisines: ['guizhou'],
  lng: 116.4788,
  lat: 39.9931,
  source: 'manual_point',
  provider: null,
  poi_id: null,
  evidence_note: 'HTTP 契约自检（合成场景）：验证建店申请到地点核验的写路径',
};
const CAND_B: CandidateFacts = { ...CAND_A, name: '测试·自检待驳回店B', address: '海淀区自检路 9 号（合成地址）', lng: 116.3402, lat: 39.9781 };

const candA = await api.createCandidate({ ...CAND_A, idempotency_key: 'http-check-cand-a' });
step('createCandidate', candA.status === 'PENDING' && !!candA.restaurant_id, `${candA.id} → ${candA.restaurant_id}`);
const candAStore = await api.detail(candA.restaurant_id!);
step('新建门店地点 PENDING 且不在默认层', candAStore.place_status === 'PENDING' && !candAStore.in_default_layer, candAStore.verification_note);
const pendLayer = await api.mapItems({ ...q, layer: 'pending_verification' });
const pendIds = pendLayer.items.flatMap((i) => (i.kind === 'cluster' ? i.restaurant_ids : [i.id]));
step('新门店只出现在待验证图层', pendIds.includes(candA.restaurant_id!), `待验证 ${pendIds.length} 家`);
const candARetry = await api.createCandidate({ ...CAND_A, idempotency_key: 'http-check-cand-a' });
step('建店幂等：同键同内容返回同一条', candARetry.id === candA.id);
const candB = await api.createCandidate({ ...CAND_B, idempotency_key: 'http-check-cand-b' });
step('第二条候选独立存在', candB.id !== candA.id && candB.duplicates.every((d) => d.matched_id !== candA.restaurant_id));
const candListU02 = await api.myCandidates();
step('myCandidates 只列本人的', candListU02.length >= 2 && candListU02.every((c) => c.is_author_self), `${candListU02.length} 条`);

const cols = await api.collections();step('collections', cols.length >= 1, `${cols.length} 个清单`);
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

// ---------------------------------------------- 地点核验（M01）
const candQueue = await api.candidateQueue();
step(
  'candidateQueue 待核验优先且带提交人',
  candQueue.length >= 2 && candQueue[0]?.status === 'PENDING' && candQueue.every((c) => c.author_display_name.length > 0),
  `${candQueue.length} 条`,
);
const verifiedA = await api.decideCandidate({ id: candA.id, action: 'verify', reason: '自检：坐标与地址一致', expected_version: candA.version });
step('decideCandidate 核验通过', verifiedA.status === 'VERIFIED' && verifiedA.place_status === 'VERIFIED', verifiedA.id);
const afterVerify = await api.detail(candA.restaurant_id!);
step(
  '核验通过仍不等于好店达标',
  afterVerify.place_status === 'VERIFIED' && !afterVerify.in_default_layer,
  afterVerify.ineligibility_reasons.join('；'),
);
const ownCand = await api.createCandidate({ ...CAND_A, name: '测试·自检自审店C', lng: 116.41, lat: 39.91, idempotency_key: 'http-check-cand-c' });
step(
  '作者不能自审本人候选（403）',
  await rejects(() => api.decideCandidate({ id: ownCand.id, action: 'verify', expected_version: ownCand.version })),
);
step('驳回必须写理由（400）', await rejects(() => api.decideCandidate({ id: candB.id, action: 'reject', expected_version: candB.version })));
const rejectedB = await api.decideCandidate({ id: candB.id, action: 'reject', reason: '自检：坐标落在路口中央，需重新选点', expected_version: candB.version });
step('驳回并回传原因', rejectedB.status === 'REJECTED' && (rejectedB.reject_reason ?? '').includes('路口中央'));
step('被驳回的门店退出待验证图层', !(await api.detail(candB.restaurant_id!)).in_default_layer && (await api.detail(candB.restaurant_id!)).place_status === 'REJECTED');
step('版本冲突被拒（409）', await rejects(() => api.decideCandidate({ id: candA.id, action: 'verify', expected_version: 9999 })));

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

// ---------------------------------------------- 补材料（U02 在被驳回的申请上改）
const lvBeforeAmend = (await api.detail(candB.restaurant_id!)).location_version;
const amended = await api.resubmitCandidate(
  candB.id,
  { address: '海淀区自检路 9 号 1 层 101（补充门牌）', lng: 116.3412, lat: 39.9789 },
  rejectedB.version,
);
step('补材料回到待核验', amended.status === 'PENDING' && amended.revision === 2, `${amended.id} 第 ${amended.revision} 版`);
step('补材料后驳回理由清空', amended.reject_reason === null);
const lvAfterAmend = (await api.detail(candB.restaurant_id!)).location_version;
step('换坐标后 location_version 递增', lvAfterAmend > lvBeforeAmend, `${lvBeforeAmend} → ${lvAfterAmend}`);

await api.logout();
await api.login('M01', '888888');
const audit = await api.auditLog();
step('auditLog', audit.length > 0, `${audit.length} 条`);
step('审计留下建店与核验动作', audit.some((a) => a.action === 'candidate_create') && audit.some((a) => a.action === 'candidate_reject'));

console.log(ok.join('\n'));
if (failed) {
  console.log('\nHTTP 契约自检未通过');
  process.exitCode = 1;
} else {
  console.log(`\nHTTP 契约自检通过：${ok.length} 项`);
}
