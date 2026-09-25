import { load as loadAmapJsApi } from '@amap/amap-jsapi-loader';
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
  AMAP_MISSING_KEY,
  BASEMAP_ERROR,
  buildViewport,
  clampZoom,
  createDebouncer,
  createMarkerEl,
  createUserLocationEl,
  DEFAULT_ZOOM,
  entitySignature,
  markerView,
  readEnv,
  shouldEmitViewport,
  toRender,
  viewportPadding,
  type LngLat,
} from './adapters.util';

/**
 * 高德（AMap）适配器：与 MapLibre 适配器实现同一个 MapAdapter 接口。
 *
 * 坐标口径：高德底图本身就是 GCJ-02，这里 toRender()/fromRender() 都是恒等函数，
 * 所以同一段业务代码在两种底图之间切换时不会发生二次偏移。
 *
 * 未配置 VITE_AMAP_KEY 时 mount 立刻回报「未配置高德 Key，已使用开源底图」并返回，
 * 不加载脚本、不抛异常 —— 页面层会继续用 MapLibre 底图。
 */

export { AMAP_MISSING_KEY };

/**
 * 高德 JSAPI 没有随包类型定义（loader 的 `load()` 只声明返回 Promise<any>）。
 * 这里只描述本文件真正用到的那部分，其余保持宽松，避免伪造一整套官方类型。
 */
type AmapAny = unknown;

interface AmapPointLike {
  lng: number;
  lat: number;
}

interface AmapOverlay {
  setMap(map: null): void;
  setPosition(p: [number, number]): void;
}

interface AmapMap {
  on(type: string, handler: (ev?: AmapAny) => void): void;
  off(type: string, handler: (ev?: AmapAny) => void): void;
  add(overlays: AmapAny | AmapAny[]): void;
  remove(overlays: AmapAny | AmapAny[]): void;
  destroy?(): void;
  clearMap?(): void;
  resize?(): void;
  getContainer?(): HTMLElement;
  getZoom(): number;
  getCenter(): AmapAny;
  setCenter(p: [number, number]): void;
  setZoomAndCenter(zoom: number, center: [number, number], immediately?: boolean, duration?: number): void;
  getBounds(): AmapAny;
  setBounds?(bounds: AmapAny, immediately?: boolean, avoid?: number[], maxZoom?: number): void;
  lngLatToContainer(p: [number, number]): AmapAny;
  containerToLngLat(p: AmapAny): AmapAny;
}

interface MarkerRecord {
  marker: AmapOverlay & { setContent?(content: HTMLElement): void };
  el: HTMLElement;
  entity: MapEntity;
  signature: string;
  anchor: 'center' | 'bottom';
  detach(): void;
}

export class AmapAdapter implements MapAdapter {
  readonly engine: MapEngine = 'amap';

  private NS: AmapNamespace | null = null;
  private map: AmapMap | null = null;
  private events: MapAdapterEvents | null = null;
  private records = new Map<string, MarkerRecord>();
  private userMarker: AmapOverlay | null = null;
  private selectedId: string | null = null;
  private debouncer: { schedule(): void; cancel(): void } | null = null;
  private lastViewport: MapViewportState | null = null;
  private destroyed = false;
  private ready = false;
  private errorReported = false;

  mount(container: HTMLElement, initial: MapViewportState | null, events: MapAdapterEvents, _opts?: { canvasLabel?: string }): void {
    if (this.destroyed || this.map) return;
    this.events = events;
    const key = readEnv('VITE_AMAP_KEY');
    if (!key) {
      // 硬性前置条件缺失：只回报一次，不加载脚本、不抛错（页面层用开源底图）。
      this.reportFailure(AMAP_MISSING_KEY);
      return;
    }

    // JSAPI 2.0 的安全密钥必须在 load() 之前挂到 window 上。
    const securityCode = readEnv('VITE_AMAP_SECURITY_CODE');
    if (securityCode) {
      const w = globalThis as { _AMapSecurityConfig?: { securityJsCode?: string } };
      w._AMapSecurityConfig = { ...(w._AMapSecurityConfig ?? {}), securityJsCode: securityCode };
    }

    void this.buildMap(container, initial, key);
  }

