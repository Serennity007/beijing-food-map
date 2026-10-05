import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LAYERS,
  VIEW_LABEL,
  isValidGcj02,
  straightLineMeters,
  wgs84ToGcj02,
  type MapView as ViewKind,
  type ProviderCandidate,
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
 * 搜索面板的完整状态机（A3）：未搜索（null）、加载中、有结果、无结果、请求失败五态分开表达。
 * resultsTerm 记录下方结果属于哪次关键词：加载中保留旧结果时，必须标明它们不是当前关键词的结果。
 */
interface SearchPanelState {
  term: string;
  phase: 'loading' | 'done' | 'failed';
  resultsTerm: string | null;
  own: Restaurant[];
  provider: ProviderCandidate[];
}

/** A2：搜索定位的目标。signal 递增表达新请求，连续快速选择时后到覆盖先到。 */
interface FocusTarget {
  id: string;
  name: string;
  point: { lng: number; lat: number };
  signal: number;
}

/**
 * 地图首页。视野 + 筛选 → 同一 snapshot 的点位与列表；
 * 聚合点击按 expansion_bounds 放大；搜索把自有收录与第三方地点候选分开。
 */
export function MapPage() {
  const { api, user, seedProfile } = useApi();
  const realSeed = seedProfile === 'real';
  const d = useMapData(api);
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('focus'));
  const [bottomInset, setBottomInset] = useState(0);
  // ≥900px 时列表与地图并排，抽屉不再盖住地图，底部避让必须归零。
  const [sideBySide, setSideBySide] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  // B1：顶部筛选区在窄屏同样盖住地图，避让必须按实测高度算，不能只算底部。
  const topBlockRef = useRef<HTMLDivElement | null>(null);
  const [topInset, setTopInset] = useState(0);
  useEffect(() => {
    const el = topBlockRef.current;
    if (!el) return;
    const measure = () => setTopInset(sideBySide ? 0 : Math.round(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sideBySide]);
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
  const [search, setSearch] = useState<SearchPanelState | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    localStorage.setItem(LS_ENGINE, engine);
  }, [engine]);

  const changeFilters = useCallback(
    (patch: Partial<MapFilters>) => {
      d.setFilters(patch);
      setSearch(null);
      setFocusTarget(null);
    },
    [d],
  );

  /* 输入 300ms 防抖；晚到的旧结果丢弃（序号守卫）。失败不再静默：进入 failed 态保留关键词等待重试。 */
  useEffect(() => {
    const term = q.trim();
    const mySeq = ++searchSeq.current;
    if (term.length === 0) {
      setSearch(null);
      return;
    }
    setSearch((prev) => ({
      term,
      phase: 'loading',
      // 上一轮已完成的结果先留着展示并标明"正在更新"，而不是闪成空白；失败态不保留旧结果。
      resultsTerm: prev && prev.phase === 'done' ? prev.resultsTerm : null,
      own: prev && prev.phase === 'done' ? prev.own : [],
      provider: prev && prev.phase === 'done' ? prev.provider : [],
    }));
    const t = setTimeout(() => {
      void api
        .search(term)
        .then((r) => {
          if (mySeq === searchSeq.current) setSearch({ term, phase: 'done', resultsTerm: term, own: r.own, provider: r.provider_candidates });
        })
        .catch(() => {
          if (mySeq === searchSeq.current) setSearch({ term, phase: 'failed', resultsTerm: null, own: [], provider: [] });
        });
    }, 300);
    return () => clearTimeout(t);
  }, [q, api, searchRetry]);

  /** 聚合点击：适配器已经按 expansion_bounds 放大并回报视野，页面层只清掉选中。 */
  const expandCluster = useCallback(() => {
    setSelectedId(null);
  }, []);

  /* 定位收尾时把键盘焦点带到列表卡片：从地图标记或搜索结果进入列表后，
     Tab 顺序从所选门店继续，读屏用户不会"选中了却不知道选到了哪"。 */
  const focusCardOnLoad = useRef(false);
  const focusList = useCallback((id: string) => {
    focusCardOnLoad.current = true;
    setSelectedId(id);
    setFocusTarget(null);
    document.getElementById(`card-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  /**
   * A2：搜索结果用自带的坐标驱动相机，不要求目标先出现在当前点位集合里。
   * 旧实现只 setSelectedId + 滚动卡片，适配器在 records 里找不到 ID 就直接返回，
   * 结果是"搜索面板消失了、地图却一动不动"。
   */
  const focusSearchResult = useCallback((r: Restaurant) => {
    setQ('');
    setSearch(null);
    focusCardOnLoad.current = true;
    setSelectedId(r.id);
    setFocusTarget((prev) => ({ id: r.id, name: r.name, point: { lng: r.lng, lat: r.lat }, signal: (prev?.signal ?? 0) + 1 }));
  }, []);

  /* 新视野的数据回来后，如果选中门店已在列表里，把卡片滚进视野并把焦点带到卡片（定位的收尾联动）。 */
  useEffect(() => {
    if (!selectedId) return;
    if (!d.list.some((r) => r.id === selectedId)) return;
    document.getElementById(`card-${selectedId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focusCardOnLoad.current) {
      focusCardOnLoad.current = false;
      document.getElementById(`card-${selectedId}`)?.querySelector<HTMLButtonElement>('.card-title-btn')?.focus();
    }
  }, [d.list, selectedId]);

  /**
   * A2 的"收尾解释"：相机到位、数据刷新后目标仍不可见（被菜系/预算/推荐层排除，
   * 或仍聚合在点位里），就明确说出来并给下一步，不悄悄吞掉，也不擅自改筛选。
   */
  useEffect(() => {
    if (!focusTarget || d.loading) return;
    const inList = d.list.some((r) => r.id === focusTarget.id);
    const onMap = d.entities.some((e) => e.kind === 'restaurant' && e.id === focusTarget.id);
    if (inList || onMap || selectedId !== focusTarget.id) setFocusTarget(null);
  }, [focusTarget, d.loading, d.list, d.entities, selectedId]);

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

  /* B1：预算/口味/待验证收进可折叠的「筛选」，按钮上显示已选条件数；菜系视图保持一等入口。 */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (d.filters.budget_max !== null) n += 1;
    if (d.filters.budget_max !== null && d.filters.include_unknown_budget) n += 1;
    if (d.filters.dish) n += 1;
    if (d.filters.layer !== (realSeed ? 'all' : 'qualified')) n += 1;
    return n;
  }, [d.filters, realSeed]);

  /**
   * 点底图空白处选一个点，把 GCJ-02 坐标带进建店申请 —— 之前只能手填经纬度。
   * 相机一动就作废：选点表达的是"就是这儿"，平移之后那个屏幕位置已经不是它了。
   */
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);

  return (
    <div
      className="map-page"
      /* B1：顶部/底部遮挡实测值下发为 CSS 变量，状态行、复位按钮、底图控件与署名都要避开遮挡区 */
      style={
        {
          '--qm-top-inset': `${sideBySide ? 0 : topInset}px`,
          '--qm-bottom-inset': `${sideBySide ? 0 : bottomInset}px`,
        } as CSSProperties
      }
    >
      <div className="map-host">
        <MapView
          engine={engine}
          entities={d.entities}
          loading={d.loading}
          error={mapError}
          selectedId={selectedId}
          userLocation={userLocation}
          // B1：遮挡区用实测值。旧代码把底部避让截到窗口高度的 40%，
          // 抽屉完全展开时选中标记会被按错位置；列表完全展开就以列表为主，不再人为截断。
          insets={{ top: sideBySide ? 0 : topInset, bottom: sideBySide ? 0 : bottomInset }}
          focusRequest={focusTarget ? { point: focusTarget.point, signal: focusTarget.signal } : null}
          initialViewport={d.viewport}
          fitSignal={d.fitSignal}
          onSelectRestaurant={(id) => {
            if (id) focusList(id);
          }}
          onSelectCluster={expandCluster}
          onMapPoint={(p) => setPicked(p)}
          onViewportChange={(v) => {
            setPicked(null);
            d.setViewport(v);
          }}
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
          {focusTarget && (
            <span className="pill warn">
              已定位到「{focusTarget.name}」附近，但它不在当前筛选结果中（可能被菜系/预算/推荐层排除，或仍在聚合点里）。
              <Link className="btn small" to={`/restaurants/${focusTarget.id}`} style={{ marginLeft: 8 }}>
                直接查看详情
              </Link>
            </span>
          )}
          {picked && (
            <span className="pill">
              已选点 {picked.lng.toFixed(4)}, {picked.lat.toFixed(4)}（GCJ-02）
              <Link className="btn small" to={`/submit?lng=${picked.lng}&lat=${picked.lat}`} style={{ marginLeft: 8 }}>
                在这里新增门店
              </Link>
              <button className="btn small plain" type="button" style={{ marginLeft: 4 }} onClick={() => setPicked(null)}>
                取消
              </button>
            </span>
          )}
        </div>

        {/* 定位与切换底图由 MapView 的覆盖层提供，这里只放页面层独有的复位操作 */}
        <div className="map-controls">
          <button className="map-btn" type="button" title="回到北京全图" aria-label="回到北京全图" onClick={d.resetView}>
            ⌂
          </button>
        </div>
      </div>

      <aside className="map-side" aria-label="门店列表与筛选">
        {/* B1：顶部筛选区整体实测高度，作为地图相机避让的顶部遮挡 */}
        <div ref={topBlockRef}>
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

            {/* 菜系视图是主维度保持平铺；待验证图层属于另一维度，收进「筛选」并保留显式开关 */}
            <div className="chips" role="group" aria-label="菜系视图与筛选开关">
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
                className={filtersOpen ? 'chip active' : 'chip'}
                aria-expanded={filtersOpen}
                aria-controls="map-filter-panel"
                onClick={() => setFiltersOpen((o) => !o)}
              >
                筛选{activeFilterCount > 0 ? ` · 已选 ${activeFilterCount}` : ''}
              </button>
            </div>

            {filtersOpen && (
              <div className="filter-panel" id="map-filter-panel">
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
                <div className="chips" role="group" aria-label="图层筛选">
                  {LAYERS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={d.filters.layer === l ? 'chip active' : 'chip'}
                      aria-pressed={d.filters.layer === l}
                      title={
                        l === 'all'
                          ? '全部收录门店：含待核验与已核验'
                          : l === 'qualified'
                            ? '好店层：社区票达标或编辑背书才入图，不冒充平台推荐'
                            : '新收录门店单独显示，不冒充平台推荐'
                      }
                      onClick={() => changeFilters({ layer: l })}
                    >
                      {l === 'all'
                        ? '全部门店'
                        : l === 'qualified'
                          ? realSeed
                            ? '好店推荐'
                            : '好店层'
                          : realSeed
                            ? '新收录·待核验'
                            : '待验证'}
                    </button>
                  ))}
                  <span className="hint" style={{ margin: 0 }}>
                    {realSeed
                      ? '新收录门店来自公开资料整理、地点待核验，不代表平台推荐。'
                      : '待验证门店不代表平台推荐，需要显式开启才会显示。'}
                  </span>
                </div>
                {d.filters.budget_max !== null && (
                  <p className="hint" style={{ margin: 0 }}>
                    未勾选“包含人均未知”时，人均未知的门店不匹配预算条件。
                  </p>
                )}
              </div>
            )}
          </div>

          {search && (
            <div className="search-results">
              {search.phase === 'loading' && (
                <p className="hint" role="status" style={{ marginTop: 0 }}>
                  {search.resultsTerm !== null && search.resultsTerm !== search.term
                    ? `正在搜索「${search.term}」… 以下还是「${search.resultsTerm}」的结果，马上更新。`
                    : `正在搜索「${search.term}」…`}
                </p>
              )}
              {search.phase === 'failed' ? (
                <StatusBlock
                  kind="error"
                  message={`搜索没有成功，关键词「${search.term}」已保留。可重试，或直接浏览下方列表。`}
                  action={
                    <button className="btn small" type="button" onClick={() => setSearchRetry((n) => n + 1)}>
                      重试
                    </button>
                  }
                />
              ) : (
                search.resultsTerm !== null && (
                  <>
                    <h3>平台收录（{search.own.length}）</h3>
                    {search.own.length === 0 ? (
                      search.phase === 'done' && (
                        <div>
                          <p className="hint">没有匹配的已收录门店。换个词再搜，或直接申请把它补进地图。</p>
                          <Link className="btn small" to={`/submit?q=${encodeURIComponent(search.term)}`}>
                            申请新增门店
                          </Link>
                        </div>
                      )
                    ) : (
                      <div className="list">
                        {search.own.slice(0, 5).map((r) => (
                          <RestaurantCard
                            key={r.id}
                            r={r}
                            active={r.id === selectedId}
                            onSelect={(id) => {
                              const hit = search.own.find((x) => x.id === id);
                              if (hit) focusSearchResult(hit);
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
                  </>
                )
              )}
            </div>
          )}
        </div>

        <Drawer onInsets={setBottomInset} hint={`展开门店列表 · 匹配 ${d.totalMatched} 家`}>
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
          {d.loading && d.list.length === 0 && (
            <div className="skeleton-list" aria-hidden="true">
              <div className="skeleton-card">
                <span style={{ width: '42%' }} />
                <span style={{ width: '88%' }} />
                <span style={{ width: '70%' }} />
              </div>
              <div className="skeleton-card">
                <span style={{ width: '36%' }} />
                <span style={{ width: '80%' }} />
                <span style={{ width: '56%' }} />
              </div>
              <div className="skeleton-card">
                <span style={{ width: '48%' }} />
                <span style={{ width: '84%' }} />
              </div>
            </div>
          )}
          {d.loading && d.list.length === 0 && <span className="visually-hidden" role="status">正在读取当前视野的门店…</span>}
          {!d.loading && d.list.length === 0 && !d.error && (
            <StatusBlock
              kind="empty"
              message={
                d.filters.layer === 'pending_verification'
                  ? '当前视野没有待验证门店。'
                  : deepZoom
                    ? `你已经放到 ${zoomLabel} 级，视野只有约 ${spanLabel}，这个范围通常覆盖不到任何门店。请缩小地图（往外拉）或回到全图。`
                    : d.filters.layer === 'all'
                      ? '当前视野没有收录门店。可以移动地图、切换菜系视图，或把你吃过的店补进地图。'
                      : '当前视野内没有符合推荐资格的门店。贵州味常藏在街巷里——你知道哪家，就来报。可以移动地图、切换"北京其他"，或提交你吃过的店。'
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
            {seedProfile === 'synthetic' && d.list.some((r) => r.is_test_data)
              ? '演示版本：门店、图片、实吃与票数均为合成测试数据。'
              : ''}
            {user ? '' : '登录后可投稿并建立自己的地图。'}
          </p>
        </Drawer>
      </aside>
    </div>
  );
}
