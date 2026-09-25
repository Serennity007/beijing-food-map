import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';
import { BEIJING_BOUNDS, BEIJING_CENTER, type Bounds, type MapEntity } from '@qianwei/contracts';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
  type MapAdapter,
  type MapAdapterEvents,
  type MapEngine,
  type MapInsets,
  type MapViewportState,
} from './types';
import {
  applyMarkerView,
  BASEMAP_ERROR,
  buildViewport,
  clampZoom,
  createDebouncer,
  createMarkerEl,
  createUserLocationEl,
  DEFAULT_ZOOM,
  entitySignature,
  fromRender,
  markerView,
  readEnv,
  shouldEmitViewport,
  toRender,
  toRenderBounds,
  viewportPadding,
} from './adapters.util';

/**
 * MapLibre GL 适配器：真实瓦片底图 + DOM 标记，不用任何图片假地图。
 *
 * 依赖告警说明（GHSA-jrc7-96c5-q579，修复在 6.11.x，跨大版本）：
 * 漏洞在 MapLibre 的 DOM.sanitize()，只有把 HTML 字符串交给 popup 等内部清洗路径才会触及。
 * 本适配器不创建 popup、只把自建 DOM 元素交给 MapLibre，标记子元素也是纯 DOM 构造
 * （见 adapters.util appendMarkerChildren），没有任何字符串进入 MapLibre 的清洗器，
 * 因此该 CVE 在本仓库的使用面上不可达。升级 6.x 属破坏性变更，单独立项验证。
 *
 * 坐标口径：数据合同是 GCJ-02，MapLibre 底图是 WGS84 —— 进 SDK 前 toRender() 转一次，
 * 出 SDK（视野上报）前 fromRender() 转回来；业务层与页面层永远只见 GCJ-02。
 */

export { BASEMAP_ERROR, DEFAULT_ZOOM };

/** 无 Key 的默认矢量底图（OpenFreeMap Liberty），VITE_MAP_STYLE 可整体覆盖。 */
export const DEFAULT_VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const CLUSTER_FIT_MAX_ZOOM = 17;
/** 主底图 8 秒不中就换兜底栅格，兜底再 6 秒仍不中才提示失败（MAP-06）。 */
const STYLE_TIMEOUT_MS = 8000;
const FALLBACK_STYLE_TIMEOUT_MS = 6000;
/** 首屏前累计这么多次错误就认为底图坏了（单个瓦片抖动不该降级）。 */
const ERROR_BEFORE_FALLBACK = 2;
const ERROR_AFTER_FALLBACK = 4;

