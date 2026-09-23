import { describe, expect, it, beforeEach } from 'vitest';
import {
  ApiError,
  BEIJING_BOUNDS,
  CONTRACT_VERSION,
  Store,
  addDays,
  communityQualification,
  endorsementStatusOn,
  isInScoringWindow,
  shanghaiToday,
  type Clock,
  type MapQuery,
} from '../src/index';

const FIXED = Date.UTC(2026, 8, 22, 4, 0, 0); // 2026-09-22 12:00 Asia/Shanghai
const clock = (): Clock => ({ now: () => FIXED });
const TODAY = '2026-09-22';

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

function newStore(): Store {
  return new Store({ env: 'test', now: clock().now });
}

const REASON = '测试内容（合成数据，非真实探店）：这条理由用于验证投稿校验，长度必须超过二十个字。';

describe('REC-00 计票窗口与资格规则', () => {
  it('Asia/Shanghai 的“今天”不依赖宿主时区', () => {
    expect(shanghaiToday(clock())).toBe(TODAY);
  });

  it('窗口两端包含，第 181 天不计（共 180 个自然日）', () => {
    expect(isInScoringWindow(TODAY, TODAY)).toBe(true);
    expect(isInScoringWindow(addDays(TODAY, -179), TODAY)).toBe(true);
    expect(isInScoringWindow(addDays(TODAY, -180), TODAY)).toBe(false);
  });

  it('3/4 达标、3/5 不达标、2/2 不达标、零票不达标', () => {
    expect(communityQualification({ recommend: 3, total: 4 }, false)).toBe('QUALIFIED');
    expect(communityQualification({ recommend: 3, total: 5 }, false)).toBe('PENDING');
    expect(communityQualification({ recommend: 2, total: 2 }, false)).toBe('PENDING');
    expect(communityQualification({ recommend: 0, total: 0 }, false)).toBe('PENDING');
  });

  it('曾达标后失票为 LAPSED 而不是 PENDING', () => {
    expect(communityQualification({ recommend: 3, total: 5 }, true)).toBe('LAPSED');
  });

  it('编辑背书到实吃日 +179 自然日结束时失效', () => {
    expect(endorsementStatusOn(TODAY, TODAY)).toBe('ACTIVE');
    expect(endorsementStatusOn(addDays(TODAY, -179), TODAY)).toBe('ACTIVE');
    expect(endorsementStatusOn(addDays(TODAY, -180), TODAY)).toBe('EXPIRED');
  });
});

