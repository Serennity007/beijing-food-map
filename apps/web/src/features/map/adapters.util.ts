/**
 * 纯函数层：坐标系换算、标记视觉（形状 / 字母 / 空心）与视野计算。
 *
 * 坐标口径（重要）：
 * 1) 业务层与数据合同（MapEntity、Bounds）里的经纬度一律是 GCJ-02。
 * 2) 只有 MapLibre + OSM 底图是 WGS84，所以进适配器时 toRender() 转一次、
 *    出适配器时 fromRender() 转回来；高德适配器两端都是恒等，绝不二次偏移。
 *
 * 这里除了 createMarkerEl/updateMarkerEl 两个显式的 DOM 辅助以外都不碰浏览器对象，
 * 因此可以在 vitest 的 node 环境下直接测（见 map.test.ts）。
 */

import {
  CUISINE_LABEL,
  gcj02ToWgs84,
  straightLineMeters,
  wgs84ToGcj02,
  type Bounds,
  type Cuisine,
  type MapClusterItem,
  type MapEntity,
  type MapRestaurantItem,
} from '@qianwei/contracts';
import { MAX_ZOOM, MIN_ZOOM, type MapEngine, type MapInsets, type MapViewportState } from './types';

export interface LngLat {
  lng: number;
  lat: number;
}

/** 底图不可用时统一提示（页面层据此回落到列表，MAP-06）。 */
export const BASEMAP_ERROR = '地图底图加载失败，可用列表继续浏览';

/** 缺 Key 时高德适配器只说这一句，然后什么都不做（页面层继续用开源底图）。 */
export const AMAP_MISSING_KEY = '未配置高德 Key，已使用开源底图';

/** 首次进入地图的默认层级：能看到主要商圈，又不至于全是一堆聚合。 */
export const DEFAULT_ZOOM = 11;

/** 业务坐标（GCJ-02）→ 底图渲染坐标。MapLibre 需要 WGS84，高德原样使用。 */
export function toRender(lng: number, lat: number, engine: MapEngine): LngLat {
  return engine === 'maplibre' ? gcj02ToWgs84(lng, lat) : { lng, lat };
}

/** 底图渲染坐标 → 业务坐标（GCJ-02），与 toRender 严格互逆。 */
export function fromRender(lng: number, lat: number, engine: MapEngine): LngLat {
  return engine === 'maplibre' ? wgs84ToGcj02(lng, lat) : { lng, lat };
}

