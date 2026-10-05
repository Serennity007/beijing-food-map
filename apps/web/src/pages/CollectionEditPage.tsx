/** 清单编辑：顺序与笔记 + 显式发布为不可变快照 + 撤回。规则全部由接口判定，页面不推算版本也不补数据。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shanghaiDay, straightLineMeters, type Collection, type CollectionItemRecord, type PublicationStatus, type Restaurant } from '@qianwei/contracts';
import { useApi } from '../data/api';
import { CuisineBadges, StatusBlock } from '../components/ui';
import { estimateDriveLegs } from '../features/plan/driving';

const PUB_LABEL: Record<PublicationStatus, string> = {
  PRIVATE: '未发布',
  PENDING_REVIEW: '发布待审',
  PUBLISHED: '已公开',
  REVOKED: '已撤销',
};

type ItemPatch = { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number; budget_yuan?: number | null };

interface ErrLike {
  code?: string;
  message?: string;
}

interface Candidate {
  own: Restaurant[];
  provider: Array<{ provider: string; poi_id: string; name: string; address: string }>;
}

function sortedItems(c: Collection): CollectionItemRecord[] {
  return [...c.items].sort((a, b) => a.position - b.position);
}

function sharePath(token: string): string {
  return `/s/${token}`;
}

function shareUrl(token: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}s/${token}`;
}

function fmtDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
}

function fmtDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return mins >= 60 ? `${Math.floor(mins / 60)} 小时 ${mins % 60} 分` : `${mins} 分钟`;
}

export function CollectionEditPage() {
  const { api, user, ready } = useApi();
  const { id = '' } = useParams();
  const [col, setCol] = useState<Collection | null>(null);
  const [view, setView] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shops, setShops] = useState<Record<string, Restaurant>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [driveLegs, setDriveLegs] = useState<Array<{ meters: number; seconds: number }> | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [driveFailed, setDriveFailed] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Candidate | null>(null);
  const [searching, setSearching] = useState(false);
  const [pubResult, setPubResult] = useState<{ id: string; status: string; generation: number } | null>(null);
  const searchSeq = useRef(0);

  /** 门店名称/菜系只能来自 detail 接口：清单条目本身不含这些字段。 */
  const loadShops = useCallback(
    async (items: CollectionItemRecord[]) => {
      const ids = Array.from(new Set(items.map((i) => i.restaurant_id)));
      const res = await Promise.all(
        ids.map(async (rid) => {
          try {
            return { rid, r: await api.detail(rid) };
          } catch {
            return { rid, r: null };
          }
        }),
      );
      const map: Record<string, Restaurant> = {};
      for (const e of res) if (e.r) map[e.rid] = e.r;
      setShops(map);
    },
    [api],
  );

  const load = useCallback(async () => {
    setView('loading');
    try {
      const list = await api.collections();
      const found = list.find((c) => c.id === id);
      if (!found) {
        // 不存在、不属于当前账号、无权访问统一显示为未找到，不泄露它是否存在
        setCol(null);
        setView('notfound');
        return;
      }
      setCol(found);
      setView('ok');
      setError(null);
      await loadShops(found.items);
    } catch (e) {
      const code = (e as ErrLike).code;
      if (code === 'NOT_FOUND' || code === 'FORBIDDEN') {
        setCol(null);
        setView('notfound');
      } else {
        setError((e as ErrLike).message ?? '清单读取失败');
        setView('error');
      }
    }
  }, [api, id, loadShops]);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  // 添加门店：300 ms 防抖，只允许加入平台收录结果
  useEffect(() => {
    const seq = ++searchSeq.current;
    const t = term.trim();
    if (t.length === 0) {
      setHits(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .search(t)
        .then((r) => {
          if (seq !== searchSeq.current) return;
          setHits({ own: r.own, provider: r.provider_candidates });
        })
        .catch((e: unknown) => {
          if (seq !== searchSeq.current) return;
          setHits(null);
          setError((e as ErrLike).message ?? '搜索失败');
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, api]);

  async function patch(rid: string, p: ItemPatch, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fresh = await api.updateCollectionItem(id, rid, p);
      // 版本号只取接口返回的新记录，不在本地推算
      setCol(fresh);
      await loadShops(fresh.items);
      if (done) setNotice(done);
    } catch (e) {
      setError((e as ErrLike).message ?? '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!col) return;
    const ordered = sortedItems(col);
    const a = ordered[index];
    const b = ordered[index + dir];
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      // 互换两条 position：两次串行写，第二次返回的记录即最终状态
      let fresh = await api.updateCollectionItem(id, a.restaurant_id, { position: b.position });
      fresh = await api.updateCollectionItem(id, b.restaurant_id, { position: a.position });
      setCol(fresh);
      const at = sortedItems(fresh).findIndex((i) => i.restaurant_id === a.restaurant_id);
      setNotice(at >= 0 ? `${nameOf(a.restaurant_id)} 现在位于第 ${at + 1} 位` : '顺序已按接口返回更新');
    } catch (e) {
      setError((e as ErrLike).message ?? '排序失败');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(rid: string) {
    if (!confirm(`从清单移除 ${nameOf(rid)}？只影响这份清单，不删除门店，也不影响已发布的快照。`)) return;
    await patch(rid, { remove: true }, '已从清单移除。');
  }

  async function addItem(rid: string) {
    await patch(rid, {}, '已加入清单末尾，可用上移/下移调整顺序。');
  }

  async function publish() {
    if (!col) return;
    setBusy(true);
    setError(null);
    setPubResult(null);
    try {
      const ids = sortedItems(col)
        .filter((i) => isSelected(i.restaurant_id))
        .map((i) => i.restaurant_id);
      const r = await api.requestPublication(id, ids);
      setPubResult(r);
      setNotice('发布申请已提交，等待人工审核。');
      await load();
    } catch (e) {
      setError((e as ErrLike).message ?? '发布申请提交失败');
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!confirm('撤销分享后，当前公开链接立即永久失效，旧链接不会恢复；再次公开需要重新提交发布申请。确定撤销？')) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await api.unpublish(id);
      setCol(fresh);
      setPubResult(null);
      setNotice('已撤销公开，旧链接永久失效。');
    } catch (e) {
      setError((e as ErrLike).message ?? '撤销失败');
    } finally {
      setBusy(false);
    }
  }

  function isSelected(rid: string): boolean {
    return selected[rid] ?? true;
  }

  async function saveBudget(rid: string) {
    const raw = (budgets[rid] ?? '').trim();
    if (raw === '') {
      await patch(rid, { budget_yuan: null }, '已清除这条的预算。');
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100000) {
      setError('预算需为 0—100000 的整数（人均），留空表示不规划这项。');
      return;
    }
    await patch(rid, { budget_yuan: n }, '预算已保存（仅自己可见的规划数字）。');
  }

  /** 相邻两站直线距离：数据全来自本应用自有坐标，无任何第三方结果。 */
  const planLegs = useMemo(() => {
    if (!col) return [];
    const orderedNow = sortedItems(col);
    const pts = orderedNow
      .map((it) => shops[it.restaurant_id])
      .filter((s): s is Restaurant => Boolean(s));
    const legs: Array<{ from: string; to: string; meters: number }> = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      legs.push({
        from: `${a.name}${a.branch ? `（${a.branch}）` : ''}`,
        to: `${b.name}${b.branch ? `（${b.branch}）` : ''}`,
        meters: straightLineMeters({ lng: a.lng, lat: a.lat }, { lng: b.lng, lat: b.lat }),
      });
    }
    return legs;
  }, [col, shops]);

  const planSummary = useMemo(() => {
    if (!col) return { count: 0, total: 0, missing: 0 };
    let count = 0;
    let total = 0;
    let missing = 0;
    for (const it of col.items) {
      if (it.budget_yuan === null || it.budget_yuan === undefined) missing += 1;
      else {
        count += 1;
        total += it.budget_yuan;
      }
    }
    return { count, total, missing };
  }, [col]);

  async function estimateDrive() {
    if (!col) return;
    const points = sortedItems(col)
      .map((it) => shops[it.restaurant_id])
      .filter((s): s is Restaurant => Boolean(s))
      .map((s) => ({ lng: s.lng, lat: s.lat }));
    setEstimating(true);
    setDriveFailed(false);
    try {
      const legs = await estimateDriveLegs(points);
      if (legs) setDriveLegs(legs);
      else setDriveFailed(true);
    } finally {
      setEstimating(false);
    }
  }

  function nameOf(rid: string): string {
    const s = shops[rid];
    return s ? `「${s.name}${s.branch ? `（${s.branch}）` : ''}」` : `门店 ${rid}`;
  }

  if (!ready) {
    return (
      <div className="page page-narrow">
        <StatusBlock kind="loading" message="正在确认登录状态…" />
      </div>
    );
  }

  const notFoundView = (
    <div className="page page-narrow">
      <StatusBlock
        kind="error"
        message="清单不存在、不属于当前账号，或已被删除。私密清单对未授权访客也显示同样结果，避免泄露它是否存在。"
        action={
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link className="btn small" to="/map">
              回到地图
            </Link>
            <Link className="btn small plain" to="/me/collections">
              我的清单
            </Link>
          </div>
        }
      />
    </div>
  );

  if (!user) {
    return (
      <div className="page page-narrow">
        <StatusBlock
          kind="empty"
          message="清单属于个人私密数据，登录后才能编辑与发布。"
          action={
            <Link className="btn small" to={`/login?next=/me/collections/${id}`}>
              登录
            </Link>
          }
        />
      </div>
    );
  }

  if (view === 'notfound') return notFoundView;

  if (view === 'loading' || col === null) {
    return (
      <div className="page page-narrow">
        {error ? (
          <StatusBlock
            kind="error"
            message={error}
            action={
              <button className="btn small" type="button" onClick={() => void load()}>
                重试
              </button>
            }
          />
        ) : (
          <StatusBlock kind="loading" message="正在读取清单…" />
        )}
      </div>
    );
  }

  const ordered = sortedItems(col);
  const shareIds = ordered.filter((i) => isSelected(i.restaurant_id)).map((i) => i.restaurant_id);
  const isSystem = col.kind === 'system';

  return (
    <div className="page page-narrow">
      <p className="hint" style={{ marginBottom: 8 }}>
        <Link to="/me/collections">← 返回我的清单</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{col.title}</h1>
          <p className="card-dishes">{col.description ?? '没有填写说明。'}</p>
        </div>
        <span className="badges">
          <span className="badge">{isSystem ? '系统清单' : '自建清单'}</span>
          <span className={col.publication_status === 'PUBLISHED' ? 'badge ok' : col.publication_status === 'REVOKED' ? 'badge danger' : 'badge'}>
            {PUB_LABEL[col.publication_status]}
          </span>
        </span>
      </div>
      <p className="hint">
        草稿第 {col.version} 版 · 发布代数 {col.publication_generation} · 共 {ordered.length} 家门店。标题与说明只能在创建时设定，
        当前接口没有提供修改入口。
      </p>

      {error && <div className="alert bad">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      <section className="panel">
        <h2>添加门店</h2>
        <label className="field">
          <span className="label">搜索平台收录的门店（300 毫秒防抖）</span>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="输入店名、菜品或地址关键词" />
        </label>
        {searching && <p className="hint">正在搜索…</p>}
        {!searching && term.trim().length > 0 && hits && (
          <>
            <p className="hint">平台收录 {hits.own.length} 家：</p>
            {hits.own.length === 0 ? (
              <p className="hint">没有匹配的平台收录门店。清单只能加入已收录门店，本页不创建新门店。</p>
            ) : (
              <div className="list">
                {hits.own.map((r) => {
                  const already = col.items.some((i) => i.restaurant_id === r.id);
                  return (
                    <article className="card" key={r.id}>
                      <div className="card-row">
                        <h3>
                          {r.name}
                          {r.branch ? <small>（{r.branch}）</small> : null}
                        </h3>
                        <CuisineBadges cuisines={r.cuisines} />
                      </div>
                      <p className="card-meta">{r.address}</p>
                      <div className="card-actions">
                        {already ? (
                          <span className="badge muted">已在清单中</span>
                        ) : (
                          <button className="btn small" type="button" disabled={busy} onClick={() => void addItem(r.id)}>
                            加入清单
                          </button>
                        )}
                        <Link className="btn small plain" to={`/restaurants/${r.id}`}>
                          看依据
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {hits.provider.length > 0 && (
              <p className="hint">
                另有 {hits.provider.length} 条第三方地点候选（{hits.provider.map((p) => p.name).join('、')}
                ）。候选地点尚未入库，这里不能直接钉进清单：需要先走推荐好店流程由平台核验建店。
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>条目（{ordered.length}）：顺序与笔记</h2>
        {ordered.length === 0 ? (
          <StatusBlock
            kind="empty"
            message="这份清单还没有门店，因此也无法发布。上面的搜索只能加入平台收录的门店。"
            action={
              <Link className="btn small" to="/map">
                去地图找店
              </Link>
            }
          />
        ) : (
          <div className="list">
            {ordered.map((it, idx) => {
              const shop = shops[it.restaurant_id];
              const draft = drafts[it.restaurant_id] ?? it.note ?? '';
              const dirty = draft !== (it.note ?? '');
              return (
                <article className="card" key={it.restaurant_id}>
                  <div className="card-row">
                    <h3>
                      {idx + 1}. {shop ? shop.name : `门店 ${it.restaurant_id}`}
                      {shop?.branch ? <small>（{shop.branch}）</small> : null}
                    </h3>
                    {shop ? <CuisineBadges cuisines={shop.cuisines} /> : <span className="badge warn">门店详情读取失败</span>}
                  </div>
                  <p className="card-meta">
                    position {it.position} · 加入于 {shanghaiDay(it.added_at)}
                    {!shop && ' · 名称与链接需等门店记录可读'}
                  </p>
                  {shop && (
                    <div className="card-actions" style={{ marginBottom: 6 }}>
                      <Link className="btn small plain" to={`/restaurants/${shop.id}`}>
                        详情
                      </Link>
                      <Link className="btn small plain" to={`/map?focus=${shop.id}`}>
                        在地图中查看
                      </Link>
                    </div>
                  )}
                  <label className="field">
                    <span className="label">笔记（默认私密）</span>
                    <textarea
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [it.restaurant_id]: e.target.value }))}
                      placeholder="例如：酸汤锅底建议两人份，周末要等位。"
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={it.note_shareable}
                      disabled={busy}
                      onChange={(e) => void patch(it.restaurant_id, { note_shareable: e.target.checked }, '笔记公开权限已更新。')}
                    />
                    <span>允许这条笔记进入公开快照</span>
                  </label>
                  <div className="btn-row">
                    <button
                      className="btn small"
                      type="button"
                      disabled={busy || !dirty}
                      onClick={() =>
                        void patch(it.restaurant_id, { note: draft }, '笔记已保存（私密草稿，未影响已发布快照）。')
                      }
                    >
                      保存
                    </button>
                    <button className="btn small plain" type="button" disabled={busy || idx === 0} onClick={() => void move(idx, -1)}>
                      上移
                    </button>
                    <button
                      className="btn small plain"
                      type="button"
                      disabled={busy || idx === ordered.length - 1}
                      onClick={() => void move(idx, 1)}
                    >
                      下移
                    </button>
                    <button className="btn small danger" type="button" disabled={busy} onClick={() => void removeItem(it.restaurant_id)}>
                      移除
                    </button>
                  </div>
                  <label className="field">
                    <span className="label">人均预算（元，选填的规划数字）</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100000}
                      step={1}
                      value={budgets[it.restaurant_id] ?? (it.budget_yuan === null || it.budget_yuan === undefined ? '' : String(it.budget_yuan))}
                      onChange={(e) => setBudgets((d) => ({ ...d, [it.restaurant_id]: e.target.value }))}
                      placeholder="选填：预计人均，如 90"
                    />
                  </label>
                  <div className="btn-row">
                    <button
                      className="btn small"
                      type="button"
                      disabled={busy}
                      onClick={() => void saveBudget(it.restaurant_id)}
                    >
                      保存预算
                    </button>
                    <button
                      className="btn small plain"
                      type="button"
                      disabled={busy || !(budgets[it.restaurant_id] ?? '')}
                      onClick={() => {
                        setBudgets((d) => ({ ...d, [it.restaurant_id]: '' }));
                        void patch(it.restaurant_id, { budget_yuan: null }, '已清除这条的预算。');
                      }}
                    >
                      清除
                    </button>
                  </div>
                  <p className="hint">
                    {it.note_shareable
                      ? '这条笔记会在你勾选它参与发布时进入快照。'
                      : it.note
                        ? '笔记已保存但不公开：发布时快照里不会出现文字。'
                        : '还没有笔记。'}
                    {it.budget_yuan !== null && it.budget_yuan !== undefined ? ` 预算 ¥${it.budget_yuan}/人只属于你的规划，不进入公开快照。` : ''}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {ordered.length > 0 && (
        <section className="panel">
          <h2>行程与花费规划</h2>
          <p className="hint">
            预算是只属于你的规划数字：按每家店填「预计人均」，这里帮你在出发前估出总数。它不进入公开快照，也不参与任何推荐口径。
          </p>
          <p className="card-dishes">
            已填预算 {planSummary.count} / {ordered.length} 家
            {planSummary.count > 0 ? (
              <>
                {' '}· 规划人均合计 <strong>¥{planSummary.total}</strong>
                {planSummary.missing > 0 ? `（${planSummary.missing} 家未填未计入）` : ''}
              </>
            ) : (
              ' · 在上方条目里填预算后自动汇总'
            )}
          </p>
          {planLegs.length > 0 && (
            <>
              <h3>路线距离（按清单顺序）</h3>
              <ol className="pin-list">
                {planLegs.map((leg, i) => {
                  const drive = driveLegs?.[i];
                  return (
                    <li key={`${leg.from}-${leg.to}`}>
                      <div>
                        <strong>{leg.from}</strong> → <strong>{leg.to}</strong>
                        <p className="hint" style={{ margin: '2px 0 0' }}>
                          直线约 {fmtDistance(leg.meters)}
                          {drive ? ` · 驾车约 ${fmtDistance(drive.meters)} · ${fmtDuration(drive.seconds)}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="btn-row" style={{ marginTop: 6 }}>
                <button className="btn small" type="button" disabled={busy || estimating} onClick={() => void estimateDrive()}>
                  {estimating ? '正在向高德查询…' : '按驾车估算全程（高德）'}
                </button>
                {driveLegs && (
                  <button
                    className="btn small plain"
                    type="button"
                    disabled={busy}
                    onClick={() => setDriveLegs(null)}
                  >
                    清除驾车估算
                  </button>
                )}
              </div>
              <p className="hint">
                {driveFailed
                  ? '高德驾车估算暂时不可用（网络或服务未响应），上面已显示直线距离，稍后可重试。'
                  : driveLegs
                    ? '驾车距离与时长来自高德路线规划，仅当场展示帮助估算，不会保存进清单或快照。'
                    : '直线距离由平台收录坐标计算；点「按驾车估算」可查询实际道路距离与时长。'}
              </p>
            </>
          )}
        </section>
      )}

      {isSystem ? (
        <section className="panel">
          <h2>发布与分享</h2>
          <p className="hint">系统清单只是私人分类：接口不允许直接发布，也不允许删除。要公开分享请先新建自建清单。</p>
        </section>
      ) : (
        <section className="panel" id="publish">
          <h2>发布与分享</h2>
          <div className="btn-row" style={{ marginBottom: 6 }}>
            <button
              className="btn small plain"
              type="button"
              disabled={busy}
              onClick={() => setSelected(Object.fromEntries(ordered.map((i) => [i.restaurant_id, true])))}
            >
              全选
            </button>
            <button
              className="btn small plain"
              type="button"
              disabled={busy}
              onClick={() => setSelected(Object.fromEntries(ordered.map((i) => [i.restaurant_id, false])))}
            >
              全不选
            </button>
            <span className="hint">已选 {shareIds.length} / {ordered.length}，默认全选</span>
          </div>
          <div className="list">
            {ordered.map((it, idx) => (
              <label className="check" key={it.restaurant_id}>
                <input
                  type="checkbox"
                  checked={isSelected(it.restaurant_id)}
                  disabled={busy}
                  onChange={(e) => setSelected((s) => ({ ...s, [it.restaurant_id]: e.target.checked }))}
                />
                <span>
                  {idx + 1}. {nameOf(it.restaurant_id)}
                  {it.note_shareable ? '（含笔记）' : it.note ? '（笔记不公开）' : ''}
                </span>
              </label>
            ))}
          </div>

          <h3 style={{ marginTop: 12 }}>访客将看到的内容</h3>
          <div className="card">
            <h3>{col.title}</h3>
            <p className="card-dishes">{col.description ?? ''}</p>
            {shareIds.length === 0 ? (
              <p className="hint">没有勾选门店，快照会是空的，接口会拒绝这种申请。</p>
            ) : (
              <ol className="pin-list">
                {ordered
                  .filter((i) => isSelected(i.restaurant_id))
                  .map((i) => (
                    <li key={i.restaurant_id}>
                      <div>
                        <strong>{nameOf(i.restaurant_id)}</strong>
                        <p className="hint" style={{ margin: '4px 0 0' }}>
                          {i.note_shareable && i.note ? i.note : '（这条不带笔记）'}
                        </p>
                      </div>
                    </li>
                  ))}
              </ol>
            )}
            <p className="hint">预览即快照内容：只有勾选的门店进入，只有勾选了允许公开的笔记才会出现文字。</p>
          </div>

          <div className="alert">
            公开后任何拿到链接的人都能看到；快照不可变；之后编辑私密草稿不会改动已发布版本；撤回后旧链接永久失效，不会恢复。
          </div>

          <div className="btn-row">
            <button className="btn" type="button" disabled={busy || shareIds.length === 0} onClick={() => void publish()}>
              提交发布
            </button>
            {col.publication_status === 'PUBLISHED' && (
              <button className="btn small danger" type="button" disabled={busy} onClick={() => void unpublish()}>
                撤销分享
              </button>
            )}
          </div>
          <p className="hint">
            提交后进入待审队列，需要平台工作人员批准才会生成公开链接；演示后台的审核队列在 <Link to="/admin">内容后台</Link>。
          </p>

          {pubResult && (
            <div className="alert ok">
              发布申请已受理：编号 {pubResult.id}，状态 {pubResult.status}，快照代数 generation {pubResult.generation}。
              审核通过后本页会显示公开链接。
            </div>
          )}

          {col.publication_status === 'PUBLISHED' && col.active_token && (
            <div className="alert ok">
              已公开。当前生效链接（复制按钮与剪贴板回退在「我的清单」页）：
              <Link to={sharePath(col.active_token)}>公开页</Link>
              <code style={{ display: 'block', marginTop: 4, wordBreak: 'break-all' }}>{shareUrl(col.active_token)}</code>
            </div>
          )}
          {col.publication_status === 'PENDING_REVIEW' && (
            <p className="hint">
              有一份发布申请正在审核中，通过后才会生成新的公开链接。注意引擎会把这份申请记为最新一代快照：
              提交后此前的公开链接即刻不可访问，旧的已发布版本不会自动恢复。
            </p>
          )}
          {col.publication_status === 'REVOKED' && <p className="hint">上一次公开已被撤销，旧链接永久失效。</p>}
          {col.publication_status === 'PRIVATE' && <p className="hint">这份清单目前完全私密，只有你自己能读到。</p>}
        </section>
      )}
    </div>
  );
}