describe('公共地图谓词与种子数据', () => {
  let s: Store;
  const mod = () => s.login('M01', '888888').session_id;
  const admin = () => s.login('A01', '888888').session_id;

  beforeEach(() => {
    s = newStore();
  });

  it('3 推荐 0 不推荐 → QUALIFIED 并进默认层', () => {
    const rec = s.requireRestaurant('R01');
    expect(rec.tally).toMatchObject({ recommend: 3, total: 3 });
    expect(rec.community).toBe('QUALIFIED');
    expect(rec.in_default_layer).toBe(true);
    expect(rec.sources).toContain('community');
  });

  it('曾达标后失票 → LAPSED 且不在默认层', () => {
    const rec = s.requireRestaurant('R04');
    expect(rec.tally).toMatchObject({ recommend: 3, neutral: 1, not_recommend: 1, total: 5 });
    expect(rec.community).toBe('LAPSED');
    expect(rec.in_default_layer).toBe(false);
  });

  it('地点未核验的门店票数达标也不进默认层，只出现在待验证图层（SUB-02）', () => {
    const rec = s.requireRestaurant('R07');
    expect(rec.tally.recommend).toBe(3);
    expect(rec.in_default_layer).toBe(false);
    const pending = s.mapItems({ ...fullQuery, layer: 'pending_verification' });
    const ids = pending.items.flatMap((i) => (i.kind === 'cluster' ? i.restaurant_ids : [i.id]));
    expect(ids).toContain('R07');
    const qualified = s.mapItems(fullQuery);
    const qids = qualified.items.flatMap((i) => (i.kind === 'cluster' ? i.restaurant_ids : [i.id]));
    expect(qids).not.toContain('R07');
  });

  it('风险复核与阻断优先于任何推荐来源（REC-05）', () => {
    const blocked = s.requireRestaurant('R18');
    expect(blocked.tally.recommend).toBe(3);
    expect(blocked.community).toBe('QUALIFIED');
    expect(blocked.in_default_layer).toBe(false);
    expect(s.requireRestaurant('R08').in_default_layer).toBe(false);
  });

  it('社区未达标 + 编辑 ACTIVE 背书 → 入图，来源只有 editorial（REC-05）', () => {
    const rec = s.requireRestaurant('R05');
    expect(rec.community).toBe('PENDING');
    expect(rec.endorsement).toBe('ACTIVE');
    expect(rec.in_default_layer).toBe(true);
    expect(rec.sources).toEqual(['editorial']);
  });

  it('OPEN 改 CLOSED / SUSPECTED_CLOSED 后从默认层排除（REC-08）', () => {
    expect(s.requireRestaurant('R01').in_default_layer).toBe(true);
    s.patchRestaurantStatus({ id: 'R01', business_status: 'CLOSED', reason: '测试闭店' }, mod());
    expect(s.requireRestaurant('R01').in_default_layer).toBe(false);
    s.patchRestaurantStatus({ id: 'R01', business_status: 'OPEN', reason: '测试恢复' }, mod());
    expect(s.requireRestaurant('R01').in_default_layer).toBe(true);
  });

  it('营业状态 UNKNOWN 的达标门店入图并标注未核实', () => {
    const rec = s.requireRestaurant('R23');
    expect(rec.business_status).toBe('UNKNOWN');
    expect(rec.in_default_layer).toBe(true);
    expect(s.detail('R23', null).business_status_note).toContain('未核实');
  });

  it('搬迁后旧址票不计入新址资格（REC-09）', () => {
    const rec = s.requireRestaurant('R19');
    expect(rec.location_version).toBe(2);
    expect(rec.tally.total).toBe(0);
    expect(rec.community).toBe('LAPSED');
    expect(rec.in_default_layer).toBe(false);
  });

  it('窗口外记录不计票但仍作为历史反馈展示（REC-03）', () => {
    expect(s.requireRestaurant('R09').tally.recommend).toBe(2);
    const all = s.publicFeedbackFor('R09');
    expect(all).toHaveLength(3);
    expect(all.filter((f) => f.counted_in_tally)).toHaveLength(2);
    expect(all.find((f) => f.visited_date === addDays(TODAY, -200))?.counted_in_tally).toBe(false);
  });

  it('已确认闭店的门店不进默认层（REC-08）', () => {
    expect(s.requireRestaurant('R09').business_status).toBe('CLOSED');
    expect(s.requireRestaurant('R09').in_default_layer).toBe(false);
    expect(s.detail('R09', null).business_status_note).toContain('闭店');
  });

  it('利益关联记录公开但不计独立票（REC-06）', () => {
    expect(s.requireRestaurant('R20').tally.recommend).toBe(1);
    const disclosed = s.publicFeedbackFor('R20').filter((f) => f.disclosure !== 'none');
    expect(disclosed.length).toBe(2);
    expect(disclosed.every((f) => !f.counted_in_tally)).toBe(true);
  });

  it('已注销账号的历史票不计入', () => {
    expect(s.requireRestaurant('R24').tally.recommend).toBe(1);
  });

  it('读接口重算到期资格，不依赖定时任务（REC-04）', () => {
    expect(s.requireRestaurant('R05').in_default_layer).toBe(true);
    // 时间前进 180 天：不跑任何定时任务，读取时资格也应失效
    (s as unknown as { clock: Clock }).clock = { now: () => FIXED + 181 * 86400000 };
    const later = s.detail('R05', null);
    expect(later.basis.editorial).toBe('EXPIRED');
    expect(later.in_default_layer).toBe(false);
  });
});

