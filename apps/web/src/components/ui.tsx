import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CUISINE_LABEL,
  straightLineMeters,
  type Cuisine,
  type Restaurant,
} from '@qianwei/contracts';

export const SNAP_HEIGHTS: number[] = [0.14, 0.45, 0.82];
const snapRatio = (i: number): number => SNAP_HEIGHTS[i] ?? 0.45;

export function CuisineBadges({ cuisines }: { cuisines: Cuisine[] }) {
  return (
    <span className="badges">
      {cuisines.map((c) => (
        <span key={c} className={`badge cuisine-${c}`}>
          {CUISINE_LABEL[c]}
        </span>
      ))}
    </span>
  );
}

/** 推荐来源必须写清依据，不用单一颜色区分。 */
export function SourceBadges({ r }: { r: Restaurant }) {
  const t = r.basis.tally;
  return (
    <span className="badges">
      {r.in_default_layer && r.basis.sources.includes('community') && (
        <span className="badge ok" title={`近 180 个自然日：推荐 ${t.recommend} / 一般 ${t.neutral} / 不推荐 ${t.not_recommend}`}>
          社区推荐 {t.recommend}/{t.total}
        </span>
      )}
      {r.basis.sources.includes('editorial') && <span className="badge editorial">编辑实吃核验</span>}
      {r.place_status !== 'VERIFIED' && <span className="badge warn">待验证</span>}
      {r.business_status === 'UNKNOWN' && <span className="badge warn">营业未核实</span>}
      {(r.business_status === 'SUSPECTED_CLOSED' || r.business_status === 'CLOSED') && <span className="badge danger">闭店复核</span>}
      {r.community === 'LAPSED' && <span className="badge muted">近期口碑变化</span>}
    </span>
  );
}

export function StatusBlock({ kind, message, action }: { kind: 'loading' | 'empty' | 'error'; message: string; action?: ReactNode }) {
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <strong>{kind === 'loading' ? '加载中…' : kind === 'empty' ? '暂无结果' : '出错了'}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function formatDistance(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  return meters < 1000 ? `直线约 ${Math.round(meters)} 米` : `直线约 ${(meters / 1000).toFixed(1)} 公里`;
}

/** 高德网页导航deeplink；失败时页面提供复制地址回退（MAP-07）。 */
export function navUrl(r: { lng: number; lat: number; name: string }): string {
  const name = encodeURIComponent(r.name);
  return `https://uri.amap.com/marker?position=${r.lng.toFixed(6)},${r.lat.toFixed(6)}&name=${name}&coordinate=gaode&callnative=1`;
}

export function RestaurantCard({
  r,
  active,
  onSelect,
  userLocation,
}: {
  r: Restaurant;
  active: boolean;
  onSelect: (id: string) => void;
  userLocation: { lng: number; lat: number } | null;
}) {
  const distance = userLocation ? formatDistance(straightLineMeters(userLocation, { lng: r.lng, lat: r.lat })) : null;
  return (
    <article className={`card ${active ? 'card-active' : ''}`}>
      <button type="button" className="card-title-btn" onClick={() => onSelect(r.id)}>
        <h3>
          {r.name}
          {r.branch ? <small>（{r.branch}）</small> : null}
        </h3>
      </button>
      <div className="card-row">
        <CuisineBadges cuisines={r.cuisines} />
        <SourceBadges r={r} />
      </div>
      <p className="card-dishes">推荐菜：{r.dish_highlights.slice(0, 3).join('、') || '尚未有人填写'}</p>
      <p className="card-meta">
        {r.price.average === null ? '人均未知' : `用户报告人均 ¥${r.price.average}`}
        {r.price.report_count ? `（${r.price.report_count} 人报告）` : ''}
        {distance ? ` · ${distance}` : ''}
      </p>
      <div className="card-actions">
        <Link className="btn small" to={`/restaurants/${r.id}`}>
          看依据
        </Link>
        <a className="btn small ghost" href={navUrl(r)} target="_blank" rel="noreferrer">
          导航
        </a>
      </div>
    </article>
  );
}

/**
 * 手机三档抽屉：手柄拖动/点击换档，与地图手势分离（MAP-08）。
 * onInsets 把当前遮挡高度告诉地图，用于把选中标记平移出遮挡区。
 * B1：默认停在最低档，把首屏留给地图；hint 在最低档时显示门店数量，作为显式的「展开列表」入口。
 */
export function Drawer({ children, onInsets, hint }: { children: ReactNode; onInsets: (bottom: number) => void; hint?: string }) {
  const [snap, setSnap] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const host = useRef<HTMLDivElement>(null);

  const report = useCallback(
    (heightPx: number) => {
      onInsets(Math.round(heightPx));
    },
    [onInsets],
  );

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const apply = () => {
      const ratio = Math.min(1, Math.max(0, snapRatio(snap) + drag));
      el.style.height = `${ratio * 100}dvh`;
      // 读实际渲染高度：CSS 的 max-height 会把请求高度再压一次，避让区必须按真实遮挡算
      report(el.offsetHeight);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [snap, drag, report]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = e.clientY;
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null || !host.current) return;
    const delta = (start.current - e.clientY) / host.current.parentElement!.clientHeight;
    if (Math.abs(delta) > 0.02) moved.current = true;
    setDrag(Math.min(0.35, Math.max(-0.35, delta)));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    const target = snapRatio(snap) + drag;
    let best = 0;
    SNAP_HEIGHTS.forEach((h, i) => {
      if (Math.abs(h - target) < Math.abs(snapRatio(best) - target)) best = i;
    });
    // 没有位移就是点按：换到下一档，兑现手柄上"点按或拖动换档"的承诺
    const tapped = !moved.current;
    start.current = null;
    moved.current = false;
    setDrag(0);
    setSnap(tapped ? (snap + 1) % SNAP_HEIGHTS.length : best);
  };

  return (
    <div className="drawer" ref={host} style={{ transition: drag === 0 ? 'height 180ms ease' : 'none' }}>
      <div
        className="drawer-handle"
        role="button"
        tabIndex={0}
        aria-label={`抽屉，当前第 ${snap + 1} 档，共 ${SNAP_HEIGHTS.length} 档，点按或拖动换档`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSnap((s) => (s + 1) % SNAP_HEIGHTS.length);
          }
        }}
      >
        <span className="grip" aria-hidden="true" />
        {snap === 0 && hint && <span className="drawer-hint">{hint}</span>}
      </div>
      <div className="drawer-body">{children}</div>
    </div>
  );
}
