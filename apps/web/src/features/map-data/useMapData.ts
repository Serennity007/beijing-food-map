import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BEIJING_BOUNDS,
  BEIJING_CENTER,
  CONTRACT_VERSION,
  type Layer,
  type MapEntity,
  type MapView,
  type Restaurant,
} from '@qianwei/contracts';
import type { ApiClient, MapQueryInput } from '../../data/client';
import type { MapViewportState } from '../map/types';
import { VIEWPORT_DEBOUNCE_MS } from '../map/types';

const LS_FILTERS = 'qianwei.mapfilters';
const LS_VIEW = 'qianwei.mapviewport';

export interface MapFilters {
  view: MapView;
  layer: Layer;
  budget_max: number | null;
  include_unknown_budget: boolean;
  dish: string | null;
}

const DEFAULT_FILTERS: MapFilters = {
  view: 'guizhou',
  layer: 'qualified',
  budget_max: null,
  include_unknown_budget: false,
  dish: null,
};

const DEFAULT_VIEWPORT: MapViewportState = {
  bounds: BEIJING_BOUNDS,
  zoom: 11,
  center: BEIJING_CENTER,
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * 地图与列表共用同一规范化 query 与 snapshotId：视野/筛选变化时两者一起失效。
 * 请求带序号，晚到的旧响应一律丢弃（MAP-02）。
 */
export function useMapData(api: ApiClient) {
  const [viewport, setViewportState] = useState<MapViewportState>(() => readJson<MapViewportState>(LS_VIEW) ?? DEFAULT_VIEWPORT);
  const [filters, setFiltersState] = useState<MapFilters>(() => ({ ...DEFAULT_FILTERS, ...(readJson<Partial<MapFilters>>(LS_FILTERS) ?? {}) }));
  const [entities, setEntities] = useState<MapEntity[]>([]);
  const [list, setList] = useState<Restaurant[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [totalMatched, setTotalMatched] = useState(0);
  const [mode, setMode] = useState<'clusters' | 'restaurants'>('clusters');
  const [complete, setComplete] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = useMemo<MapQueryInput>(
    () => ({
      bounds: viewport.bounds,
      zoom: viewport.zoom,
      view: filters.view,
      budget_max: filters.budget_max,
      include_unknown_budget: filters.include_unknown_budget,
      dish_or_tag: filters.dish,
      layer: filters.layer,
    }),
    [viewport, filters],
  );

  const fetchAll = useCallback(
    async (q: MapQueryInput, retryOnExpire = true) => {
      const mySeq = ++seq.current;
      setLoading(true);
      setListLoading(true);
      try {
        const map = await api.mapItems(q);
        if (mySeq !== seq.current) return;
        const page = await api.listRestaurants(q, map.snapshot_id, null, 20);
        if (mySeq !== seq.current) return;
        setEntities(map.items);
        setMode(map.mode);
        setComplete(map.complete);
        setTotalMatched(map.total_matched);
        setSnapshotId(map.snapshot_id);
        setList(page.items);
        setNextCursor(page.next_cursor);
        setError(null);
        setStale(false);
      } catch (e) {
        if (mySeq !== seq.current) return;
        const code = (e as { code?: string }).code;
        if (code === 'QUERY_EXPIRED' && retryOnExpire) {
          await fetchAll(q, false);
          return;
        }
        // 失败保留上次数据并明确提示未刷新（MAP-06）
        setError((e as Error).message || '数据加载失败');
        setStale(true);
      } finally {
        if (mySeq === seq.current) {
          setLoading(false);
          setListLoading(false);
        }
      }
    },
    [api],
  );

  const schedule = useCallback(
    (q: MapQueryInput) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void fetchAll(q), VIEWPORT_DEBOUNCE_MS);
    },
    [fetchAll],
  );

  useEffect(() => {
    schedule(query);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, schedule]);

  const setViewport = useCallback((v: MapViewportState) => {
    setViewportState(v);
    try {
      localStorage.setItem(LS_VIEW, JSON.stringify(v));
    } catch {
      /* 存储不可用时只影响下次恢复 */
    }
  }, []);

  const setFilters = useCallback((patch: Partial<MapFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(LS_FILTERS, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || listLoading) return;
    setListLoading(true);
    try {
      const page = await api.listRestaurants(query, snapshotId, nextCursor, 20);
      setList((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setNextCursor(page.next_cursor);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'QUERY_EXPIRED' ? '筛选结果已更新，列表已重新拉取' : (e as Error).message);
      if (code === 'QUERY_EXPIRED') await fetchAll(query, false);
    } finally {
      setListLoading(false);
    }
  }, [api, query, snapshotId, nextCursor, listLoading, fetchAll]);

  /** 资格/状态变更最多 5 秒被察觉：轮询当前视野并用新的 snapshot 覆盖。 */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const map = await api.mapItems(query);
          setEntities((prev) => (sameIds(prev, map.items) ? prev : map.items));
          setTotalMatched(map.total_matched);
          setSnapshotId(map.snapshot_id);
        } catch {
          setStale(true);
        }
      })();
    }, 5000);
    return () => clearInterval(id);
  }, [api, query]);

  const resetView = useCallback(() => setViewport(DEFAULT_VIEWPORT), [setViewport]);

  return {
    viewport,
    setViewport,
    filters,
    setFilters,
    entities,
    list,
    totalMatched,
    mode,
    complete,
    loading,
    listLoading,
    error,
    stale,
    snapshotId,
    nextCursor,
    contractVersion: CONTRACT_VERSION,
    loadMore,
    refresh: () => void fetchAll(query),
    resetView,
  };
}

function sameIds(a: MapEntity[], b: MapEntity[]): boolean {
  if (a.length !== b.length) return false;
  const key = (x: MapEntity) => (x.kind === 'cluster' ? `c${x.id}:${x.count}` : `r${x.id}`);
  return a.every((x, i) => key(x) === key(b[i]!));
}