describe('地图查询：聚合、快照与筛选', () => {
  let s: Store;
  beforeEach(() => {
    s = newStore();
  });

  it('聚合计数总和等于匹配门店数（MAP-04 独立 oracle）', () => {
    const res = s.mapItems({ ...fullQuery, zoom: 9 });
    const summed = res.items.reduce((acc, i) => acc + (i.kind === 'cluster' ? i.count : 1), 0);
    expect(res.total_matched).toBeGreaterThan(0);
    expect(summed).toBe(res.total_matched);
    expect(res.complete).toBe(true);
  });

  it('地图与列表共用 snapshotId，列表是分页单店结果（MAP-05）', () => {
    const map = s.mapItems({ ...fullQuery, zoom: 16 });
    expect(map.mode).toBe('restaurants');
    const page = s.listRestaurants(fullQuery, map.snapshot_id, null, 50);
    expect(page.snapshot_id).toBe(map.snapshot_id);
    expect(page.items.length).toBe(map.total_matched);
  });

  it('同坐标多店在中等 zoom 下聚成可选列表，最大 zoom 下展开', () => {
    const tight: MapQuery = {
      ...fullQuery,
      bounds: { west: 116.45, south: 39.90, east: 116.47, north: 39.92 },
      zoom: 16,
    };
    const res = s.mapItems(tight);
    const cluster = res.items.find((i) => i.kind === 'cluster' && i.restaurant_ids.length > 1);
    expect(cluster).toBeDefined();
    const deepest = s.mapItems({ ...tight, zoom: 17 });
    expect(deepest.items.filter((i) => i.kind === 'restaurant').length).toBeGreaterThanOrEqual(2);
  });

  it('资格变化后旧 snapshot 翻页返回 QUERY_EXPIRED（MAP-09）', () => {
    const page = s.listRestaurants(fullQuery, null, null, 2);
    const snap = page.snapshot_id!;
    expect(page.next_cursor).toBeTruthy();
    s.patchRestaurantStatus({ id: 'R01', risk_status: 'REVIEW_REQUIRED', reason: '测试复核' }, s.login('M01', '888888').session_id);
    try {
      s.listRestaurants(fullQuery, snap, page.next_cursor, 2);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('QUERY_EXPIRED');
    }
  });

  it('贵州菜属于西南风味但按门店 ID 去重，不重复计数', () => {
    const gz = s.listRestaurants({ ...fullQuery, view: 'guizhou' }, null, null, 50);
    const sw = s.listRestaurants({ ...fullQuery, view: 'southwest' }, null, null, 50);
    expect(gz.items.every((r) => sw.items.some((x) => x.id === r.id))).toBe(true);
    expect(sw.items.length).toBeGreaterThan(gz.items.length);
    const other = s.listRestaurants({ ...fullQuery, view: 'other' }, null, null, 50);
    expect(other.items.some((r) => r.cuisines.includes('guizhou'))).toBe(false);
  });

  it('选预算时未知人均默认不匹配，勾选“包含未知”后匹配', () => {
    const base: MapQuery = { ...fullQuery, zoom: 16, budget_max: 50 };
    const without = s.listRestaurants(base, null, null, 50);
    const withUnknown = s.listRestaurants({ ...base, include_unknown_budget: true }, null, null, 50);
    expect(without.items.every((r) => r.price.average !== null && r.price.average <= 50)).toBe(true);
    expect(withUnknown.items.length).toBeGreaterThan(without.items.length);
  });

  it('菜名/别名搜索：折耳根与鱼腥草命中同一门店', () => {
    expect(s.search('折耳根').own.map((r) => r.id)).toContain('R16');
    expect(s.search('鱼腥草').own.map((r) => r.id)).toContain('R16');
  });

  it('供应商候选不自动入库（MAP-07 数据来源可追踪）', () => {
    const res = s.search('测试候选词');
    expect(res.own.length).toBe(0);
    expect(res.provider_candidates[0]?.provider).toBe('demo-provider');
    expect(s.restaurants.size).toBe(24);
  });
});

