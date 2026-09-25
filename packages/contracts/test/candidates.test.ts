import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  BEIJING_BOUNDS,
  CONTRACT_VERSION,
  Store,
  addDays,
  shanghaiToday,
  type CandidateFacts,
  type MapQuery,
} from '../src/index';

/** 阶段 1A：新门店候选与地点核验。与 store.test.ts 用同一个固定时钟口径。 */

const FIXED = Date.UTC(2026, 8, 22, 4, 0, 0); // 2026-09-22 12:00 Asia/Shanghai
const TODAY = shanghaiToday({ now: () => FIXED });

const fullQuery: MapQuery = {
  bounds: BEIJING_BOUNDS,
  zoom: 11,
  view: 'southwest',
  budget_max: null,
  include_unknown_budget: false,
  dish_or_tag: null,
  layer: 'qualified',
  contract_version: CONTRACT_VERSION,
};

const REASON = '测试内容（合成数据，非真实探店）：这条理由用于验证建店后的投稿，长度必须超过二十个字。';

function newStore(): Store {
  return new Store({ env: 'test', now: () => FIXED });
}

const BASE: CandidateFacts = {
  name: '测试·新建候选小馆',
  branch: '望京店',
  address: '朝阳区望京演示路 1 号（合成地址）',
  floor_info: '3 层',
  cuisines: ['guizhou'],
  lng: 116.4705,
  lat: 39.9965,
  source: 'manual_point',
  provider: null,
  poi_id: null,
  evidence_note: '合成场景：在商场三楼看到的新店，用于验证建店流程',
};

