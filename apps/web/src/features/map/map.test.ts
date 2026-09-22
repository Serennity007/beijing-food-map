import { describe, expect, it } from 'vitest';
import {
  BEIJING_CENTER,
  gcj02ToWgs84,
  straightLineMeters,
  wgs84ToGcj02,
  type MapClusterItem,
  type MapRestaurantItem,
} from '@qianwei/contracts';
import {
  AMAP_MISSING_KEY,
  BASEMAP_ERROR,
  clampZoom,
  cuisineGroup,
  entitySignature,
  fromRender,
  markerView,
  readEnv,
  shouldEmitViewport,
  toRender,
  viewportPadding,
} from './adapters.util';
import { MAX_ZOOM, MIN_ZOOM, VIEWPORT_DEBOUNCE_MS } from './types';

/**
 * 只测纯函数部分：坐标换算、每菜系的标记形状/字母、视野留白。
 * 底图与 SDK 行为（瓦片加载、手势）需要真实浏览器，不在本文件覆盖范围。
 */

/** 国贸桥附近的一个已知点（GCJ-02 口径，数据合同里就是这个值）。 */
const GUOMAO_GCJ = { lng: 116.4074, lat: 39.9042 };

describe('坐标换算：只在适配器边界转一次', () => {
  it('GCJ-02 → WGS84 的偏移量在北京市区的合理区间内（100m ~ 1.5km）', () => {
    const wgs = gcj02ToWgs84(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat);
    const offsetMeters = straightLineMeters(GUOMAO_GCJ, wgs);
    expect(offsetMeters).toBeGreaterThan(100);
    expect(offsetMeters).toBeLessThan(1500);
    // 偏移方向：北京市区 GCJ-02 相对 WGS84 偏东偏北，所以减回来后经纬度都变小。
    expect(wgs.lng).toBeLessThan(GUOMAO_GCJ.lng);
    expect(wgs.lat).toBeLessThan(GUOMAO_GCJ.lat);
  });

  it('换算可逆：WGS84 → GCJ-02 回到原点（误差米级）', () => {
    const wgs = gcj02ToWgs84(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat);
    const back = wgs84ToGcj02(wgs.lng, wgs.lat);
    expect(straightLineMeters(GUOMAO_GCJ, back)).toBeLessThan(3);
    expect(back.lng).toBeCloseTo(GUOMAO_GCJ.lng, 5);
    expect(back.lat).toBeCloseTo(GUOMAO_GCJ.lat, 5);
  });

  it('toRender 只在 maplibre 分支生效，amap 分支恒等（不会二次偏移）', () => {
    const rendered = toRender(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat, 'maplibre');
    expect(rendered.lng).not.toBe(GUOMAO_GCJ.lng);
    expect(rendered).toEqual({ lng: expect.any(Number), lat: expect.any(Number) });
    const asIs = toRender(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat, 'amap');
    expect(asIs).toEqual({ lng: GUOMAO_GCJ.lng, lat: GUOMAO_GCJ.lat });
  });

  it('重复套用换算会被测出来：证明“只转一次”是硬约束', () => {
    const once = toRender(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat, 'maplibre');
    const twice = gcj02ToWgs84(once.lng, once.lat);
    expect(straightLineMeters(once, twice)).toBeGreaterThan(50);
    // 反向换算同样只转一次
    const roundTrip = fromRender(once.lng, once.lat, 'maplibre');
    expect(straightLineMeters(roundTrip, GUOMAO_GCJ)).toBeLessThan(3);
    expect(fromRender(GUOMAO_GCJ.lng, GUOMAO_GCJ.lat, 'amap')).toEqual(GUOMAO_GCJ);
  });

  it('北京以外的点不做偏移（outOfChina 保护）', () => {
    expect(toRender(2.349, 48.864, 'maplibre')).toEqual({ lng: 2.349, lat: 48.864 });
  });
});

