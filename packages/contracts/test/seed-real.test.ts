import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '../src/enums';
import { Store } from '../src/store';
import { SEED_REAL_RESTAURANTS } from '../src/seed-real';

/** 真实门店事实档案（预览版）：零票数、地点待核验、无任何编造口碑。 */
describe('真实种子档案（seedProfile=real）', () => {
  it('装载真实门店：无合成测试数据、无任何反馈与占位图', () => {
    const store = new Store({ env: 'test', seedProfile: 'real' });
    expect(store.restaurants.size).toBe(SEED_REAL_RESTAURANTS.length);
    for (const r of store.restaurants.values()) {
      expect(r.is_test_data).toBe(false);
      expect(r.place_status).toBe('PENDING');
      expect(r.photo_media_ids).toEqual([]);
      expect(r.tally.total).toBe(0);
      expect(r.community).toBe('PENDING');
      expect(r.endorsement).toBe('NONE');
      expect(r.in_default_layer).toBe(false);
      expect(r.ineligibility_reasons).toContain('无有效推荐来源');
      expect(r.ineligibility_reasons).toContain('地点未核验通过');
    }
    expect(store.visits).toHaveLength(0);
    expect(store.media.size).toBe(0);
    expect(store.publications.size).toBe(0);
    expect(store.reports).toHaveLength(0);
  });

  it('deploymentMeta 如实报告档案与测试数据装载状态', () => {
    const real = new Store({ env: 'demo_static', seedProfile: 'real' }).deploymentMeta();
    expect(real.seed_profile).toBe('real');
    expect(real.test_data_loaded).toBe(false);
    const synth = new Store({ env: 'test', seedProfile: 'synthetic' }).deploymentMeta();
    expect(synth.seed_profile).toBe('synthetic');
    expect(synth.test_data_loaded).toBe(true);
  });

  it('待验证图层可见新收录门店；默认合格层为空（等待真实实吃）', () => {
    const store = new Store({ env: 'test', seedProfile: 'real' });
    const base = {
      bounds: { west: 116.0, south: 39.5, east: 116.8, north: 40.2 },
      zoom: 16,
      view: 'guizhou' as const,
      budget_max: null,
      include_unknown_budget: true,
      dish_or_tag: null,
      contract_version: CONTRACT_VERSION,
    };
    const pending = store.mapItems({ ...base, layer: 'pending_verification' });
    const pendingIds = pending.items.filter((i) => i.kind === 'restaurant').map((i) => i.id);
    expect(pendingIds).toEqual(['R50', 'R51', 'R52', 'R53', 'R54']);

    const qualified = store.mapItems({ ...base, layer: 'qualified' });
    expect(qualified.items).toHaveLength(0);
  });

  it('搜索命中真实店名与招牌菜', () => {
    const store = new Store({ env: 'test', seedProfile: 'real' });
    const byName = store.search('三个贵州人');
    expect(byName.own.length).toBeGreaterThanOrEqual(2);
    const byDish = store.search('酸汤鱼');
    expect(byDish.own.length).toBeGreaterThanOrEqual(4);
  });

  it('真实档案在 production 也可装载（真实事实不是测试数据）', () => {
    expect(() => new Store({ env: 'production', seedProfile: 'real' })).not.toThrow();
    expect(() => new Store({ env: 'production', seedProfile: 'synthetic' })).toThrow(/拒绝装载测试种子/);
  });
});