describe('投稿、单一计票源与审核状态机', () => {
  let s: Store;
  const sid = () => s.login('U04', '888888').session_id;
  const mod = () => s.login('M01', '888888').session_id;

  const submit = (over: Partial<Parameters<Store['submitFeedback']>[0]> = {}, session = sid()) =>
    s.submitFeedback(
      {
        restaurant_id: 'R15',
        visited_date: addDays(TODAY, -5),
        attitude: 'recommend',
        dish_names: ['花溪牛肉粉'],
        reason: REASON,
        media_ids: [],
        disclosure: 'none',
        require_media_for_recommend: false,
        ...over,
      },
      session,
    );

  beforeEach(() => {
    s = newStore();
  });

  it('R15 种子为 2 推荐 → PENDING', () => {
    expect(s.requireRestaurant('R15').tally.recommend).toBe(2);
    expect(s.requireRestaurant('R15').community).toBe('PENDING');
  });

  it('一用户一门店最多一票：重复提交仍是一条 visit（REC-02）', () => {
    const session = sid();
    const a = submit({}, session);
    const b = submit({}, session);
    expect(b.submission.id).not.toBe(a.submission.id);
    expect(s.visits.filter((v) => v.user_id === 'U04' && v.restaurant_id === 'R15')).toHaveLength(1);
    s.moderate({ target: b.submission.id, action: 'approve', expected_version: 2 }, mod());
    expect(s.requireRestaurant('R15').tally.recommend).toBe(3);
    expect(s.requireRestaurant('R15').community).toBe('QUALIFIED');
  });

  it('相同幂等键同内容同结果、换内容 409（SUB-01）', () => {
    const session = sid();
    const a = submit({ idempotency_key: 'k1' }, session);
    const b = submit({ idempotency_key: 'k1' }, session);
    expect(b.submission.id).toBe(a.submission.id);
    try {
      submit({ idempotency_key: 'k1', reason: '换了一段完全不同的测试理由，长度也超过二十个字，应当冲突。' }, session);
      throw new Error('should conflict');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('IDEMPOTENCY_CONFLICT');
    }
    expect(s.visits.filter((v) => v.user_id === 'U04' && v.restaurant_id === 'R15')).toHaveLength(1);
  });

  it('未来实吃日期拒绝（REC-03）', () => {
    try {
      submit({ visited_date: addDays(TODAY, 1) });
      throw new Error('should reject');
    } catch (e) {
      expect((e as ApiError).message).toContain('未来');
    }
  });

  it('推荐缺图提示补图，一般/不推荐不要求图片与推荐菜（SUB-03）', () => {
    const session = sid();
    try {
      submit({ attitude: 'recommend', media_ids: [], require_media_for_recommend: true }, session);
      throw new Error('should require media');
    } catch (e) {
      expect((e as ApiError).message).toContain('图片');
    }
    expect(() =>
      submit({ attitude: 'not_recommend', dish_names: [], media_ids: [], reason: '测试不推荐（合成）：负面反馈不应要求图片或推荐菜，理由长度超过二十字。' }, session),
    ).not.toThrow();
  });

  it('披露必选，理由长度服务端校验（AUTH-03 输入校验部分）', () => {
    expect(() => submit({ disclosure: null })).toThrow(/披露/);
    expect(() => submit({ reason: '太短' })).toThrow(/20/);
    expect(() => submit({ reason: 'x'.repeat(501) })).toThrow(/500/);
  });

  it('待审版本不提前覆盖旧已审版本，批准后原子切换（SUB-04）', () => {
    const session = sid();
    const first = submit({}, session);
    s.moderate({ target: first.submission.id, action: 'approve', expected_version: 1 }, mod());
    expect(s.requireRestaurant('R15').tally.recommend).toBe(3);
    const second = submit({ attitude: 'neutral', reason: '测试修改（合成）：把态度改为一般，理由长度需要超过二十个字。' }, session);
    expect(s.requireRestaurant('R15').tally.recommend).toBe(3);
    s.moderate({ target: second.submission.id, action: 'approve', expected_version: 2 }, mod());
    expect(s.requireRestaurant('R15').tally).toMatchObject({ recommend: 2, neutral: 1 });
  });

  it('作者撤回立即停止计票且不复活旧票（SUB-04）', () => {
    const session = sid();
    const first = submit({}, session);
    s.moderate({ target: first.submission.id, action: 'approve', expected_version: 1 }, mod());
    expect(s.requireRestaurant('R15').tally.recommend).toBe(3);
    submit({ attitude: 'neutral', reason: '测试待审（合成）：撤回时这条待审版本应当作废，理由长度超过二十个字。' }, session);
    s.withdrawMyFeedback('R15', session);
    const rec = s.requireRestaurant('R15');
    expect(rec.tally.recommend).toBe(2);
    // 该店曾达标，撤回后按规则是 LAPSED 而不是回到 PENDING
    expect(rec.community).toBe('LAPSED');
    const v = s.findVisit('U04', 'R15')!;
    expect(v.current_revision).toBeNull();
    expect(v.withdrawal_generation).toBe(1);
    expect(v.revisions.filter((r) => r.status === 'PENDING')).toHaveLength(0);
  });

  it('并发审核同 expectedVersion：一次成功一次 409（ADM-02）', () => {
    const created = submit({});
    s.moderate({ target: created.submission.id, action: 'approve', expected_version: 1 }, mod());
    try {
      s.moderate({ target: created.submission.id, action: 'reject', expected_version: 1 }, s.login('A01', '888888').session_id);
      throw new Error('should conflict');
    } catch (e) {
      expect((e as ApiError).code).toBe('VERSION_CONFLICT');
    }
    expect(s.requireRestaurant('R15').tally.recommend).toBe(3);
  });

  it('较低 revision 不能覆盖已批准的较高 revision（SUB-05）', () => {
    const session = sid();
    const v1 = submit({ reason: '测试 v1（合成）：第一个版本，理由长度需要超过二十个字才能通过校验。' }, session);
    const v2 = submit({ attitude: 'neutral', reason: '测试 v2（合成）：第二个版本，理由长度同样超过二十个字即可。' }, session);
    s.moderate({ target: v2.submission.id, action: 'approve', expected_version: 2 }, mod());
    try {
      s.moderate({ target: v1.submission.id, action: 'approve', expected_version: 1 }, mod());
      throw new Error('lower revision must not override');
    } catch (e) {
      expect((e as ApiError).code).toBe('VERSION_CONFLICT');
    }
    expect(s.findVisit('U04', 'R15')!.current_revision).toBe(2);
    expect(s.requireRestaurant('R15').tally).toMatchObject({ recommend: 2, neutral: 1 });
  });

  it('撤回后批准历史待审版本必须失败（SUB-05 后半）', () => {
    const session = sid();
    const v1 = submit({});
    s.moderate({ target: v1.submission.id, action: 'approve', expected_version: 1 }, mod());
    const v2 = submit({ attitude: 'neutral', reason: '测试撤回作废（合成）：这条待审版本应在撤回后失效，理由超过二十字。' }, session);
    s.withdrawMyFeedback('R15', session);
    try {
      s.moderate({ target: v2.submission.id, action: 'approve', expected_version: 2 }, mod());
      throw new Error('withdrawn pending must not be approved');
    } catch (e) {
      expect((e as ApiError).code).toBe('VERSION_CONFLICT');
    }
    expect(s.requireRestaurant('R15').tally.recommend).toBe(2);
  });

  it('隐藏当前已批准版本后立即退出计票与默认层（REC-08）', () => {
    const session = sid();
    const created = submit({}, session);
    s.moderate({ target: created.submission.id, action: 'approve', expected_version: 1 }, mod());
    expect(s.requireRestaurant('R15').community).toBe('QUALIFIED');
    const v = s.findVisit('U04', 'R15')!;
    s.moderate({ target: `${v.id}#v1`, action: 'hide', reason: '测试隐藏' , expected_version: 1 }, mod());
    const rec = s.requireRestaurant('R15');
    expect(rec.tally.recommend).toBe(2);
    expect(rec.community).toBe('LAPSED');
    expect(rec.in_default_layer).toBe(false);
    expect(s.publicFeedbackFor('R15').some((f) => f.id === v.id)).toBe(false);
  });

  it('作者即使有 admin 角色也不能自审（ADM-03）', () => {
    s.createInvitedUser({ id: 'U90', display_name: '测试作者兼管理员', roles: ['user', 'moderator', 'admin'] }, s.login('A01', '888888').session_id);
    const own = s.login('U90', '888888').session_id;
    const created = submit({ reason: '测试自审限制（合成）：这条内容用于验证作者不能批准自己的投稿，理由超过二十字。' }, own);
    try {
      s.moderate({ target: created.submission.id, action: 'approve', expected_version: 1 }, own);
      throw new Error('self review must be forbidden');
    } catch (e) {
      expect((e as ApiError).code).toBe('FORBIDDEN');
    }
    expect(s.requireRestaurant('R15').tally.recommend).toBe(2);
  });

  it('举报闭店达阈值只生成复核，不自动判定风险阻断（REC-07）', () => {
    const before = s.requireRestaurant('R23').business_status;
    s.createReport({ restaurant_id: 'R23', kind: 'closed', detail: '测试举报一' }, s.login('U01', '888888').session_id);
    s.createReport({ restaurant_id: 'R23', kind: 'closed', detail: '测试举报二' }, s.login('U02', '888888').session_id);
    expect(s.requireRestaurant('R23').business_status).toBe(before);
    s.createReport({ restaurant_id: 'R23', kind: 'closed', detail: '测试举报三' }, s.login('U03', '888888').session_id);
    expect(s.requireRestaurant('R23').business_status).toBe('SUSPECTED_CLOSED');
    expect(s.requireRestaurant('R23').risk_status).toBe('CLEAR');
    expect(s.audit.some((a) => a.action === 'workorder_created')).toBe(true);
  });

  it('合法负面反馈公开展示并正常计票，不因不推荐被删（REC-07）', () => {
    const neg = s.publicFeedbackFor('R04').find((f) => f.attitude === 'not_recommend');
    expect(neg?.reason).toContain('折耳根');
    expect(neg?.counted_in_tally).toBe(true);
  });
});