describe('菜系标记：形状与字母双重编码，不单独依赖颜色', () => {
  it('多菜系时按优先级取分组（贵州 > 四川 > 重庆 > 云南 > 其他）', () => {
    expect(cuisineGroup(['other', 'guizhou'])).toBe('guizhou');
    expect(cuisineGroup(['chongqing', 'yunnan'])).toBe('chongqing');
    expect(cuisineGroup(['sichuan'])).toBe('sichuan');
    expect(cuisineGroup([])).toBe('other');
    expect(cuisineGroup(undefined)).toBe('other');
  });

  it('五个菜系各有各的形状与字母，两两不重复', () => {
    const groups = ['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'] as const;
    const shapes = new Set<string>();
    const letters = new Set<string>();
    const tones = new Set<string>();
    for (const g of groups) {
      const item: MapRestaurantItem = {
        kind: 'restaurant',
        id: `r-${g}`,
        name: '示例店',
        branch: null,
        longitude: GUOMAO_GCJ.lng,
        latitude: GUOMAO_GCJ.lat,
        cuisines: [g],
        price: { average: 80, report_count: 3 },
        top_dishes: [],
        sources: ['community'],
        pending_verification: false,
      };
      const view = markerView(item, false);
      shapes.add(view.shape);
      letters.add(view.text);
      tones.add(view.tone);
      expect(view.kind).toBe('restaurant');
      expect(view.hollow).toBe(false);
      expect(view.anchor).toBe('bottom');
      expect(view.ariaLabel).toContain('示例店');
      expect(view.className).toContain(`qm-tone-${g}`);
    }
    expect(shapes.size).toBe(5);
    expect(letters.size).toBe(5);
    expect(tones.size).toBe(5);
  });

  it('待核实门店渲染成空心标记，选中态体现在 class 与 aria 上', () => {
    const pending: MapRestaurantItem = {
      kind: 'restaurant',
      id: 'r-pending',
      name: '未核实的小馆',
      branch: '望京',
      longitude: GUOMAO_GCJ.lng,
      latitude: GUOMAO_GCJ.lat,
      cuisines: ['guizhou'],
      price: { average: null, report_count: 0 },
      top_dishes: ['酸汤鱼'],
      sources: ['editorial'],
      pending_verification: true,
    };
    const view = markerView(pending, true);
    expect(view.hollow).toBe(true);
    expect(view.className).toContain('qm-marker--hollow');
    expect(view.className).toContain('qm-marker--selected');
    expect(view.ariaLabel).toContain('望京');
    expect(view.ariaLabel).toContain('位置待核实');
  });

  it('聚合是居中的数字牌，形状/锚点都与门店图钉不同', () => {
    const cluster: MapClusterItem = {
      kind: 'cluster',
      id: 'v1-z13-x1-y1',
      count: 12,
      longitude: GUOMAO_GCJ.lng,
      latitude: GUOMAO_GCJ.lat,
      expansion_bounds: { west: 116.4, south: 39.9, east: 116.42, north: 39.92 },
      restaurant_ids: ['a', 'b'],
    };
    const view = markerView(cluster, false);
    expect(view.kind).toBe('cluster');
    expect(view.text).toBe('12');
    expect(view.anchor).toBe('center');
    expect(view.className).toContain('qm-marker--cluster');
    expect(view.ariaLabel).toContain('12 家');
    expect(markerView({ ...cluster, count: 1234 }, false).text).toBe('999+');
  });

  it('entitySignature：坐标/菜系/计数变化会换指纹，无关字段不会', () => {
    const base: MapRestaurantItem = {
      kind: 'restaurant',
      id: 'r1',
      name: 'A',
      branch: null,
      longitude: 116.4,
      latitude: 39.9,
      cuisines: ['guizhou'],
      price: { average: 60, report_count: 1 },
      top_dishes: [],
      sources: [],
      pending_verification: false,
    };
    const moved = { ...base, longitude: 116.41 };
    const repriced = { ...base, price: { average: 90, report_count: 9 } };
    expect(entitySignature(moved)).not.toBe(entitySignature(base));
    expect(entitySignature(repriced)).toBe(entitySignature(base));
  });
});

describe('视野计算', () => {
  it('clampZoom 夹在合同区间内', () => {
    expect(clampZoom(2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
    expect(clampZoom(13)).toBe(13);
    expect(VIEWPORT_DEBOUNCE_MS).toBe(250);
  });

  it('底部抽屉的留白不会吃掉整个画布（否则 fitBounds 会拒绝移动）', () => {
    const pad = viewportPadding({ bottom: 5000, top: 10, left: 20 }, 800, 600);
    expect(pad.bottom).toBeLessThanOrEqual(600 * 0.7 + 12);
    expect(pad.top + pad.bottom).toBeLessThan(600);
    expect(pad.left).toBeGreaterThan(20);
    expect(viewportPadding(undefined, 800, 600)).toEqual({ top: 12, right: 12, bottom: 12, left: 12 });
    // 极端抽屉高度（顶栏 + 全屏抽屉）也不能吃掉整个画布，否则相机会拒绝移动
    const crazy = viewportPadding({ bottom: 5000, top: 5000, left: 5000 }, 800, 600);
    expect(crazy.top + crazy.bottom).toBeLessThan(600);
    expect(crazy.left + crazy.right).toBeLessThan(800);
  });

  it('视野去抖判定：中心不动 + zoom 不变就不必再发请求', () => {
    const first = {
      bounds: { west: 116.4, south: 39.9, east: 116.5, north: 40 },
      zoom: 12,
      center: { lng: 116.45, lat: 39.95 },
    };
    expect(shouldEmitViewport(null, first)).toBe(true);
    expect(shouldEmitViewport(first, { ...first })).toBe(false);
    expect(shouldEmitViewport(first, { ...first, zoom: 13 })).toBe(true);
    expect(shouldEmitViewport(first, { ...first, center: { ...first.center, lat: 39.96 } })).toBe(true);
  });

  it('默认视野常量可用（页面层第一次查询的兜底范围）', () => {
    expect(BEIJING_CENTER.lng).toBeGreaterThan(116);
    expect(BASEMAP_ERROR).toContain('列表');
    expect(AMAP_MISSING_KEY).toContain('高德 Key');
    expect(readEnv('DEFINITELY_NOT_SET_IN_TEST')).toBe('');
  });
});