  private async buildMap(
    container: HTMLElement,
    initial: MapViewportState | null,
    key: string,
  ): Promise<void> {
    try {
      const NS = (await loadAmapJsApi({ key, version: '2.0', plugins: ['AMap.Text'] })) as AmapNamespace;
      if (this.destroyed || !NS) return; // 挂载窗口已关闭
      this.NS = NS;
      const start = toLngLat(initial?.center ?? BEIJING_CENTER);
      const map = new NS.Map(container, {
        viewMode: '2D',
        zoom: clampZoom(initial?.zoom ?? DEFAULT_ZOOM),
        zooms: [MIN_ZOOM, MAX_ZOOM],
        center: [start.lng, start.lat],
        rotateEnable: false,
        pitchEnable: false,
        resizeEnable: true,
        showIndoorMap: false,
        isHotspot: false,
        // 同城地图：视野锁在北京市范围（GCJ-02，本引擎无需转换）
        limitBounds: new NS.Bounds(
          [BEIJING_BOUNDS.west, BEIJING_BOUNDS.south],
          [BEIJING_BOUNDS.east, BEIJING_BOUNDS.north],
        ),
      }) as AmapMap;
      this.map = map;
      this.debouncer = createDebouncer(() => this.emitViewport(), VIEWPORT_DEBOUNCE_MS);
      map.on('moveend', this.onCameraSettled);
      map.on('zoomend', this.onCameraSettled);
      map.on('complete', this.onComplete);
      // 点空白处 = 选点。高德本身就是 GCJ-02，原样上报，不做转换。
      map.on('click', (ev?: unknown) => {
        const p = (ev as { lnglat?: { lng?: unknown; lat?: unknown } } | undefined)?.lnglat;
        const lng = typeof p?.lng === 'number' ? p.lng : null;
        const lat = typeof p?.lat === 'number' ? p.lat : null;
        if (lng === null || lat === null) return;
        this.events?.onMapPoint({ lng: Number(lng.toFixed(5)), lat: Number(lat.toFixed(5)) });
      });
    } catch (error) {
      console.warn('[map/amap] JSAPI 加载失败', error);
      this.reportFailure(BASEMAP_ERROR);
    }
  }

  private onComplete = (): void => {
    if (this.destroyed || this.ready) return;
    this.ready = true;
    this.events?.onReady();
    this.emitViewport();
  };

  private onCameraSettled = (): void => {
    this.debouncer?.schedule();
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.debouncer?.cancel();
    this.debouncer = null;
    for (const rec of this.records.values()) {
      rec.detach();
      safeCall(() => rec.marker.setMap(null), 'marker 清理失败');
    }
    this.records.clear();
    if (this.userMarker) safeCall(() => this.userMarker?.setMap(null), '定位点清理失败');
    this.userMarker = null;
    const map = this.map;
    if (map) {
      map.off('moveend', this.onCameraSettled);
      map.off('zoomend', this.onCameraSettled);
      map.off('complete', this.onComplete);
      safeCall(() => {
        if (typeof map.destroy === 'function') map.destroy();
        else map.clearMap?.();
      }, 'destroy 失败');
    }
    this.map = null;
    this.events = null;
    this.lastViewport = null;
    this.NS = null;
  }

  resize(): void {
    safeCall(() => this.map?.resize?.(), 'resize 失败');
  }

  /**
   * 增量更新：同 id 复用同一个 AMap.Marker。聚合数字来自我们服务端的聚合实体
   * （不用 AMap 的聚合插件），所以两种底图上的聚合语义、形状与配色完全一致。
   */
  setItems(items: MapEntity[]): void {
    const map = this.map;
    const NS = this.NS;
    if (!map || !NS || this.destroyed) return;
    const alive = new Set<string>();
    for (const entity of items) {
      alive.add(entity.id);
      const signature = entitySignature(entity);
      const anchor = markerView(entity, false).anchor;
      let rec = this.records.get(entity.id);
      if (rec && rec.anchor !== anchor) {
        rec.detach();
        rec.marker.setMap(null);
        this.records.delete(entity.id);
        rec = undefined;
      }
      if (rec) {
        rec.entity = entity;
        if (rec.signature !== signature) {
          rec.signature = signature;
          applyMarkerView(rec.el, entity, this.selectedId === entity.id);
          const p = this.renderPosition(entity.longitude, entity.latitude);
          rec.marker.setPosition([p.lng, p.lat]);
        }
        continue;
      }
      const el = createMarkerEl(entity, this.selectedId === entity.id);
      const pos = this.renderPosition(entity.longitude, entity.latitude);
      const marker = new NS.Marker({
        content: el,
        position: [pos.lng, pos.lat],
        anchor: anchor === 'bottom' ? 'bottom-center' : 'center',
        zIndex: anchor === 'bottom' ? 20 : 25,
        bubble: true,
        clickable: true,
      }) as MarkerRecord['marker'];
      map.add(marker);
      this.records.set(entity.id, {
        marker,
        el,
        entity,
        signature,
        anchor,
        detach: bindMarkerClicks(el, () => this.activate(entity.id)),
      });
    }
    for (const [id, rec] of [...this.records]) {
      if (alive.has(id)) continue;
      rec.detach();
      rec.marker.setMap(null);
      this.records.delete(id);
    }
  }