/** 兜底栅格底图：CARTO/OSM 公共瓦片，零 Key；VITE_MAP_FALLBACK_STYLE 可整体替换。 */
export function fallbackRasterStyle(): StyleSpecification {
  const override = readEnv('VITE_MAP_FALLBACK_STYLE');
  if (override) return override as unknown as StyleSpecification;
  return {
    version: 8,
    sources: {
      'qm-carto': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [{ id: 'qm-carto-layer', type: 'raster', source: 'qm-carto', maxzoom: 19 }],
  } as unknown as StyleSpecification;
}

/** 实际使用的底图（URL 或内联 style），全部可被环境变量覆盖，永不要求 Key。 */
export function primaryStyle(): string | StyleSpecification {
  return readEnv('VITE_MAP_STYLE') || DEFAULT_VECTOR_STYLE;
}

/** 底图控件文案中文化（tooltip 与读屏都跟随）。 */
const ZH_LOCALE = {
  'NavigationControl.ZoomIn': '放大',
  'NavigationControl.ZoomOut': '缩小',
  'NavigationControl.ResetBearing': '正北朝上',
};

interface MarkerRecord {
  marker: Marker;
  el: HTMLElement;
  entity: MapEntity;
  signature: string;
  anchor: 'center' | 'bottom';
  detach(): void;
}

export class MaplibreAdapter implements MapAdapter {
  readonly engine: MapEngine = 'maplibre';

  private map: MapLibreMap | null = null;
  private events: MapAdapterEvents | null = null;
  private nav: NavigationControl | null = null;
  private records = new Map<string, MarkerRecord>();
  private userMarker: Marker | null = null;
  private selectedId: string | null = null;
  private debouncer: { schedule(): void; cancel(): void } | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private lastViewport: MapViewportState | null = null;
  private styleLabel = DEFAULT_VECTOR_STYLE;
  private destroyed = false;
  private ready = false;
  private fallenBack = false;
  private errorReported = false;
  private styleErrors = 0;

  // ---------------------------------------------------------------- 生命周期

  mount(container: HTMLElement, initial: MapViewportState | null, events: MapAdapterEvents, opts?: { canvasLabel?: string }): void {
    if (this.destroyed || this.map) return;
    this.events = events;
    const style = primaryStyle();
    this.styleLabel = typeof style === 'string' ? style : 'inline-raster';
    const startCenter = initial?.center ?? BEIJING_CENTER;
    const start = toRender(startCenter.lng, startCenter.lat, this.engine);
    const box = toRenderBounds(BEIJING_BOUNDS, this.engine);

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style,
        center: [start.lng, start.lat],
        zoom: clampZoom(initial?.zoom ?? DEFAULT_ZOOM),
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: [[box.west, box.south], [box.east, box.north]],
        renderWorldCopies: false,
        // 美食地图保持正北不倾斜：视野只由 center+zoom 决定，文字永远可读。
        dragRotate: false,
        touchPitch: false,
        maxPitch: 0,
        // 桌面滚轮缩放、移动端双指缩放与拖移（maplibre 默认开启，这里显式声明意图）
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        dragPan: true,
        touchZoomRotate: true,
        keyboard: true,
        hash: false,
        attributionControl: { compact: true },
        locale: ZH_LOCALE,
      });
    } catch (error) {
      // WebGL 不可用等硬失败：立刻提示，页面层回退到列表。
      this.logIssue(error);
      this.reportFailure();
      return;
    }

    this.map = map;
    // SDK 默认给画布的标签是英文 "Map"，只说"这是地图"没告诉人怎么用键盘走。
    // 整页地图与表单内嵌选点图的指引不同，标签由调用方传入。
    map.getCanvas().setAttribute(
      'aria-label',
      opts?.canvasLabel ??
        '地图画布：聚焦后可用方向键平移、加号与减号缩放；回车不在这里选点，新增门店请在下方表单填写坐标',
    );
    this.debouncer = createDebouncer(() => this.emitViewport(), VIEWPORT_DEBOUNCE_MS);
    this.nav = new NavigationControl({ showCompass: false, visualizePitch: false });
    map.addControl(this.nav, 'bottom-right');

    map.on('load', this.onLoad);
    map.on('idle', this.onIdle);
    map.on('error', this.onMapError);
    map.on('moveend', this.onCameraSettled);
    map.on('zoomend', this.onCameraSettled);
    map.on('webglcontextlost', this.onContextLost);
    // 点空白处 = 选点。底图是 WGS84，出 SDK 前必须转回 GCJ-02，页面层永远只见业务坐标。
    map.on('click', (ev) => {
      const g = fromRender(ev.lngLat.lng, ev.lngLat.lat, this.engine);
      this.events?.onMapPoint({ lng: Number(g.lng.toFixed(5)), lat: Number(g.lat.toFixed(5)) });
    });
    this.armWatchdog(STYLE_TIMEOUT_MS);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearWatchdog();
    this.debouncer?.cancel();
    this.debouncer = null;
    for (const rec of this.records.values()) {
      rec.detach();
      rec.marker.remove();
    }
    this.records.clear();
    this.userMarker?.remove();
    this.userMarker = null;
    const map = this.map;
    if (map) {
      if (this.nav) {
        try {
          map.removeControl(this.nav);
        } catch (error) {
          this.logIssue(error);
        }
        this.nav = null;
      }
      map.off('load', this.onLoad);
      map.off('idle', this.onIdle);
      map.off('error', this.onMapError);
      map.off('moveend', this.onCameraSettled);
      map.off('zoomend', this.onCameraSettled);
      map.off('webglcontextlost', this.onContextLost);
      map.remove();
    }
    this.map = null;
    this.events = null;
    this.lastViewport = null;
  }

  resize(): void {
    this.map?.resize();
  }

  // -------------------------------------------------------------- 底图健康度

  private onLoad = (): void => {
    this.markReady();
  };

  private onIdle = (): void => {
    if (this.ready || !this.map) return;
    if (this.map.isStyleLoaded()) this.markReady();
  };

  private onContextLost = (event: unknown): void => {
    this.logIssue(event);
    this.reportFailure();
  };

  private markReady(): void {
    if (this.ready || this.destroyed) return;
    this.ready = true;
    this.clearWatchdog();
    this.events?.onReady();
    this.emitViewport();
  }

  private onMapError = (event: unknown): void => {
    this.logIssue(event);
    // 首屏成功之后的瓦片抖动不打扰用户（底图已在，缺几块瓦片不算失败）。
    if (this.destroyed || this.ready) return;
    const message = eventMessage(event);
    const pointsAtCurrentStyle = message.includes(this.styleLabel);
    this.styleErrors += 1;
    if (this.fallenBack) {
      if (pointsAtCurrentStyle || this.styleErrors >= ERROR_AFTER_FALLBACK) this.reportFailure();
      return;
    }
    if (pointsAtCurrentStyle || this.styleErrors >= ERROR_BEFORE_FALLBACK) this.switchToFallbackStyle();
  };

  private switchToFallbackStyle(): void {
    if (this.fallenBack || !this.map) return;
    this.fallenBack = true;
    this.styleErrors = 0;
    const override = readEnv('VITE_MAP_FALLBACK_STYLE');
    this.styleLabel = override || 'inline-raster';
    try {
      this.map.setStyle(fallbackRasterStyle(), { diff: false });
    } catch (error) {
      this.logIssue(error);
      this.reportFailure();
      return;
    }
    this.armWatchdog(FALLBACK_STYLE_TIMEOUT_MS);
  }

  private armWatchdog(ms: number): void {
    this.clearWatchdog();
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (this.destroyed || this.ready) return;
      if (this.fallenBack) this.reportFailure();
      else this.switchToFallbackStyle();
    }, ms);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }

  /** onError 每次挂载最多一次：页面层据此显示列表，不反复打断（MAP-06）。 */
  private reportFailure(): void {
    if (this.errorReported || this.destroyed) return;
    this.errorReported = true;
    this.clearWatchdog();
    this.events?.onError(BASEMAP_ERROR);
  }

  private logIssue(error: unknown): void {
    if (readEnv('MODE') === 'test') return;
    console.warn('[map/maplibre]', error);
  }

  // ------------------------------------------------------------------- 标记

  /** 增量更新：按 id 复用 DOM marker，新增的加、消失的删，地图实例与相机完全不动。 */
  setItems(items: MapEntity[]): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    const alive = new Set<string>();
    for (const entity of items) {
      alive.add(entity.id);
      const signature = entitySignature(entity);
      const anchor = markerView(entity, false).anchor;
      let rec = this.records.get(entity.id);
      if (rec && rec.anchor !== anchor) {
        // 同一 id 在「聚合牌 / 图钉」之间互换（极少），锚点不同才需要重建这一个 marker。
        rec.detach();
        rec.marker.remove();
        this.records.delete(entity.id);
        rec = undefined;
      }
      if (rec) {
        rec.entity = entity;
        if (rec.signature !== signature) {
          rec.signature = signature;
          applyMarkerView(rec.el, entity, this.selectedId === entity.id);
          rec.marker.setLngLat(this.renderPosition(entity));
        }
        continue;
      }
      this.addMarker(entity, anchor, signature);
    }
    for (const [id, rec] of [...this.records]) {
      if (alive.has(id)) continue;
      rec.detach();
      rec.marker.remove();
      this.records.delete(id);
    }
  }

  private addMarker(entity: MapEntity, anchor: 'center' | 'bottom', signature: string): void {
    const map = this.map;
    if (!map) return;
    const el = createMarkerEl(entity, this.selectedId === entity.id);
    const marker = new Marker({ element: el, anchor, subpixelPositioning: true })
      .setLngLat(this.renderPosition(entity))
      .addTo(map);
    this.records.set(entity.id, {
      marker,
      el,
      entity,
      signature,
      anchor,
      detach: bindMarkerClicks(el, () => this.activate(entity.id)),
    });
  }

  private renderPosition(entity: MapEntity): [number, number] {
    const p = toRender(entity.longitude, entity.latitude, this.engine);
    return [p.lng, p.lat];
  }

  private activate(id: string): void {
    const rec = this.records.get(id);
    if (!rec) return;
    const entity = rec.entity;
    if (entity.kind === 'cluster') {
      // 聚合点击：先缩到 expansion_bounds（GCJ-02 → 渲染坐标只转一次），再通知页面层重查。
      this.fitGcjBounds(entity.expansion_bounds, CLUSTER_FIT_MAX_ZOOM, undefined);
      this.events?.onSelectCluster(entity);
      return;
    }
    this.select(id);
    this.events?.onSelectRestaurant(entity.id);
  }

  select(id: string | null): void {
    if (this.selectedId === id) return;
    const prev = this.selectedId ? this.records.get(this.selectedId) : null;
    if (prev) applyMarkerView(prev.el, prev.entity, false);
    this.selectedId = id;
    const next = id ? this.records.get(id) : null;
    if (next) applyMarkerView(next.el, next.entity, true);
  }

  setCenterOn(id: string | null, insets: MapInsets): void {
    const map = this.map;
    if (!map || this.destroyed || !id) return;
    const rec = this.records.get(id);
    if (!rec) return;
    this.panToGcjPoint(this.renderPosition(rec.entity), insets);
  }

  centerOnPoint(point: { lng: number; lat: number }, insets: MapInsets): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    // 不查 records：目标可能根本不在当前点位集合里（搜索结果跨视野定位）。
    if (!Number.isFinite(point.lng) || !Number.isFinite(point.lat)) return;
    const g = toRender(point.lng, point.lat, this.engine);
    this.panToGcjPoint([g.lng, g.lat], insets);
  }

  /**
   * 退化成点 + 非对称留白：fitBounds 会把点落在「抽屉之上的可视区」中心；
   * maxZoom = 当前层级，因此只平移不缩放。
   */
  private panToGcjPoint(rendered: [number, number], insets: MapInsets): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    map.fitBounds(new LngLatBounds([rendered[0], rendered[1]], [rendered[0], rendered[1]]), {
      padding: viewportPadding(insets, this.canvasWidth(), this.canvasHeight()),
      maxZoom: clampZoom(map.getZoom()),
      linear: true,
      duration: 350,
      easing: easeOutCubic,
    });
  }

  fitBounds(bounds: Bounds, insets?: MapInsets): void {
    this.fitGcjBounds(bounds, MAX_ZOOM, insets);
  }

  private fitGcjBounds(bounds: Bounds, maxZoom: number, insets: MapInsets | undefined): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    if (!Number.isFinite(bounds.west) || !Number.isFinite(bounds.south)) return;
    const render = toRenderBounds(bounds, this.engine);
    map.fitBounds(
      new LngLatBounds(
        [render.west, render.south],
        [Math.max(render.east, render.west), Math.max(render.north, render.south)],
      ),
      {
        padding: viewportPadding(insets ?? { bottom: 0 }, this.canvasWidth(), this.canvasHeight()),
        maxZoom: clampZoom(maxZoom),
        linear: true,
        duration: 500,
        easing: easeOutCubic,
      },
    );
  }

  setUserLocation(point: { lng: number; lat: number } | null): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
      this.userMarker?.remove();
      this.userMarker = null;
      return;
    }
    const pos = toRender(point.lng, point.lat, this.engine);
    if (!this.userMarker) {
      this.userMarker = new Marker({ element: createUserLocationEl(), anchor: 'center' })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
      return;
    }
    this.userMarker.setLngLat([pos.lng, pos.lat]);
  }

  /** 同步返回当前视野（GCJ-02 口径），供页面层在请求时直接取用。 */
  getViewport(): MapViewportState {
    const map = this.map;
    if (!map) return defaultMapViewport();
    const b = map.getBounds();
    const c = map.getCenter();
    return buildViewport(
      this.engine,
      { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
      map.getZoom(),
      { lng: c.lng, lat: c.lat },
    );
  }

  isReady(): boolean {
    return this.ready;
  }

  getSelectedEntity(): MapEntity | null {
    const rec = this.selectedId ? this.records.get(this.selectedId) : null;
    return rec ? rec.entity : null;
  }

  private emitViewport(): void {
    if (!this.map || this.destroyed) return;
    const next = this.getViewport();
    if (!shouldEmitViewport(this.lastViewport, next)) return;
    this.lastViewport = next;
    this.events?.onViewportChange(next);
  }

  private onCameraSettled = (): void => {
    this.debouncer?.schedule();
  };

  private canvasWidth(): number {
    const el = this.map?.getContainer();
    const w = el?.clientWidth ?? 0;
    return w > 0 ? w : 1;
  }

  private canvasHeight(): number {
    const el = this.map?.getContainer();
    const h = el?.clientHeight ?? 0;
    return h > 0 ? h : 1;
  }
}

/** marker 的点击/键盘激活：Enter 与空格都能触发（图钉是按钮语义）。 */
function bindMarkerClicks(el: HTMLElement, activate: () => void): () => void {
  const onClick = (ev: Event) => {
    ev.stopPropagation();
    activate();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
    ev.preventDefault();
    ev.stopPropagation();
    activate();
  };
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('keydown', onKey);
  };
}

function eventMessage(event: unknown): string {
  if (typeof event !== 'object' || event === null) return '';
  const err = (event as { error?: unknown }).error;
  if (typeof err === 'object' && err !== null) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : '';
  }
  return typeof err === 'string' ? err : '';
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 兜底视野（GCJ-02）：页面层第一次进地图时的默认查询范围。 */
export function defaultMapViewport(): MapViewportState {
  return {
    bounds: { ...BEIJING_BOUNDS },
    zoom: DEFAULT_ZOOM,
    center: { ...BEIJING_CENTER },
  };
}

export function createMaplibreAdapter(): MapAdapter {
  return new MaplibreAdapter();
}
