import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { BEIJING_BOUNDS, type MapEntity } from '@qianwei/contracts';
import type { MapAdapter, MapEngine, MapViewProps } from './types';
import { MaplibreAdapter } from './maplibre-adapter';
import { AmapAdapter } from './amap-adapter';
import './map.css';

/**
 * 地图视图：页面层唯一需要认识的组件。
 *
 * - 每种底图引擎都藏在同一个 MapAdapter 接口后面，只有 engine 变化时才重建实例；
 *   数据刷新只走 setItems()，地图相机与 marker 都不重建。
 * - 组件自己绝不调用 geolocation：定位由页面层做（权限、错误文案、GCJ-02 转换都在一处）。
 */

/** 按引擎创建适配器（页面层只需要这一个入口）。 */
export function createAdapter(engine: MapEngine): MapAdapter {
  return engine === 'amap' ? new AmapAdapter() : new MaplibreAdapter();
}

const OTHER_ENGINE: Record<MapEngine, MapEngine> = {
  maplibre: 'amap',
  amap: 'maplibre',
};

const ENGINE_LABEL: Record<MapEngine, string> = {
  maplibre: '开源底图',
  amap: '高德底图',
};

export function MapView(props: MapViewProps) {
  const { engine, entities, selectedId, userLocation, insets } = props;

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  // 适配器只拿到一组稳定的回调，真实处理函数每次渲染刷新到这里，
  // 这样页面层的 inline 箭头函数不会导致地图重建。
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // 相机视角的唯一真相：挂载时用它定位，切换底图/重试重建后立即回到原视角，
  // 之后由适配器的 onViewportChange 持续更新。
  const viewportRef = useRef(props.initialViewport);
  // 切换底图 / 重试会重建适配器：这三份当前值用于重建后立刻回放，
  // 否则页面层不重新发请求的话，新底图上就没有任何标记。
  const itemsRef = useRef<MapEntity[]>(entities);

  // 底图/SDK 自身的失败只反映在组件内部（MapViewProps 里没有上报错误的回调）。
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAdapterError(null);
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const adapter = createAdapter(engine);
    adapterRef.current = adapter;
    adapter.mount(canvas, viewportRef.current, {
      onViewportChange: (viewport) => {
        viewportRef.current = viewport;
        latest.current.onViewportChange(viewport);
      },
      onSelectRestaurant: (id) => latest.current.onSelectRestaurant(id),
      onSelectCluster: (cluster) => latest.current.onSelectCluster(cluster),
      onReady: () => {
        /* 页面层不需要：ready 只影响本组件的错误提示 */
      },
      onError: (message) => setAdapterError(message),
    });
    const observer = new ResizeObserver(() => {
      adapterRef.current?.resize();
    });
    observer.observe(canvas);
    if (rootRef.current) observer.observe(rootRef.current);
    // 重建后回放当前数据/选中/定位，新底图不会空白。
    adapter.setItems(itemsRef.current);
    const snapshot = latest.current;
    adapter.select(snapshot.selectedId);
    if (snapshot.selectedId) adapter.setCenterOn(snapshot.selectedId, snapshot.insets);
    adapter.setUserLocation(snapshot.userLocation);
    return () => {
      observer.disconnect();
      adapterRef.current = null;
      adapter.destroy();
    };
  }, [engine, attempt]);

  // 页面层递增 fitSignal 即"把相机复位到北京全图"；复位后的真实视野会经 onViewportChange 回流到页面状态。
  const fitSignal = props.fitSignal;
  useEffect(() => {
    if (fitSignal > 0) adapterRef.current?.fitBounds(BEIJING_BOUNDS, latest.current.insets);
  }, [fitSignal]);

  useEffect(() => {
    itemsRef.current = entities;
    adapterRef.current?.setItems(entities);
  }, [entities]);

  // insets 拆成原始值，避免页面层每次渲染都新建对象导致无谓的相机移动。
  const bottomInset = insets.bottom;
  const topInset = insets.top ?? 0;
  const leftInset = insets.left ?? 0;

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    // 抽屉收起/展开会改变被遮挡的像素高度：容器尺寸交给 ResizeObserver，
    // 这里负责重画遮挡区，并把选中项挪回「抽屉之上」的可视区。
    adapter.resize();
    adapter.select(selectedId);
    if (selectedId) adapter.setCenterOn(selectedId, { bottom: bottomInset, top: topInset, left: leftInset });
  }, [selectedId, bottomInset, topInset, leftInset]);

  useEffect(() => {
    adapterRef.current?.setUserLocation(userLocation);
  }, [userLocation]);

  const handleRetry = useCallback(() => {
    setAdapterError(null);
    latest.current.onRetry();
    setAttempt((n) => n + 1);
  }, []);

  const handleToggleEngine = useCallback(() => {
    setAdapterError(null);
    latest.current.onChangeEngine(OTHER_ENGINE[latest.current.engine]);
  }, []);

  const handleRequestLocation = useCallback(() => {
    latest.current.onRequestLocation();
  }, []);

  // 点地图空白处 = 取消选中（点 marker / 覆盖层按钮 / 底图控件都不算）。
  const handleRootClick = useCallback((ev: ReactMouseEvent<HTMLDivElement>) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest('.qm-marker') ||
      target.closest('.qm-map__overlay') ||
      target.closest('.qm-map__error') ||
      target.closest('.maplibregl-ctrl') ||
      target.closest('.amap-controls')
    ) {
      return;
    }
    if (!target.closest('.qm-map__canvas')) return;
    latest.current.onSelectRestaurant(null);
  }, []);

  const visibleError = props.error ?? adapterError;

  return (
    <div className="qm-map" ref={rootRef} onClick={handleRootClick}>
      <div className="qm-map__canvas" ref={canvasRef} />

      {props.loading ? <div className="qm-map__shimmer" aria-hidden="true" /> : null}
      {props.loading && !visibleError ? (
        <div className="qm-map__status" role="status">
          地图更新中
        </div>
      ) : null}

      <div className="qm-map__overlay">
        <button type="button" className="qm-btn" aria-label={`切换底图，当前为${ENGINE_LABEL[engine]}`} onClick={handleToggleEngine}>
          {ENGINE_LABEL[OTHER_ENGINE[engine]]}
        </button>
        <button type="button" className="qm-btn" aria-label="定位到我的位置" onClick={handleRequestLocation}>
          我的位置
        </button>
      </div>

      {visibleError ? (
        <div className="qm-map__error" role="alert">
          <p>{visibleError}</p>
          <button type="button" className="qm-btn" aria-label="重试加载地图" onClick={handleRetry}>
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default MapView;