  /** 高德直接用 GCJ-02 原值；toRender 在本引擎恒等，因此不会二次叠加偏移。 */
  private renderPosition(lng: number, lat: number): LngLat {
    return toRender(lng, lat, this.engine);
  }

  private activate(id: string): void {
    const rec = this.records.get(id);
    if (!rec) return;
    const entity = rec.entity;
    if (entity.kind === 'cluster') {
      this.fitBounds(entity.expansion_bounds, undefined);
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
    this.panToGcjPoint(rec.entity.longitude, rec.entity.latitude, insets);
  }

  centerOnPoint(point: { lng: number; lat: number }, insets: MapInsets): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    // 不查 records：目标可能根本不在当前点位集合里（搜索结果跨视野定位）。
    if (!Number.isFinite(point.lng) || !Number.isFinite(point.lat)) return;
    this.panToGcjPoint(point.lng, point.lat, insets);
  }

  /** 纯像素推导的平移：让目标点落在「抽屉/顶栏之上的可视区」中心，保持当前缩放。 */
  private panToGcjPoint(lng: number, lat: number, insets: MapInsets): void {
    const map = this.map;
    if (!map || this.destroyed) return;
    const pos = this.renderPosition(lng, lat);
    const visible = this.centerOfVisibleArea(insets);
    const width = this.canvasWidth();
    const height = this.canvasHeight();
    if (!visible) {
      map.setCenter([pos.lng, pos.lat]);
      return;
    }
    // O 为容器中心、P 为标记当前像素位置，要让标记落在可视区中心 V，
    // 新地理中心 = containerToLngLat(V + (O - P))。
    const p = toPixel(map.lngLatToContainer([pos.lng, pos.lat]));
    const o = { x: width / 2, y: height / 2 };
    const target = toLngLat(
      map.containerToLngLat(pixel(this.NS, visible.x + (o.x - p.x), visible.y + (o.y - p.y))),
    );
    const zoom = clampZoom(map.getZoom());
    try {
      map.setZoomAndCenter(zoom, [target.lng, target.lat], false, 320);
    } catch (error) {
      console.warn('[map/amap] 平移失败，退回 setCenter', error);
      map.setCenter([target.lng, target.lat]);
    }
  }

  fitBounds(bounds: Bounds, insets?: MapInsets): void {
    const map = this.map;
    const NS = this.NS;
    if (!map || !NS || this.destroyed) return;
    if (!Number.isFinite(bounds.west) || !Number.isFinite(bounds.south)) return;
    // GCJ-02 原值即渲染值（本引擎 toRender 恒等）。
    const box = new NS.Bounds(
      [bounds.west, bounds.south],
      [Math.max(bounds.east, bounds.west), Math.max(bounds.north, bounds.south)],
    );
    if (typeof map.setBounds === 'function') {
      const pad = viewportPadding(insets ?? { bottom: 0 }, this.canvasWidth(), this.canvasHeight());
      try {
        // 高德 avoid 顺序：上、右、下、左（像素）
        map.setBounds(box, false, [pad.top, pad.right, pad.bottom, pad.left], MAX_ZOOM);
        return;
      } catch (error) {
        console.warn('[map/amap] setBounds 失败，退回 setCenter', error);
      }
    }
    map.setCenter([(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2]);
  }

  setUserLocation(point: { lng: number; lat: number } | null): void {
    const map = this.map;
    const NS = this.NS;
    if (!map || !NS || this.destroyed) return;
    if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
      safeCall(() => this.userMarker?.setMap(null), '定位点移除失败');
      this.userMarker = null;
      return;
    }
    const pos = this.renderPosition(point.lng, point.lat);
    if (!this.userMarker) {
      // 「我的位置」是独立标记，视觉与门店图钉/聚合牌都不同（见 map.css）
      this.userMarker = new NS.Marker({
        content: createUserLocationEl(),
        position: [pos.lng, pos.lat],
        anchor: 'center',
        zIndex: 60,
        bubble: true,
        clickable: false,
      }) as AmapOverlay;
      map.add(this.userMarker);
      return;
    }
    this.userMarker.setPosition([pos.lng, pos.lat]);
  }