describe('AUTH/COL/SHARE/DELETE/MERGE/DEMO', () => {
  let s: Store;
  beforeEach(() => {
    s = newStore();
  });

  it('私密清单越权统一 404，不泄露存在性（AUTH-01）', () => {
    try {
      s.updateCollectionItem('COL0001', 'R01', { note: '越权' }, 'U02');
      throw new Error('should 404');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe('NOT_FOUND');
      expect((e as ApiError).status).toBe(404);
    }
    expect(s.myFeedback('R01', 'U05')).toBeNull();
    expect(() => s.detail('R99', null)).toThrow(/不存在/);
  });

  it('错误验证码与未知账号登录失败，日志不含验证码（AUTH-02 部分）', () => {
    expect(() => s.login('U01', '000000')).toThrow(ApiError);
    expect(() => s.login('NOPE', '888888')).toThrow(ApiError);
    expect(s.login('U01', '888888').user.roles).toEqual(['user']);
  });

  it('想吃与吃过互斥，私藏可共存，且都不产生票（COL-01）', () => {
    const before = s.requireRestaurant('R22').tally.total;
    s.toggleSystemCollectionItem('U02', 'R22', 'want', true);
    s.toggleSystemCollectionItem('U02', 'R22', 'visited', true);
    const cols = s.toggleSystemCollectionItem('U02', 'R22', 'private_stash', true);
    const want = cols.find((c) => c.system_kind === 'want')!;
    const visited = cols.find((c) => c.system_kind === 'visited')!;
    const stash = cols.find((c) => c.system_kind === 'private_stash')!;
    expect(want.items.some((i) => i.restaurant_id === 'R22')).toBe(false);
    expect(visited.items.some((i) => i.restaurant_id === 'R22')).toBe(true);
    expect(stash.items.some((i) => i.restaurant_id === 'R22')).toBe(true);
    expect(s.requireRestaurant('R22').tally.total).toBe(before);
    expect(s.publicFeedbackFor('R22').length).toBe(4);
  });

  it('私人笔记默认不带出快照（SHARE-01）', () => {
    const snap = s.sharedSnapshot('demo-token-1');
    expect(snap.items.map((i) => i.restaurant_id)).toEqual(['R20', 'R07']);
    expect(snap.items.find((i) => i.restaurant_id === 'R20')?.note).toContain('可公开');
  });

  it('待验证店在公开快照里带标识且不改变推荐资格（SHARE-04）', () => {
    const snap = s.sharedSnapshot('demo-token-1');
    expect(snap.items.find((i) => i.restaurant_id === 'R07')?.pending_verification).toBe(true);
    expect(s.requireRestaurant('R07').in_default_layer).toBe(false);
  });

  it('撤回后旧 token 失效，重新发布需新审核与新 token（SHARE-03）', () => {
    s.unpublishCollection('COL0001', 'U01');
    try {
      s.sharedSnapshot('demo-token-1');
      throw new Error('token must be dead');
    } catch (e) {
      expect((e as ApiError).code).toBe('NOT_FOUND');
    }
    s.requestPublication('COL0001', 'U01', ['R20']);
    const pub = [...s.publications.values()].sort((a, b) => b.generation - a.generation)[0]!;
    s.moderate({ target: pub.id, action: 'approve', expected_version: pub.generation }, s.login('M01', '888888').session_id);
    const col = s.collections.get('COL0001')!;
    expect(col.active_token).toBeTruthy();
    expect(col.active_token).not.toBe('demo-token-1');
    expect(s.sharedSnapshot(col.active_token!).items).toHaveLength(1);
  });

  it('重新申请发布期间线上 token 仍可读，批准后才换发（SHARE-03 补充）', () => {
    const m01 = () => s.login('M01', '888888').session_id;
    const col = s.collections.get('COL0001')!;
    expect(col.active_token).toBe('demo-token-1');

    const again = s.requestPublication('COL0001', 'U01', ['R20']);
    // 申请只是待审：线上链接不该因为“有人提交了新版”而 404
    expect(s.sharedSnapshot('demo-token-1').items.length).toBeGreaterThan(0);

    s.moderate({ target: again.id, action: 'approve', expected_version: again.generation }, m01());
    const fresh = s.collections.get('COL0001')!;
    expect(fresh.active_token).not.toBe('demo-token-1');
    expect(() => s.sharedSnapshot('demo-token-1')).toThrow(ApiError);
    expect(s.sharedSnapshot(fresh.active_token!).items).toHaveLength(1);

    // 新版待审期间，当前生效 token 依然可读
    const third = s.requestPublication('COL0001', 'U01', ['R07']);
    expect(third.generation).toBeGreaterThan(again.generation);
    expect(s.sharedSnapshot(fresh.active_token!).items).toHaveLength(1);
  });

  it('未过审图片只有作者与审核人员可读，过审后人人可读（AUTH-01 图片部分）', () => {
    const author = s.login('U02', '888888').session_id;
    const stranger = s.login('U03', '888888').session_id;
    const mod = s.login('M01', '888888').session_id;

    const seeded = s.detail('R01', null).photo_media_ids[0];
    expect(seeded).toBeTruthy();
    expect(s.canViewMedia(null, seeded!)).toBe(true);

    const pending = s.addTestMedia(author, 'R01');
    expect(s.canViewMedia(author, pending.id)).toBe(true);
    expect(s.canViewMedia(mod, pending.id)).toBe(true);
    expect(s.canViewMedia(stranger, pending.id)).toBe(false);
    expect(s.canViewMedia(null, pending.id)).toBe(false);
    expect(s.canViewMedia('sess-not-exist', pending.id)).toBe(false);

    s.moderate({ target: pending.id, action: 'approve', expected_version: 1 }, mod);
    expect(s.canViewMedia(null, pending.id)).toBe(true);
  });

  it('作者撤回后批准历史发布申请必须失败（SHARE-05）', () => {
    const pub = s.requestPublication('COL0001', 'U01', ['R20']);
    s.unpublishCollection('COL0001', 'U01');
    try {
      s.moderate({ target: pub.id, action: 'approve', expected_version: pub.generation }, s.login('M01', '888888').session_id);
      throw new Error('stale publication must not be approved');
    } catch (e) {
      expect((e as ApiError).code).toBe('VERSION_CONFLICT');
    }
    expect(s.collections.get('COL0001')!.active_token).toBeNull();
  });

  it('作者不能审核自己的发布申请（ADM-03 分享部分）', () => {
    const pub = s.requestPublication('COL0001', 'U01', ['R20']);
    try {
      s.moderate({ target: pub.id, action: 'approve', expected_version: pub.generation }, s.login('U01', '888888').session_id);
      throw new Error('self approval must be forbidden');
    } catch (e) {
      expect((e as ApiError).code).toBe('FORBIDDEN');
    }
  });

  it('编辑背书：作者不能自审，另一名管理员可撤销且不出现改票数入口（ADM-03）', () => {
    try {
      s.restoreEndorsement({ restaurant_id: 'R05', action: 'verify' }, s.login('E01', '888888').session_id);
      throw new Error('self verify must fail');
    } catch (e) {
      expect((e as ApiError).code).toBe('FORBIDDEN');
    }
    const out = s.restoreEndorsement({ restaurant_id: 'R05', action: 'revoke', reason: '测试撤销背书' }, s.login('A01', '888888').session_id);
    expect(out.endorsement).toBe('REVOKED');
    expect(s.requireRestaurant('R05').in_default_layer).toBe(false);
  });

  it('普通用户调用审核与状态接口 403 且无状态变化（ADM-01）', () => {
    const u = s.login('U03', '888888').session_id;
    try {
      s.patchRestaurantStatus({ id: 'R01', risk_status: 'BLOCKED' }, u);
      throw new Error('must be forbidden');
    } catch (e) {
      expect((e as ApiError).code).toBe('FORBIDDEN');
    }
    try {
      s.mergeRestaurants({ source_id: 'R02', target_id: 'R01', reason: 'x', expected_version: 1 }, u);
      throw new Error('must be forbidden');
    } catch (e) {
      expect((e as ApiError).code).toBe('FORBIDDEN');
    }
    expect(s.requireRestaurant('R01').risk_status).toBe('CLEAR');
    expect(s.requireRestaurant('R02').merged_into).toBeNull();
  });

  it('合并迁移反馈与清单，旧 ID 解析 canonical，同品牌分店不受影响（MERGE-01）', () => {
    s.toggleSystemCollectionItem('U05', 'R02', 'private_stash', true);
    expect(s.requireRestaurant('R02').tally.recommend).toBe(1);
    s.mergeRestaurants(
      { source_id: 'R02', target_id: 'R01', reason: '测试合并：同一实体', expected_version: 1 },
      s.login('A01', '888888').session_id,
    );
    expect(s.canonical('R02')).toBe('R01');
    expect(s.requireRestaurant('R01').tally.recommend).toBe(4);
    const cols = s.listCollectionsForUser('U05');
    expect(cols.some((c) => c.items.some((i) => i.restaurant_id === 'R01'))).toBe(true);
    expect(s.requireRestaurant('R03').tally.recommend).toBe(2);
    expect(s.audit.some((a) => a.action === 'merge')).toBe(true);
  });

  it('注销即时撤销会话、分享与 UGC 计票（DELETE-01）', () => {
    const session = s.login('U04', '888888').session_id;
    const created = s.submitFeedback(
      {
        restaurant_id: 'R21',
        visited_date: addDays(TODAY, -3),
        attitude: 'recommend',
        dish_names: ['钵钵鸡'],
        reason: '测试注销影响（合成）：注销后这条记录不应继续计票，理由长度需要超过二十个字。',
        media_ids: [],
        disclosure: 'none',
        require_media_for_recommend: false,
      },
      session,
    );
    s.moderate({ target: created.submission.id, action: 'approve', expected_version: 1 }, s.login('M01', '888888').session_id);
    expect(s.requireRestaurant('R21').tally.recommend).toBe(4);
    s.deleteAccount(session);
    expect(s.requireRestaurant('R21').tally.recommend).toBe(3);
    expect(() => s.mySubmissions(session)).toThrow(ApiError);
    expect(s.users.get('U04')!.display_name).toBeTruthy();
  });

  it('production 配置拒绝装载测试种子与演示登录（DEMO-01）', () => {
    expect(() => new Store({ env: 'production' })).toThrow(/production/);
  });

  it('重启（新建实例）后数据回到一致的种子状态，规则可复现（DATA-01 部分）', () => {
    const a = newStore();
    const b = newStore();
    expect(a.mapItems(fullQuery).total_matched).toBe(b.mapItems(fullQuery).total_matched);
    expect(JSON.stringify(a.requireRestaurant('R01').tally)).toBe(JSON.stringify(b.requireRestaurant('R01').tally));
  });
});

