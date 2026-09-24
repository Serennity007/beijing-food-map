import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  VIEW_LABEL,
  isValidGcj02,
  straightLineMeters,
  wgs84ToGcj02,
  type MapView as ViewKind,
  type Restaurant,
} from '@qianwei/contracts';
import { useApi } from '../data/api';
import { useMapData, type MapFilters } from '../features/map-data/useMapData';
import { MapView } from '../features/map/MapView';
import type { MapEngine } from '../features/map/types';
import { Drawer, RestaurantCard, StatusBlock } from '../components/ui';

const VIEWS: ViewKind[] = ['guizhou', 'southwest', 'other'];
const BUDGETS: Array<{ label: string; value: number | null }> = [
  { label: '不限预算', value: null },
  { label: '¥80 以内', value: 80 },
  { label: '¥150 以内', value: 150 },
  { label: '¥300 以内', value: 300 },
];
const LS_ENGINE = 'qianwei.mapengine';

/**
 * 地图首页。视野 + 筛选 → 同一 snapshot 的点位与列表；
 * 聚合点击按 expansion_bounds 放大；搜索把自有收录与第三方地点候选分开。
 */
export function MapPage() {
  const { api, user } = useApi();
  const d = useMapData(api);
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('focus'));
  const [bottomInset, setBottomInset] = useState(0);
  // ≥900px 时列表与地图并排，抽屉不再盖住地图，底部避让必须归零。
  const [sideBySide, setSideBySide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => setSideBySide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const [engine, setEngine] = useState<MapEngine>(() => (localStorage.getItem(LS_ENGINE) === 'amap' ? 'amap' : 'maplibre'));
  const [mapError, setMapError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'pending' | 'denied' | 'unsupported'>('idle');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState<{ own: Restaurant[]; provider: Array<{ name: string; address: string; provider: string }> } | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    localStorage.setItem(LS_ENGINE, engine);
  }, [engine]);

  const changeFilters = useCallback(
    (patch: Partial<MapFilters>) => {
      d.setFilters(patch);
      setSearch(null);
    },
    [d],
  );

  /* 输入 300ms 防抖；晚到的旧结果丢弃 */
  useEffect(() => {
    const term = q.trim();
    const mySeq = ++searchSeq.current;
    if (term.length === 0) {
      setSearch(null);
      return;
    }
    const t = setTimeout(() => {
      void api
        .search(term)
        .then((r) => {
          if (mySeq === searchSeq.current) setSearch({ own: r.own, provider: r.provider_candidates });
        })
        .catch(() => {
          if (mySeq === searchSeq.current) setSearch(null);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [q, api]);

  /** 聚合点击：适配器已经按 expansion_bounds 放大并回报视野，页面层只清掉选中。 */
  const expandCluster = useCallback(() => {
    setSelectedId(null);
  }, []);

  const focusList = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`card-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating('unsupported');
      return;
    }
    setLocating('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 浏览器给 WGS84，这里只转换一次，之后全链路按 GCJ-02 处理
        const g = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude);
        if (!isValidGcj02(g.lng, g.lat)) {
          setLocating('denied');
          return;
        }
        setUserLocation(g);
        setLocating('idle');
      },
      () => setLocating('denied'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const totalLabel = useMemo(() => {
    const entityWord = d.mode === 'clusters' ? '个聚合点' : '个点位';
    return `匹配 ${d.totalMatched} 家 · 视野内 ${d.entities.length} ${entityWord}`;
  }, [d.totalMatched, d.entities.length, d.mode]);

  /**
   * 空状态要说清"为什么空"：放到很细的层级时视野只剩几十米，覆盖不到任何门店，
   * 这时该让用户缩小地图 —— 旧文案写的是"放大"，方向正好相反。
   */
  const spanMeters = useMemo(() => {
    const b = d.viewport.bounds;
    return Math.round(straightLineMeters({ lng: b.west, lat: b.south }, { lng: b.east, lat: b.south }));
  }, [d.viewport.bounds]);
  const deepZoom = d.viewport.zoom >= 14;
  const zoomLabel = d.viewport.zoom.toFixed(1);
  const spanLabel = spanMeters >= 1000 ? `${(spanMeters / 1000).toFixed(1)} 公里` : `${spanMeters} 米`;

  return (
    <div className="map-page">
      <div className="map-host">
        <MapView
          engine={engine}
          entities={d.entities}
          loading={d.loading}
          error={mapError}
          selectedId={selectedId}
          userLocation={userLocation}
          insets={{ bottom: sideBySide ? 0 : Math.min(bottomInset, Math.round(window.innerHeight * 0.4)) }}
          initialViewport={d.viewport}
          fitSignal={d.fitSignal}
          onSelectRestaurant={(id) => {
            if (id) focusList(id);
          }}
          onSelectCluster={expandCluster}
          onViewportChange={d.setViewport}
          onRequestLocation={requestLocation}
          onRetry={() => setMapError(null)}
          onChangeEngine={(e) => {
            setEngine(e);
            setMapError(null);
          }}
        />

        <div className="map-statusline">
          <span className={d.stale ? 'pill warn' : 'pill'}>
            {d.loading ? '加载中… ' : ''}
            {totalLabel}
            {d.complete ? '' : ' · 结果未完整，请放大'}
          </span>
          {d.stale && <span className="pill warn">数据未刷新，显示上次结果</span>}
          {locating === 'denied' && <span className="pill warn">未获得定位，仍可手动逛地图</span>}
          {locating === 'unsupported' && <span className="pill warn">该浏览器不支持定位</span>}
        </div>

        {/* 定位与切换底图由 MapView 的覆盖层提供，这里只放页面层独有的复位操作 */}
        <div className="map-controls">
          <button className="map-btn" type="button" title="回到北京全图" aria-label="回到北京全图" onClick={d.resetView}>
            ⌂
          </button>
        </div>
      </div>

      <aside className="map-side" aria-label="门店列表与筛选">
        <div className="map-toolbar">
          <div className="searchbar">
            <input
              type="search"
              value={q}
              placeholder="搜店名、酸汤、米粉"
              aria-label="搜索店名、菜品或标签"
              onChange={(e) => setQ(e.target.value)}
            />
            {q !== '' && (
              <button className="btn plain small" type="button" onClick={() => setQ('')}>
                清除
              </button>
            )}
          </div>

          <div className="chips" role="group" aria-label="菜系视图">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={d.filters.view === v ? 'chip active' : 'chip'}
                aria-pressed={d.filters.view === v}
                onClick={() => changeFilters({ view: v })}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
            <button
              type="button"
              className={d.filters.layer === 'pending_verification' ? 'chip active' : 'chip'}
              aria-pressed={d.filters.layer === 'pending_verification'}
              title="待验证门店单独用空心标记显示，不冒充平台推荐"
              onClick={() =>
                changeFilters({ layer: d.filters.layer === 'pending_verification' ? 'qualified' : 'pending_verification' })
              }
            >
              {d.filters.layer === 'pending_verification' ? '显示待验证' : '待验证图层'}
            </button>
          </div>

          <div className="chips" role="group" aria-label="预算与菜品筛选">
            <select
              className="input"
              style={{ width: 'auto', flex: '0 0 auto' }}
              aria-label="人均预算上限"
              value={d.filters.budget_max === null ? '' : String(d.filters.budget_max)}
              onChange={(e) => changeFilters({ budget_max: e.target.value === '' ? null : Number(e.target.value) })}
            >
              {BUDGETS.map((b) => (
                <option key={b.label} value={b.value === null ? '' : String(b.value)}>
                  {b.label}
                </option>
              ))}
            </select>
            {d.filters.budget_max !== null && (
              <label className="chip">
                <input
                  type="checkbox"
                  checked={d.filters.include_unknown_budget}
                  onChange={(e) => changeFilters({ include_unknown_budget: e.target.checked })}
                />
                包含人均未知
              </label>
            )}
            <input
              className="input"
              style={{ flex: '1 1 110px', width: 'auto' }}
              type="search"
              aria-label="菜品或口味标签，例如 酸汤、折耳根"
              placeholder="菜品 / 口味标签"
              value={d.filters.dish ?? ''}
              onChange={(e) => changeFilters({ dish: e.target.value === '' ? null : e.target.value })}
            />
          </div>
          {d.filters.budget_max !== null && (
            <p className="hint" style={{ margin: 0 }}>
              未勾选“包含人均未知”时，人均未知的门店不匹配预算条件。
            </p>
          )}
        </div>

        {search && (
          <div className="search-results">
            <h3>平台收录（{search.own.length}）</h3>
            {search.own.length === 0 ? (
              <p className="hint">没有匹配的已收录门店。换个词，或提交你吃过的店。</p>
            ) : (
              <div className="list">
                {search.own.slice(0, 5).map((r) => (
                  <RestaurantCard
                    key={r.id}
                    r={r}
                    active={r.id === selectedId}
                    onSelect={(id) => {
                      setQ('');
                      setSearch(null);
                      focusList(id);
                    }}
                    userLocation={userLocation}
                  />
                ))}
              </div>
            )}
            {search.provider.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>地图地点候选（{search.provider.length}）</h3>
                <p className="hint">候选来自第三方地点数据，存在不代表好吃；选中后只进入建店流程，不会自动出现在推荐图层。</p>
                <ul className="pin-list">
                  {search.provider.slice(0, 4).map((c) => (
                    <li key={`${c.provider}-${c.name}-${c.address}`}>
                      <div>
                        <strong>{c.name}</strong>
                        <div className="hint">
                          {c.address}（{c.provider} 地点候选）
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <Drawer onInsets={setBottomInset}>
          {d.error && !d.loading && (
            <StatusBlock
              kind="error"
              message={`${d.error} 列表保留上次结果，可重试或调整筛选。`}
              action={
                <button className="btn small" type="button" onClick={d.refresh}>
                  重试
                </button>
              }
            />
          )}
          {d.loading && d.list.length === 0 && <StatusBlock kind="loading" message="正在读取当前视野的门店…" />}
          {!d.loading && d.list.length === 0 && !d.error && (
            <StatusBlock
              kind="empty"
              message={
                d.filters.layer === 'pending_verification'
                  ? '当前视野没有待验证门店。'
                  : deepZoom
                    ? `你已经放到 ${zoomLabel} 级，视野只有约 ${spanLabel}，这个范围通常覆盖不到任何门店。请缩小地图（往外拉）或回到全图。`
                    : '当前视野内没有符合推荐资格的门店。可以移动地图、切换"北京其他"，或提交你吃过的店。'
              }
              action={
                <div className="btn-row">
                  <button className="btn small plain" type="button" onClick={d.resetView}>
                    回到北京全图
                  </button>
                  <Link className="btn small" to="/submit">
                    推荐好店
                  </Link>
                </div>
              }
            />
          )}
          <div className="list">
            {d.list.map((r) => (
              <div key={r.id} id={`card-${r.id}`}>
                <RestaurantCard r={r} active={r.id === selectedId} onSelect={focusList} userLocation={userLocation} />
              </div>
            ))}
          </div>
          {d.nextCursor !== null && (
            <button className="btn plain small" type="button" onClick={() => void d.loadMore()} disabled={d.listLoading}>
              {d.listLoading ? '加载中…' : `继续加载（共匹配 ${d.totalMatched} 家）`}
            </button>
          )}
          <p className="hint">
            演示版本：门店、图片、实吃与票数均为合成测试数据。
            {user ? '' : ' 登录后可投稿并建立自己的地图。'}
          </p>
        </Drawer>
      </aside>
    </div>
  );
}