export function toRenderBounds(bounds: Bounds, engine: MapEngine): Bounds {
  const sw = toRender(bounds.west, bounds.south, engine);
  const ne = toRender(bounds.east, bounds.north, engine);
  return { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
}

export function fromRenderBounds(bounds: Bounds, engine: MapEngine): Bounds {
  const sw = fromRender(bounds.west, bounds.south, engine);
  const ne = fromRender(bounds.east, bounds.north, engine);
  return { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat };
}

/** 把底图回报的（渲染系）视野换算成业务口径（GCJ-02），zoom 夹进合同允许区间。 */
export function buildViewport(
  engine: MapEngine,
  rawBounds: Bounds,
  rawZoom: number,
  rawCenter: LngLat,
): MapViewportState {
  const center = fromRender(rawCenter.lng, rawCenter.lat, engine);
  return {
    bounds: fromRenderBounds(rawBounds, engine),
    zoom: clampZoom(rawZoom),
    center,
  };
}

export function clampZoom(zoom: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}

export function isCluster(entity: MapEntity): entity is MapClusterItem {
  return entity.kind === 'cluster';
}

/* ------------------------------------------------------------------ 环境变量 */

/**
 * 只读 import.meta.env，缺失时返回空串：底图地址与高德 Key 全部可被环境变量覆盖，
 * 且任何一项缺失都不该让地图抛异常（无 Key 时走开源底图）。
 */
export function readEnv(key: string): string {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/* ------------------------------------------------------------------ 标记视觉 */

/**
 * 可达性：颜色之外必须有形状 + 字母差异，色盲/黑白打印也能区分菜系。
 * 形状与字母一一对应，永不单独依赖颜色。
 */
export type MarkerShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon';

export interface CuisineMark {
  shape: MarkerShape;
  letter: string;
  /** CSS 自定义属性名对应的取值（见 map.css 的 .qm-tone-*）。 */
  tone: string;
  label: string;
}

export const CUISINE_MARK: Record<Cuisine, CuisineMark> = {
  guizhou: { shape: 'circle', letter: '贵', tone: 'guizhou', label: CUISINE_LABEL.guizhou },
  sichuan: { shape: 'triangle', letter: '川', tone: 'sichuan', label: CUISINE_LABEL.sichuan },
  chongqing: { shape: 'square', letter: '渝', tone: 'chongqing', label: CUISINE_LABEL.chongqing },
  yunnan: { shape: 'diamond', letter: '滇', tone: 'yunnan', label: CUISINE_LABEL.yunnan },
  other: { shape: 'hexagon', letter: '味', tone: 'other', label: CUISINE_LABEL.other },
};

/** 本店属于多个菜系时取优先级最高的一个作为标记分组（贵州 > 四川 > 重庆 > 云南 > 其他）。 */
export const CUISINE_PRIORITY: Cuisine[] = ['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'];

export function cuisineGroup(cuisines: readonly Cuisine[] | null | undefined): Cuisine {
  for (const c of CUISINE_PRIORITY) {
    if (cuisines && cuisines.indexOf(c) >= 0) return c;
  }
  return 'other';
}

export function clusterCountText(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '1';
  return count > 999 ? '999+' : String(count);
}

export interface MarkerView {
  kind: 'cluster' | 'restaurant';
  shape: MarkerShape;
  /** 聚合显示数字，门店显示菜系字母（形状之外的第二重非颜色线索）。 */
  text: string;
  tone: string;
  /** 待核实门店：空心/描边样式。 */
  hollow: boolean;
  selected: boolean;
  className: string;
  ariaLabel: string;
  /** 聚合需要居中锚点，门店图钉用底部锚点。 */
  anchor: 'center' | 'bottom';
}

export function restaurantAriaLabel(item: MapRestaurantItem): string {
  const group = cuisineGroup(item.cuisines);
  const branch = item.branch ? `（${item.branch}）` : '';
  const pending = item.pending_verification ? '，位置待核实' : '';
  return `${CUISINE_MARK[group].label} ${item.name}${branch}${pending}，查看门店`;
}

export function clusterAriaLabel(item: MapClusterItem): string {
  return `聚合 ${item.count} 家，点击放大该范围`;
}

export function markerView(entity: MapEntity, selected: boolean): MarkerView {
  if (entity.kind === 'cluster') {
    return {
      kind: 'cluster',
      shape: 'circle',
      text: clusterCountText(entity.count),
      tone: 'cluster',
      hollow: false,
      selected,
      className: `qm-marker qm-marker--cluster qm-shape-circle qm-tone-cluster${selected ? ' qm-marker--selected' : ''}`,
      ariaLabel: clusterAriaLabel(entity),
      anchor: 'center',
    };
  }
  const mark = CUISINE_MARK[cuisineGroup(entity.cuisines)];
  const hollow = entity.pending_verification;
  const className = [
    'qm-marker',
    'qm-marker--restaurant',
    `qm-shape-${mark.shape}`,
    `qm-tone-${mark.tone}`,
    hollow ? 'qm-marker--hollow' : '',
    selected ? 'qm-marker--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    kind: 'restaurant',
    shape: mark.shape,
    text: mark.letter,
    tone: mark.tone,
    hollow,
    selected,
    className,
    ariaLabel: restaurantAriaLabel(entity),
    anchor: 'bottom',
  };
}

/**
 * 标记内部结构：形状 + 字母 + 图钉尖，形状与字母都写进 DOM 便于样式与读屏。
 * 用 DOM 构造而不是 innerHTML 拼串：门店名等数据将来来自用户投稿，
 * 任何数据都不允许经过 HTML 字符串解析（对存储型 XSS 的模式性防线）。
 */
export function appendMarkerChildren(el: HTMLElement, view: MarkerView): void {
  const badge = document.createElement('span');
  badge.className = 'qm-marker__badge';
  badge.dataset.shape = view.shape;
  badge.dataset.hollow = view.hollow ? '1' : '0';
  const glyph = document.createElement('span');
  glyph.className = 'qm-marker__glyph';
  glyph.textContent = view.text;
  badge.appendChild(glyph);
  el.appendChild(badge);
  if (view.kind === 'restaurant') {
    const tip = document.createElement('span');
    tip.className = 'qm-marker__tip';
    tip.setAttribute('aria-hidden', 'true');
    el.appendChild(tip);
  }
}

/**
 * 增量更新的“指纹”：坐标/文字/形状/空心任一项变了才重绘 DOM，
 * 其余情况只挪 marker，避免每次数据刷新都重建节点。
 */
export function entitySignature(entity: MapEntity): string {
  const lng = entity.longitude.toFixed(5);
  const lat = entity.latitude.toFixed(5);
  if (entity.kind === 'cluster') return `c|${lng}|${lat}|${entity.count}`;
  const group = cuisineGroup(entity.cuisines);
  return `r|${lng}|${lat}|${group}|${entity.pending_verification ? 1 : 0}|${entity.name}`;
}

/* ---------------------------------------------------------------------- DOM */

export function createMarkerEl(entity: MapEntity, selected: boolean): HTMLElement {
  const el = document.createElement('div');
  el.dataset.qmMarker = entity.id;
  applyMarkerView(el, entity, selected);
  return el;
}

export function applyMarkerView(el: HTMLElement, entity: MapEntity, selected: boolean): void {
  const view = markerView(entity, selected);
  el.className = view.className;
  el.textContent = '';
  appendMarkerChildren(el, view);
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', view.ariaLabel);
  el.setAttribute('aria-pressed', selected ? 'true' : 'false');
  if (view.kind === 'cluster') el.setAttribute('aria-haspopup', 'true');
}

/** 「我的位置」标记：两种底图共用同一个 DOM，视觉与门店/聚合都不重叠。 */
export function createUserLocationEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'qm-marker qm-marker--me';
  const pulse = document.createElement('span');
  pulse.className = 'qm-marker__pulse';
  pulse.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span');
  dot.className = 'qm-marker__dot';
  el.appendChild(pulse);
  el.appendChild(dot);
  el.setAttribute('aria-label', '我的位置');
  el.setAttribute('role', 'img');
  return el;
}

/* ------------------------------------------------------------------- 视野计算 */

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * 把抽屉遮挡换算成 fitBounds 的非对称留白，并保证四周留白之后中间一定有可视区：
 * 留白合计超过画布时 maplibre 会判定「放不下」而直接拒绝移动相机，这里硬性夹住。
 */
export function viewportPadding(insets: MapInsets | undefined, width: number, height: number): EdgeInsets {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const edge = 12;
  const vertical = h * 0.4;
  const horizontal = w * 0.4;
  let top = clamp(insets?.top ?? 0, 0, vertical);
  let bottom = clamp(insets?.bottom ?? 0, 0, vertical);
  const left = clamp(insets?.left ?? 0, 0, horizontal);
  if (top + bottom > h * 0.8) {
    const scale = (h * 0.8) / (top + bottom);
    top *= scale;
    bottom *= scale;
  }
  return {
    top: top + edge,
    right: edge,
    bottom: bottom + edge,
    left: left + edge,
  };
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/**
 * 视野是否“值得再发一次请求”：中心位移小于 5 米且 zoom 基本没变就跳过，
 * 防止点击/微小回弹造成的请求风暴（bounds 由 center+zoom 唯一决定，地图不旋转不倾斜）。
 */
export function shouldEmitViewport(prev: MapViewportState | null, next: MapViewportState): boolean {
  if (!prev) return true;
  if (Math.abs(prev.zoom - next.zoom) > 0.02) return true;
  return straightLineMeters(prev.center, next.center) > 5;
}

/** 视野上报防抖：moveend/zoomend 连续触发时只发最后一次。 */
export function createDebouncer(run: () => void, delayMs: number): { schedule(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export function boundsOf(
  west: number,
  south: number,
  east: number,
  north: number,
): Bounds {
  return { west, south, east: Math.max(east, west), north: Math.max(north, south) };
}

/** 单点视野（把选中标记平移进可视区时用的退化矩形）。 */
export function pointBounds(lng: number, lat: number): Bounds {
  return boundsOf(lng, lat, lng, lat);
}