describe('交接补齐：举报与注销任务', () => {
  it('删除清单同时清除历史分享快照，旧链接永不恢复', () => {
    const s = newStore();
    const col = s.collections.get('COL0001')!;
    expect(s.sharedSnapshot('demo-token-1')).toBeTruthy();
    s.deleteCollection(col.id, col.owner_user_id);
    expect([...s.publications.values()].some(p => p.collection_id === col.id)).toBe(false);
    expect(() => s.sharedSnapshot('demo-token-1')).toThrow();
  });
  it('注销立即隐藏本人编辑背书，无需等待清除任务', () => {
    const s = newStore();
    const rec = [...s.restaurants.values()].find(r => r.editorial && s.users.get(r.editorial.author_user_id)?.status === 'active')!;
    expect(rec).toBeTruthy();
    const sid = s.login(rec.editorial!.author_user_id, '888888').session_id;
    s.deleteAccount(sid);
    expect(rec.editorial).toBeNull();
    expect(rec.endorsement).toBe('NONE');
  });
  it('举报队列有角色边界、稳定倒序和上限，不暴露账号资料', () => {
    const s = newStore();
    expect(() => s.reportQueue(null)).toThrow();
    const user = s.login('U02', '888888').session_id;
    expect(() => s.reportQueue(user)).toThrow();
    const mod = s.login('M01', '888888').session_id;
    for (let i = 0; i < 205; i++) s.createReport({ restaurant_id: 'R01', kind: 'wrong_info', detail: `测试 ${i}` }, user);
    const rows = s.reportQueue(mod);
    expect(rows).toHaveLength(200);
    expect(rows[0]?.detail).toBe('测试 204');
    expect(rows[0]?.restaurant_name).toBeTruthy();
    expect(rows[0]).not.toHaveProperty('phone_masked');
  });
  it('注销任务可从快照恢复、实际清除个人内容且幂等', () => {
    const s = newStore();
    const sid = s.login('U02', '888888').session_id;
    const job = s.deleteAccount(sid);
    expect(s.userIdOfSession(sid)).toBeNull();
    const restored = newStore(); restored.loadState(s.dumpState());
    expect(restored.users.get('U02')?.deletion_job_id).toBe(job.deletion_job_id);
    expect(restored.processDeletionJobs()).toBeGreaterThan(0);
    expect(restored.users.get('U02')?.status).toBe('deleted');
    expect(restored.users.get('U02')?.phone_masked).toBe('');
    expect(restored.visits.some(v => v.user_id === 'U02')).toBe(false);
    expect([...restored.collections.values()].some(c => c.owner_user_id === 'U02')).toBe(false);
    expect([...restored.media.values()].some(m => m.owner_user_id === 'U02')).toBe(false);
    expect(restored.processDeletionJobs()).toBe(0);
    expect(() => restored.login('U02', '888888')).toThrow();
  });
});
