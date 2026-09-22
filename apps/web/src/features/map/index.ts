/**
 * 地图模块对页面层暴露的全部入口。
 *
 * 页面层只依赖这里：MapView 组件 + 冻结的 types 契约 + createAdapter 工厂。
 * 两种底图（MapLibre / 高德）在 MapAdapter 后面可互换，业务层只见 GCJ-02。
 */

export { MapView, createAdapter } from './MapView';
export { MapView as default } from './MapView';
export * from './types';
export { MaplibreAdapter, BASEMAP_ERROR, DEFAULT_VECTOR_STYLE, defaultMapViewport } from './maplibre-adapter';
export { AmapAdapter, AMAP_MISSING_KEY, amapIsConfigured } from './amap-adapter';
export {
  CUISINE_MARK,
  cuisineGroup,
  markerView,
  entitySignature,
  fromRender,
  toRender,
  type CuisineMark,
  type MarkerShape,
  type MarkerView,
} from './adapters.util';
