import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, Store } from '../src/index';

/** 阶段 1B：举报工单的处置闭环。 */

const FIXED = Date.UTC(2026, 8, 22, 4, 0, 0);

function newStore(): Store {
  return new Store({ env: 'test', now: () => FIXED });
}

describe('阶段 1B 举报工单处置闭环', () => {
  let s: Store;
  const u01 = () => s.login('U01', '888888').session_id;
  const mod = () => s.login('M01', '888888').session_id;
  const admin = () => s.login('A01', '888888').session_id;

  const openTicket = () => {
    const sid = u01();
    const t = s.createReport({ restaurant_id: 'R21', kind: 'closed', detail: '测试举报（合成）：卷帘门落了一半，像是停业了。' }, sid);
    return { t, reporter: sid };
  };

  beforeEach(() => {
    s = newStore();
  });

  it('OPEN → IN_REVIEW → RESOLVED 正常流转，处理结果回写给举报人', () => {
    const { t } = openTicket();
    const started = s.decideReport({ id: t.id, action: 'start', expected_version: t.version }, mod());
    expect(started.status).toBe('IN_REVIEW');
    expect(started.result_note).toBeNull();
    expect(started.handled_by).toBeTruthy();

    const resolved = s.decideReport({ id: t.id, action: 'resolve', reason: '已实地电话核实并确认闭店，门店状态另单处理', expected_version: started.version }, mod());
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.result_note).toContain('已实地电话核实');
    expect(resolved.version).toBe(3);

    const mine = s.myReports(u01()).find((r) => r.id === t.id);
    expect(mine?.status).toBe('RESOLVED');
    expect(mine?.result_note).toContain('已实地电话核实');
  });

  it('结案与驳回必须写理由，开始复核不需要', () => {
    const { t } = openTicket();
    expect(() => s.decideReport({ id: t.id, action: 'resolve', expected_version: t.version }, mod())).toThrow(ApiError);
    expect(() => s.decideReport({ id: t.id, action: 'dismiss', reason: '  ', expected_version: t.version }, mod())).toThrow(/处理结果/);
    const started = s.decideReport({ id: t.id, action: 'start', expected_version: t.version }, mod());
    expect(started.status).toBe('IN_REVIEW');
  });

  it('终态不可回退，也不能重复处置；版本冲突 409', () => {
    const { t } = openTicket();
    const done = s.decideReport({ id: t.id, action: 'dismiss', reason: '现场核实仍在营业', expected_version: t.version }, admin());
    expect(done.status).toBe('DISMISSED');
    expect(() => s.decideReport({ id: t.id, action: 'start', expected_version: done.version }, mod())).toThrow(/不能执行此操作/);
    expect(() => s.decideReport({ id: t.id, action: 'resolve', reason: '再改一次', expected_version: done.version }, mod())).toThrow(ApiError);
    const open = openTicket();
    expect(() => s.decideReport({ id: open.t.id, action: 'start', expected_version: 999 }, mod())).toThrow(ApiError);
  });

  it('举报人本人不能处置自己的举报，即使他同时是审核员', () => {
    const reporterMod = mod();
    const own = s.createReport({ restaurant_id: 'R22', kind: 'wrong_info', detail: '测试举报（合成）：地址写错了。' }, reporterMod);
    expect(() => s.decideReport({ id: own.id, action: 'resolve', reason: '我自己改一下', expected_version: own.version }, reporterMod)).toThrow(/自己提交的举报|不能处置自己/);
    // 换一名审核员照常处置
    const byOther = s.decideReport({ id: own.id, action: 'start', expected_version: own.version }, admin());
    expect(byOther.status).toBe('IN_REVIEW');
    expect(byOther.is_reporter_self).toBe(false);
    const queue = s.reportQueue(reporterMod, 'IN_REVIEW');
    expect(queue.find((r) => r.id === own.id)?.is_reporter_self).toBe(true);
  });

  it('处置工单不会替门店下闭店或风险结论（REC-07：工单与状态分开）', () => {
    const { t } = openTicket();
    const before = s.requireRestaurant('R21');
    expect(before.business_status).toBe('OPEN');
    expect(before.risk_status).toBe('CLEAR');
    const started = s.decideReport({ id: t.id, action: 'start', expected_version: t.version }, mod());
    s.decideReport({ id: t.id, action: 'resolve', reason: '已核实闭店', expected_version: started.version }, mod());
    const after = s.requireRestaurant('R21');
    expect(after.business_status).toBe('OPEN');
    expect(after.risk_status).toBe('CLEAR');
    expect(after.version).toBe(before.version);
  });

  it('举报可以精确关联到某条反馈版本，且必须属于同一家门店', () => {
    const sid = u01();
    const sub = s.submitFeedback(
      {
        restaurant_id: 'R21',
        visited_date: '2026-09-10',
        attitude: 'recommend',
        dish_names: ['钵钵鸡'],
        reason: '测试内容（合成，非真实探店）：这条反馈要被人举报，理由长度需要超过二十个字。',
        media_ids: [],
        disclosure: 'none',
        require_media_for_recommend: false,
      },
      sid,
    );
    const target = sub.submission.id;
    const t = s.createReport({ restaurant_id: 'R21', kind: 'abuse', detail: '测试举报（合成）：这条内容与实吃不符。', feedback_target: target }, sid);
    expect(t.feedback_target).toBe(target);
    expect(() => s.createReport({ restaurant_id: 'R22', kind: 'abuse', detail: '跨门店关联举报', feedback_target: target }, sid)).toThrow(/不属于这家门店/);
    expect(() => s.createReport({ restaurant_id: 'R21', kind: 'abuse', detail: '指向不存在的反馈', feedback_target: 'V9999#v1' }, sid)).toThrow(ApiError);
  });

  it('处置动作进审计日志，队列按待处理优先', () => {
    const a = openTicket();
    const b = s.createReport({ restaurant_id: 'R22', kind: 'wrong_location', detail: '测试举报（合成）：点位在马路对面。' }, u01());
    const started = s.decideReport({ id: b.id, action: 'start', expected_version: b.version }, mod());
    s.decideReport({ id: started.id, action: 'dismiss', reason: '坐标与门牌一致', expected_version: started.version }, mod());
    const queue = s.reportQueue(admin());
    expect(queue.find((r) => r.id === a.t.id)).toBeDefined();
    const idxOpen = queue.findIndex((r) => r.id === a.t.id);
    const idxDismissed = queue.findIndex((r) => r.id === b.id);
    expect(idxOpen).toBeLessThan(idxDismissed);
    const audit = s.auditLog(admin());
    expect(audit.some((x) => x.action === 'report_start')).toBe(true);
    expect(audit.some((x) => x.action === 'report_dismiss')).toBe(true);
  });
});
