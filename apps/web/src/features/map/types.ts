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
  onViewportChange(viewport: MapViewportState): void;
  onRequestLocation(): void;
  onRetry(): void;
  onChangeEngine(engine: MapEngine): void;
}

/** 视野稳定后再发请求（250ms 防抖），并配合序号丢弃旧响应。 */
export const VIEWPORT_DEBOUNCE_MS = 250;

export const MIN_ZOOM = 4;
export const MAX_ZOOM = 20;
