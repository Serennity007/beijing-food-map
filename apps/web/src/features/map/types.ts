import type { Bounds, MapClusterItem, MapEntity } from '@qianwei/contracts';

/**
 * 地图渲染器与业务查询的冻结边界。页面层只依赖这个文件，
 * MapLibre 与高德两种实现都必须在它后面可互换。
 */

export type MapEngine = 'maplibre' | 'amap';

export interface MapViewportState {
  bounds: Bounds;
  zoom: number;
  center: { lng: number; lat: number };
}

export interface MapInsets {
  /** 底部抽屉/列表覆盖的像素高度，地图需要把选中标记平移出遮挡区。 */
  bottom: number;
  top?: number;
  left?: number;
}

export interface MapAdapterEvents {
  onViewportChange(viewport: MapViewportState): void;
  onSelectRestaurant(id: string): void;
  onSelectCluster(cluster: MapClusterItem): void;
  /**
   * 点到底图空白处：上报该点的 **GCJ-02** 坐标（MapLibre 内部是 WGS84，
   * 必须在出 SDK 的边界转回来，页面层永远只见 GCJ-02）。用于「在这里新增门店」的选点。
   */
  onMapPoint(point: { lng: number; lat: number }): void;
  onReady(): void;
  /** SDK 或瓦片失败：页面层必须回退到列表，不阻塞逛地图（MAP-06）。 */
  onError(message: string): void;
}

export interface MapAdapter {
  readonly engine: MapEngine;
  mount(container: HTMLElement, initial: MapViewportState | null, events: MapAdapterEvents): void;
  setItems(items: MapEntity[]): void;
  select(id: string | null): void;
  setCenterOn(id: string | null, insets: MapInsets): void;
  /**
   * 把相机对准一个坐标（GCJ-02），不要求该点已在当前点位集合里：
   * 搜索结果可能在当前视野外、聚合点内或被筛选排除，定位必须用结果自带坐标驱动相机，
   * 不能依赖「目标 marker 已经存在」（A2）。
   */
  centerOnPoint(point: { lng: number; lat: number }, insets: MapInsets): void;
  fitBounds(bounds: Bounds, insets?: MapInsets): void;
  setUserLocation(point: { lng: number; lat: number } | null): void;
  getViewport(): MapViewportState;
  resize(): void;
  destroy(): void;
}

export interface MapViewProps {
  engine: MapEngine;
  entities: MapEntity[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  userLocation: { lng: number; lat: number } | null;
  insets: MapInsets;
  initialViewport: MapViewportState | null;
  /** >0 时请求把相机复位到北京全图；复位后的真实视野经 onViewportChange 回流到页面状态。 */
  fitSignal: number;
  onSelectRestaurant(id: string | null): void;
  onSelectCluster(cluster: MapClusterItem): void;
  /** 点空白选点（GCJ-02），用于把坐标带进建店申请。 */
  onMapPoint(point: { lng: number; lat: number }): void;
  /**
   * 页面层要求把相机对准某个坐标（GCJ-02）：搜索结果跨视野定位用。
   * signal 每次请求递增，连续快速选择时后到的请求覆盖先到的。
   */
  focusRequest: { point: { lng: number; lat: number }; signal: number } | null;
  onViewportChange(viewport: MapViewportState): void;
  onRequestLocation(): void;
  onRetry(): void;
  onChangeEngine(engine: MapEngine): void;
}

/** 视野稳定后再发请求（250ms 防抖），并配合序号丢弃旧响应。 */
export const VIEWPORT_DEBOUNCE_MS = 250;

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 20;