describe('阶段 1A 新门店候选与地点核验', () => {
  let s: Store;
  const u01 = () => s.login('U01', '888888').session_id;
  const u02 = () => s.login('U02', '888888').session_id;
  const mod = () => s.login('M01', '888888').session_id;
  const admin = () => s.login('A01', '888888').session_id;

  const create = (over: Partial<CandidateFacts> = {}, session = u01()) =>
    s.createCandidate({ ...BASE, ...over }, session);

  const layerIds = (layer: MapQuery['layer']) =>
    s.mapItems({ ...fullQuery, layer }).items.flatMap((i) => (i.kind === 'cluster' ? i.restaurant_ids : [i.id]));

  beforeEach(() => {
    s = newStore();
  });

  it('用的就是那个上海日历日，不跟宿主时区走', () => {
    expect(TODAY).toBe('2026-09-22');
  });

  it('手动选点建店：落一家 PENDING 门店，进待验证层而不进默认层（SUB-02）', () => {
    const c = create();
    expect(c.status).toBe('PENDING');
    expect(c.restaurant_id).toBeTruthy();
    const rec = s.requireRestaurant(c.restaurant_id!);
    expect(rec.place_status).toBe('PENDING');
    expect(rec.business_status).toBe('UNKNOWN');
    expect(rec.in_default_layer).toBe(false);
    expect(layerIds('pending_verification')).toContain(rec.id);
    expect(layerIds('qualified')).not.toContain(rec.id);
    expect(s.detail(rec.id, null).verification_note).toContain('不代表平台推荐');
  });

  it('候选门店可以立刻被真实投稿，回执写明待核验原因', () => {
    const c = create();
    const r = s.submitFeedback(
      {
        restaurant_id: c.restaurant_id!,
        visited_date: addDays(TODAY, -2),
        attitude: 'recommend',
        dish_names: ['酸汤鱼'],
        reason: REASON,
        media_ids: [],
        disclosure: 'none',
        require_media_for_recommend: false,
      },
      u01(),
    );
    expect(r.submission.status).toBe('PENDING');
    expect(r.submission.pending_verify_reason).toContain('尚未核验');
  });

  it('地点核验通过仍不等于好店达标：入默认层还要票', () => {
    const c = create();
    const decided = s.decideCandidate({ id: c.id, action: 'verify', expected_version: c.version }, mod());
    expect(decided.status).toBe('VERIFIED');
    expect(decided.place_status).toBe('VERIFIED');
    const rec = s.requireRestaurant(c.restaurant_id!);
    expect(rec.in_default_layer).toBe(false);
    expect(rec.ineligibility_reasons).toContain('无有效推荐来源');
    expect(layerIds('pending_verification')).not.toContain(rec.id);
  });

  it('同名近距只给重复提示，不自动合并、不阻止提交', () => {
    const c = create({ name: '测试·滇味小锅', branch: '五道口店', lng: 116.3381, lat: 39.9921 });
    const near = c.duplicates.find((d) => d.matched_id === 'R07');
    expect(near?.reason).toBe('name_nearby');
    expect(near?.distance_m ?? 999).toBeLessThanOrEqual(150);
    expect(c.restaurant_id).toBeTruthy();
    expect(s.candidates.size).toBe(1);
  });

  it('同名但距离远只提示可能是不同分店', () => {
    const c = create({ name: '测试·滇味小锅', branch: '五道口店', lng: 116.45, lat: 39.99 });
    expect(c.duplicates.find((d) => d.matched_id === 'R07')?.reason).toBe('same_name_far');
  });

  it('同一作者重复提交同一家店：复用已有候选，不产生第二家门店', () => {
    const first = create();
    const restaurants = s.restaurants.size;
    const again = create();
    expect(again.id).toBe(first.id);
    expect(again.restaurant_id).toBe(first.restaurant_id);
    expect(again.duplicates.some((d) => d.reason === 'same_author_pending')).toBe(true);
    expect(s.restaurants.size).toBe(restaurants);
    expect(s.candidates.size).toBe(1);
  });

  it('另一个作者提交同一家店各自建门店，但互相看得到重复提示', () => {
    const first = create();
    const second = create({}, u02());
    expect(second.id).not.toBe(first.id);
    expect(second.duplicates.some((d) => d.kind === 'candidate' && d.matched_id === first.id)).toBe(true);
  });

  it('驳回必须写理由；驳回后门店退出两个图层，重复提交被引到补材料', () => {
    const c = create();
    expect(() => s.decideCandidate({ id: c.id, action: 'reject', expected_version: c.version }, mod())).toThrow(ApiError);
    const rejected = s.decideCandidate(
      { id: c.id, action: 'reject', reason: '坐标落在湖里，需要重新选点', expected_version: c.version },
      mod(),
    );
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reject_reason).toContain('坐标落在湖里');
    const rec = s.requireRestaurant(c.restaurant_id!);
    expect(rec.place_status).toBe('REJECTED');
    expect(layerIds('pending_verification')).not.toContain(rec.id);
    expect(layerIds('qualified')).not.toContain(rec.id);
    expect(s.detail(rec.id, u01()).verification_note).toContain('坐标落在湖里');
    expect(() => create()).toThrow(/补充材料/);
  });

  it('补材料回到待核验：同一条候选 revision+1，驳回时已递增过 location_version', () => {
    const c = create();
    const rejected = s.decideCandidate({ id: c.id, action: 'reject', reason: '地址不完整', expected_version: c.version }, mod());
    const before = s.requireRestaurant(c.restaurant_id!);
    const back = s.resubmitCandidateMaterials(
      { id: c.id, patch: { address: '朝阳区望京演示路 1 号 3 层 305（补充门牌）' }, expected_version: rejected.version },
      u01(),
    );
    expect(back.status).toBe('PENDING');
    expect(back.revision).toBe(2);
    expect(back.reject_reason).toBeNull();
    const rec = s.requireRestaurant(c.restaurant_id!);
    // 只补文本不动坐标就不再递增；驳回那一步按既有规则已把 location_version 顶到 2
    expect(rec.location_version).toBe(before.location_version);
    expect(rec.location_version).toBe(2);
    expect(rec.place_status).toBe('PENDING');
    expect(layerIds('pending_verification')).toContain(rec.id);
  });

  it('补材料时换坐标会再递增 location_version：旧址记录只作历史', () => {
    const c = create();
    const rejected = s.decideCandidate({ id: c.id, action: 'reject', reason: '坐标落在路口外侧', expected_version: c.version }, mod());
    s.resubmitCandidateMaterials(
      { id: c.id, patch: { lng: 116.4715, lat: 39.9975 }, expected_version: rejected.version },
      u01(),
    );
    expect(s.requireRestaurant(c.restaurant_id!).location_version).toBe(3);
  });

  it('补材料只能由作者做、只用于被驳回的候选，且受版本锁', () => {
    const c = create();
    const verified = s.decideCandidate({ id: c.id, action: 'verify', expected_version: c.version }, mod());
    expect(() =>
      s.resubmitCandidateMaterials({ id: c.id, patch: { name: '改个名字' }, expected_version: verified.version }, u01()),
    ).toThrow(/不需要补充材料/);

    const s2 = newStore();
    const rc = s2.createCandidate({ ...BASE }, s2.login('U01', '888888').session_id);
    const rj = s2.decideCandidate({ id: rc.id, action: 'reject', reason: '信息不足', expected_version: rc.version }, s2.login('M01', '888888').session_id);
    expect(() =>
      s2.resubmitCandidateMaterials({ id: rc.id, patch: { name: '测试·新建候选小馆' }, expected_version: rj.version }, s2.login('U02', '888888').session_id),
    ).toThrow(/本人/);
    expect(() =>
      s2.resubmitCandidateMaterials(
        { id: rc.id, patch: { address: '朝阳区望京演示路 9 号（合成）' }, expected_version: 999 },
        s2.login('U01', '888888').session_id,
      ),
    ).toThrow(ApiError);
  });

  it('作者不能自审本人的候选，即使他同时是审核员（含直接改门店地点状态）', () => {
    const own = create({}, mod());
    expect(() => s.decideCandidate({ id: own.id, action: 'verify', expected_version: own.version }, mod())).toThrow(/自审/);
    expect(() => s.patchRestaurantStatus({ id: own.restaurant_id!, place_status: 'VERIFIED' }, mod())).toThrow(/自审/);
    const byOther = create({}, u01());
    expect(s.decideCandidate({ id: byOther.id, action: 'verify', expected_version: byOther.version }, mod()).status).toBe('VERIFIED');
  });

  it('并入已有门店走同一套合并规则：反馈迁移、旧 ID 永久重定向', () => {
    const c = create({ name: '测试·黔江酸汤粉', branch: '望京同实体重复候选', lng: 116.4702, lat: 39.9962 });
    expect(c.duplicates.some((d) => d.matched_id === 'R02' && d.reason === 'name_nearby')).toBe(true);
    s.submitFeedback(
      {
        restaurant_id: c.restaurant_id!,
        visited_date: addDays(TODAY, -4),
        attitude: 'neutral',
        dish_names: [],
        reason: REASON,
        media_ids: [],
        disclosure: 'none',
      },
      u01(),
    );
    const merged = s.decideCandidate(
      { id: c.id, action: 'merge', reason: '与 R02 确认为同一家分店', target_restaurant_id: 'R02', expected_version: c.version },
      admin(),
    );
    expect(merged.status).toBe('MERGED');
    expect(merged.restaurant_id).toBe('R02');
    // 旧 ID 永久重定向：按新门店 ID 读详情拿到的是 R02，来源行留着 merged_into 记号
    expect(s.canonical(c.restaurant_id!)).toBe('R02');
    expect(s.restaurants.get(c.restaurant_id!)?.merged_into).toBe('R02');
    expect(s.requireRestaurant(c.restaurant_id!).id).toBe('R02');
    expect(s.visits.some((v) => v.restaurant_id === c.restaurant_id)).toBe(false);
    expect(s.visits.some((v) => v.user_id === 'U01' && v.restaurant_id === 'R02')).toBe(true);
    expect(() => s.decideCandidate({ id: c.id, action: 'verify', expected_version: merged.version }, admin())).toThrow(/不能执行此操作/);
  });

  it('并入需要管理员，moderator 只能核验或驳回', () => {
    const c = create();
    expect(() =>
      s.decideCandidate({ id: c.id, action: 'merge', reason: '重复', target_restaurant_id: 'R02', expected_version: c.version }, mod()),
    ).toThrow(ApiError);
  });

  it('队列与进度：作者看自己的、审核员看待核验的，普通用户无权看队列', () => {
    const c = create();
    create({}, u02());
    s.decideCandidate({ id: c.id, action: 'reject', reason: '不在北京', expected_version: c.version }, mod());
    const mine = s.myCandidates(u01());
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe('REJECTED');
    expect(mine[0]?.is_author_self).toBe(true);
    expect(s.myCandidates(mod())).toHaveLength(0);
    const queue = s.candidateQueue(mod());
    expect(queue).toHaveLength(2);
    expect(queue[0]?.status).toBe('PENDING');
    expect(queue[0]?.is_author_self).toBe(false);
    expect(queue[0]?.author_display_name).toBe('测试食客02');
    expect(() => s.candidateQueue(u01())).toThrow(ApiError);
    expect(s.candidateQueue(mod(), 'PENDING')).toHaveLength(1);
  });

  it('特征锁定（存疑）：核验翻转会递增 location_version，把已有社区票留在历史版本', () => {
    // R07 种子是 3-0-0 已达标但地点 PENDING。按现有规则把它核验通过：
    // location_version 递增 → 旧版本记录不再计票，社区状态从 QUALIFIED 变 LAPSED。
    // 规格只规定"搬迁"递增 location_version，没说核验翻转也算，因此这条是待决问题而不是理想设计。
    // 改它需要单独决策：见 docs/NEXT.md 的 N1。
    const r07 = s.requireRestaurant('R07');
    const lvBefore = r07.location_version;
    expect(r07.tally).toMatchObject({ recommend: 3, total: 3 });
    expect(r07.community).toBe('QUALIFIED');
    s.patchRestaurantStatus({ id: 'R07', place_status: 'VERIFIED', reason: '特征锁定' }, mod());
    const after = s.requireRestaurant('R07');
    expect(after.location_version).toBe(lvBefore + 1);
    expect(after.tally).toMatchObject({ recommend: 0, total: 0 });
    expect(after.community).toBe('LAPSED');
    expect(after.in_default_layer).toBe(false);
  });

  it('未登录不能建候选；越界坐标、缺来源 ID、说明太短都被拒', () => {
    expect(() => s.createCandidate({ ...BASE }, null)).toThrow(ApiError);
    expect(() => create({ lng: 121.47, lat: 31.23 })).toThrow(/北京/);
    expect(() => create({ source: 'provider_poi', provider: null, poi_id: null })).toThrow(/来源 ID/);
    expect(() => create({ evidence_note: '太短' })).toThrow(/信息来源/);
    expect(() => create({ cuisines: [] })).toThrow(/菜系/);
    expect(() => create({ address: '缺' })).toThrow(/地址/);
  });

  it('幂等键：同内容返回同一条，换内容 409；候选随快照落库并能读回', () => {
    const key = 'demo-candidate-1';
    const first = s.createCandidate({ ...BASE, idempotency_key: key }, u01());
    const again = s.createCandidate({ ...BASE, idempotency_key: key }, u01());
    expect(again.id).toBe(first.id);
    expect(s.candidates.size).toBe(1);
    expect(() => s.createCandidate({ ...BASE, name: '测试·换了名字的同一家', idempotency_key: key }, u01())).toThrow(/幂等键/);
    const restored = newStore();
    restored.loadState(s.dumpState());
    const row = restored.myCandidates(restored.login('U01', '888888').session_id)[0];
    expect(row?.id).toBe(first.id);
    expect(row?.restaurant_id).toBe(first.restaurant_id);
    expect(restored.restaurants.get(first.restaurant_id!)?.place_status).toBe('PENDING');
    const restoredPending = restored
      .mapItems({ ...fullQuery, layer: 'pending_verification' })
      .items.flatMap((i) => (i.kind === 'cluster' ? i.restaurant_ids : [i.id]));
    expect(restoredPending).toContain(first.restaurant_id);
  });

  it('注销后候选只留去标识归属：本人进度清空，队列显示已注销用户', () => {
    const c = create();
    const sid = u01();
    s.deleteAccount(sid);
    s.processDeletionJobs();
    const queue = s.candidateQueue(mod());
    expect(queue.map((x) => x.id)).toContain(c.id);
    expect(queue.find((x) => x.id === c.id)?.author_display_name).toBe('已注销用户');
    expect(() => s.myCandidates(sid)).toThrow(ApiError);
  });

  it('搜索给的地图地点候选带演示合成坐标，可预填建店', () => {
    const r = s.search('找不到这家合成店');
    const c = r.provider_candidates[0];
    expect(c?.provider).toBe('demo-provider');
    expect(c?.poi_id).toMatch(/^POI-DEMO-\d+$/);
    expect(c?.coord_note).toContain('演示合成坐标');
    expect(c && c.lng > BEIJING_BOUNDS.west && c.lng < BEIJING_BOUNDS.east).toBe(true);
    const again = s.search('找不到这家合成店');
    expect(again.provider_candidates[0]?.poi_id).toBe(c?.poi_id);
    const built = create(
      { name: '测试·从候选建出的店', source: 'provider_poi', provider: c?.provider ?? null, poi_id: c?.poi_id ?? null, lng: c?.lng ?? 0, lat: c?.lat ?? 0 },
      u01(),
    );
    expect(built.source).toBe('provider_poi');
    expect(s.restaurants.get(built.restaurant_id!)?.place_status).toBe('PENDING');
  });
});