  getViewport(): MapViewportState {
    const map = this.map;
    if (!map) return defaultAmapViewport();
    const center = toLngLat(map.getCenter() ?? BEIJING_CENTER);
    const raw = map.getBounds();
    const sw = raw ? toLngLat(invoke(raw, 'getSouthWest') ?? readProp(raw, 'southWest')) : null;
    const ne = raw ? toLngLat(invoke(raw, 'getNorthEast') ?? readProp(raw, 'northEast')) : null;
    const bounds: Bounds = sw && ne ? { west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat } : { ...BEIJING_BOUNDS };
    // fromRender 在本引擎恒等：高德回报的就是 GCJ-02。
    return buildViewport(this.engine, bounds, map.getZoom(), center);
  }

  isReady(): boolean {
    return this.ready;
  }

  private emitViewport(): void {
    if (!this.map || this.destroyed) return;
    const next = this.getViewport();
    if (!shouldEmitViewport(this.lastViewport, next)) return;
    this.lastViewport = next;
    this.events?.onViewportChange(next);
  }

  /** onError 每次挂载最多一次。 */
  private reportFailure(message: string): void {
    if (this.errorReported || this.destroyed) return;
    this.errorReported = true;
    this.events?.onError(message);
  }

  /** 抽屉之上那块可视区的中心（容器像素）。 */
  private centerOfVisibleArea(insets: MapInsets): { x: number; y: number } | null {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    if (w <= 1 || h <= 1) return null;
    const pad = viewportPadding(insets, w, h);
    return {
      x: pad.left + (w - pad.left - pad.right) / 2,
      y: pad.top + (h - pad.top - pad.bottom) / 2,
    };
  }

  private canvasWidth(): number {
    const el = this.map?.getContainer?.();
    const w = el?.clientWidth ?? 0;
    return w > 0 ? w : 1;
  }

  private canvasHeight(): number {
    const el = this.map?.getContainer?.();
    const h = el?.clientHeight ?? 0;
    return h > 0 ? h : 1;
  }
}

/** loader 返回的就是 window.AMap 命名空间，这里只声明用到的构造函数。 */
interface AmapNamespace {
  // 高德 JSAPI 无官方 TS 类型，构造参数保持宽松；具体字段在本文件调用处写死。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Map: new (container: HTMLElement, opts: Record<string, any>) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Marker: new (opts: Record<string, any>) => unknown;
  Bounds: new (sw: [number, number], ne: [number, number]) => unknown;
  Pixel?: new (x: number, y: number) => unknown;
  Text?: new (opts: Record<string, unknown>) => unknown;
}

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

function safeCall(fn: () => void, label: string): void {
  try {
    fn();
  } catch (error) {
    console.warn(`[map/amap] ${label}`, error);
  }
}

/** 高德的点既可能是 {x,y} 也可能是 {getX(),getY()}。 */
function toPixel(raw: AmapAny): { x: number; y: number } {
  if (typeof raw !== 'object' || raw === null) return { x: 0, y: 0 };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.getX === 'function') {
    return { x: Number((obj.getX as () => number)()), y: Number((obj.getY as () => number)()) };
  }
  return { x: Number(obj.x ?? 0), y: Number(obj.y ?? 0) };
}

function toLngLat(raw: AmapAny): LngLat {
  if (typeof raw !== 'object' || raw === null) return { ...BEIJING_CENTER };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.getLng === 'function') {
    return { lng: Number((obj.getLng as () => number)()), lat: Number((obj.getLat as () => number)()) };
  }
  const lng = Number(obj.lng ?? BEIJING_CENTER.lng);
  const lat = Number(obj.lat ?? BEIJING_CENTER.lat);
  return { lng, lat };
}

function invoke(raw: AmapAny, method: string): AmapAny {
  if (typeof raw !== 'object' || raw === null) return null;
  const fn = (raw as Record<string, unknown>)[method];
  return typeof fn === 'function' ? (fn as () => AmapAny)() : null;
}

function readProp(raw: AmapAny, prop: string): AmapAny {
  if (typeof raw !== 'object' || raw === null) return null;
  return (raw as Record<string, unknown>)[prop];
}

function pixel(NS: AmapNamespace | null, x: number, y: number): AmapAny {
  return NS?.Pixel ? new NS.Pixel(x, y) : { x, y };
}

function defaultAmapViewport(): MapViewportState {
  return { bounds: { ...BEIJING_BOUNDS }, zoom: DEFAULT_ZOOM, center: { ...BEIJING_CENTER } };
}

export function createAmapAdapter(): MapAdapter {
  return new AmapAdapter();
}

/** 是否具备切到高德的条件（页面层用它决定切换按钮的提示/禁用）。 */
export function amapIsConfigured(): boolean {
  return readEnv('VITE_AMAP_KEY').length > 0;
}
