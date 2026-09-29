/**
 * 投稿页。所有校验与票数规则都在引擎/服务端执行：这里只提交表单、显示返回结果与错误，
 * 绝不因为前端判断而伪造状态。第三方地点候选与手动坐标都只进入建店申请流程，
 * 新建门店的地点状态由引擎固定为待核验，页面不参与任何资格判定。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ATTITUDES,
  ATTITUDE_LABEL,
  CANDIDATE_STATUS_LABEL,
  DISCLOSURES,
  DISCLOSURE_LABEL,
  DUPLICATE_REASON_LABEL,
  RULE_VERSION,
  type CandidateFacts,
  type ContentVersionStatus,
  type Disclosure,
  type FeedbackAttitude,
  type Restaurant,
  type RestaurantCandidate,
  type RestaurantDetail,
  type Submission,
} from '@qianwei/contracts';
import { useApi } from '../data/api';
import { LS_DRAFT_PREFIX, type SearchResult } from '../data/client';
import { describeError, readErrorCode } from '../data/errors';
import { CandidateForm } from '../features/candidates/CandidateForm';
import { StatusBlock } from '../components/ui';

const MAX_MEDIA = 6;
const FIELD_KEYS: readonly string[] = ['restaurant_id', 'visited_date', 'dish_names', 'reason', 'media_ids', 'disclosure'];

const STATUS_LABEL: Record<ContentVersionStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已公开',
  REJECTED: '未通过',
  HIDDEN: '已隐藏',
  WITHDRAWN: '已撤回',
};

interface Draft {
  restaurant_id: string | null;
  visited_date: string;
  dish_names: string[];
  reason: string;
  attitude: FeedbackAttitude;
  disclosure: Disclosure | null;
}

interface ApiFailure {
  code: string | null;
  message: string;
  fields: Record<string, string>;
}

/** 静态模式抛 contracts 的 ApiError，HTTP 模式抛 ClientError，两者形状一致，这里按结构取值。 */
function readFailure(e: unknown): ApiFailure {
  const fields: Record<string, string> = {};
  if (typeof e === 'object' && e !== null) {
    const o = e as { code?: unknown; message?: unknown; fieldErrors?: unknown };
    if (typeof o.fieldErrors === 'object' && o.fieldErrors !== null) {
      for (const [k, v] of Object.entries(o.fieldErrors as Record<string, unknown>)) {
        if (typeof v === 'string') fields[k] = v;
      }
    }
    const code = typeof o.code === 'string' ? o.code : null;
    const raw = typeof o.message === 'string' && o.message ? o.message : '请求失败，请稍后重试';
    return {
      code,
      // B5：幂等冲突页面另有专门解释与操作按钮，保留原文；其余按码翻译成人话
      message: code === 'IDEMPOTENCY_CONFLICT' ? raw : describeError(code, raw),
      fields,
    };
  }
  return { code: readErrorCode(e), message: describeError(readErrorCode(e), e instanceof Error ? e.message : '请求失败，请稍后重试'), fields };
}

function isAttitude(v: unknown): v is FeedbackAttitude {
  return typeof v === 'string' && (ATTITUDES as readonly string[]).includes(v);
}

function isDisclosure(v: unknown): v is Disclosure {
  return typeof v === 'string' && (DISCLOSURES as readonly string[]).includes(v);
}

function parseDraft(raw: string): Draft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  return {
    restaurant_id: typeof o.restaurant_id === 'string' ? o.restaurant_id : null,
    visited_date: typeof o.visited_date === 'string' ? o.visited_date : '',
    dish_names: Array.isArray(o.dish_names) ? o.dish_names.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [],
    reason: typeof o.reason === 'string' ? o.reason : '',
    attitude: isAttitude(o.attitude) ? o.attitude : 'recommend',
    disclosure: isDisclosure(o.disclosure) ? o.disclosure : null,
  };
}

/** 空错误不占位，避免表单里出现无内容的红字行。 */
function FieldErr({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <span className="err">{msg}</span>;
}

function newIdempotencyKey(): string {
  const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SubmitPage() {
  const { api, user, ready, meta } = useApi();
  const [params] = useSearchParams();
  const revise = params.get('revise') === '1';
  const presetId = params.get('restaurant');
  // 地图选点带进来的坐标（GCJ-02）：有就默认打开建店表单，省掉手填经纬度。
  const pickedLng = Number(params.get('lng'));
  const pickedLat = Number(params.get('lat'));
  // 从地图页"搜不到 → 申请新增"带过来的关键词：直接放进搜索框，让"申请新增这家门店"预填店名。
  const prefillQ = params.get('q') ?? '';

  const [term, setTerm] = useState(prefillQ);
  const [found, setFound] = useState<{ own: Restaurant[]; provider: SearchResult['provider_candidates'] } | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(presetId);
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [detailNote, setDetailNote] = useState<string | null>(null);
  const [todayMax, setTodayMax] = useState<string | null>(null);

  const [attitude, setAttitude] = useState<FeedbackAttitude>('recommend');
  const [visitedDate, setVisitedDate] = useState('');
  const [dishInput, setDishInput] = useState('');
  const [dishNames, setDishNames] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [disclosure, setDisclosure] = useState<Disclosure | null>(null);

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [done, setDone] = useState<Submission | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [candidateForm, setCandidateForm] = useState<Partial<CandidateFacts> | null>(null);
  const [candidate, setCandidate] = useState<RestaurantCandidate | null>(null);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [candidateFailure, setCandidateFailure] = useState<ApiFailure | null>(null);

  const searchSeq = useRef(0);
  const detailSeq = useRef(0);
  const idemRef = useRef<string | null>(null);
  const candIdemRef = useRef<string | null>(null);
  const restoredFor = useRef<string | null>(null);
  const hadDraft = useRef(false);
  const prefilledFor = useRef<string | null>(null);
  if (idemRef.current === null) idemRef.current = newIdempotencyKey();

  const draftKey = `${LS_DRAFT_PREFIX}${user?.id ?? 'anon'}`;

  useEffect(() => {
    let alive = true;
    void api
      .today()
      .then((t) => {
        if (!alive) return;
        setTodayMax(t);
        setVisitedDate((cur) => cur || t);
      })
      .catch(() => {
        if (alive) setTodayMax(null);
      });
    return () => {
      alive = false;
    };
  }, [api]);

  /* 输入 300ms 防抖；晚到的旧结果丢弃 */
  useEffect(() => {
    const mySeq = ++searchSeq.current;
    const q = term.trim();
    if (q.length === 0) {
      setFound(null);
      return;
    }
    const timer = setTimeout(() => {
      void api
        .search(q)
        .then((r) => {
          if (mySeq === searchSeq.current) setFound({ own: r.own, provider: r.provider_candidates });
        })
        .catch(() => {
          if (mySeq === searchSeq.current) setFound(null);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, api]);

  const loadDetail = useCallback(
    async (id: string) => {
      const mySeq = ++detailSeq.current;
      try {
        const d = await api.detail(id);
        if (mySeq === detailSeq.current) setDetail(d);
      } catch (e) {
        if (mySeq === detailSeq.current) {
          setDetail(null);
          setDetailNote(readFailure(e).message);
        }
      }
    },
    [api],
  );

  /** 从地图选点带进来时自动展开建店表单并预填坐标，只认第一次渲染。 */
  const pickedApplied = useRef(false);
  useEffect(() => {
    if (pickedApplied.current) return;
    pickedApplied.current = true;
    if (!Number.isFinite(pickedLng) || !Number.isFinite(pickedLat)) return;
    if (pickedLng === 0 && pickedLat === 0) return;
    setCandidateForm({ lng: pickedLng, lat: pickedLat, source: 'manual_point' });
  }, [pickedLng, pickedLat]);

  useEffect(() => {
    if (restaurantId === null) {
      ++detailSeq.current;
      setDetail(null);
      setDetailNote(null);
      return;
    }
    void loadDetail(restaurantId);
  }, [restaurantId, loadDetail]);

  useEffect(() => {
    if (restoredFor.current === draftKey) return;
    restoredFor.current = draftKey;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      raw = null;
    }
    if (!raw) return;
    const d = parseDraft(raw);
    if (!d) return;
    // 一打开页面就会落一条空白草稿；只有作者真的写过才算"有草稿"，否则它会把回填挡掉
    hadDraft.current = d.reason.trim().length > 0 || d.dish_names.length > 0;
    setRestaurantId(d.restaurant_id);
    setVisitedDate(d.visited_date);
    setDishNames(d.dish_names);
    setReason(d.reason);
    setAttitude(d.attitude);
    setDisclosure(d.disclosure);
  }, [draftKey]);

  useEffect(() => {
    try {
      const draft: Draft = { restaurant_id: restaurantId, visited_date: visitedDate, dish_names: dishNames, reason, attitude, disclosure };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* 本机没有存储权限时只是不能恢复草稿，不影响提交 */
    }
  }, [draftKey, restaurantId, visitedDate, dishNames, reason, attitude, disclosure]);

  /* 改一条已有反馈时先回填它：让作者从零重填会把实吃日期写成"今天"，那是假记录。 */
  useEffect(() => {
    if (!revise || hadDraft.current) return;
    const my = detail?.my_current_feedback ?? null;
    if (!my || prefilledFor.current === my.visit_id) return;
    prefilledFor.current = my.visit_id;
    setAttitude(my.attitude);
    setVisitedDate(my.visited_date);
    setDishNames(my.dish_names);
    setReason(my.reason);
    setDisclosure(my.disclosure);
    setMediaIds(my.media_ids);
  }, [revise, detail]);

  useEffect(() => {
    if (mediaIds.length === 0) {
      setPhotos({});
      return;
    }
    let alive = true;
    void api
      .mediaUrls(mediaIds)
      .then((m) => {
        if (alive) setPhotos(m);
      })
      .catch(() => {
        if (alive) setPhotos({});
      });
    return () => {
      alive = false;
    };
  }, [mediaIds, api]);

  function clearDraft(): void {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* 忽略 */
    }
  }

  function pickStore(r: Restaurant): void {
    setRestaurantId(r.id);
    setTerm('');
    setFound(null);
    setDone(null);
    setFailure(null);
    setNotice(null);
  }

  /** 建店申请：引擎返回什么状态就显示什么，页面不推断"是否已收录"。 */
  async function sendCandidate(facts: CandidateFacts): Promise<void> {
    if (!user) {
      setCandidateFailure({ code: 'UNAUTHORIZED', message: '需要先登录才能申请新增门店', fields: {} });
      return;
    }
    setCandidateBusy(true);
    setCandidateFailure(null);
    if (candIdemRef.current === null) candIdemRef.current = newIdempotencyKey();
    try {
      const created = await api.createCandidate({ ...facts, idempotency_key: candIdemRef.current });
      setCandidate(created);
      setCandidateForm(null);
      const reused = created.duplicates.some((d) => d.reason === 'same_author_pending');
      setNotice(
        reused
          ? `已有相同的待核验申请（${created.id}），这次没有重复建店。可以继续对这家店投稿。`
          : `建店申请 ${created.id} 已提交，门店 ${created.restaurant_id ?? ''} 的地点状态为「${CANDIDATE_STATUS_LABEL[created.status]}」，需人工核验后才可能进入好店地图。现在可以继续填写实吃投稿。`,
      );
      if (created.restaurant_id) {
        setRestaurantId(created.restaurant_id);
        setTerm('');
        setFound(null);
      }
    } catch (e) {
      setCandidateFailure(readFailure(e));
    } finally {
      setCandidateBusy(false);
    }
  }

  function addDish(): void {
    const v = dishInput.trim();
    if (!v) return;
    setDishNames((cur) => (cur.includes(v) ? cur : [...cur, v]));
    setDishInput('');
  }

  async function addRealPhoto(file: File): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const id = await api.uploadPhoto(file);
      setMediaIds((cur) => (cur.length >= MAX_MEDIA ? cur : [...cur, id]));
    } catch (e) {
      setFailure(readFailure(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      const id = await api.uploadTestPhoto(restaurantId);
      setMediaIds((cur) => (cur.length >= MAX_MEDIA ? cur : [...cur, id]));
    } catch (e) {
      setFailure(readFailure(e));
    } finally {
      setBusy(false);
    }
  }

  function fieldError(key: string): string | null {
    const f = failure?.fields[key];
    return typeof f === 'string' ? f : null;
  }

  const extraErrors = failure ? Object.keys(failure.fields).filter((k) => !FIELD_KEYS.includes(k)) : [];

  async function send(): Promise<void> {
    if (!user || restaurantId === null) return;
    setBusy(true);
    setNotice(null);
    try {
      const s = await api.submit({
        restaurant_id: restaurantId,
        visited_date: visitedDate,
        attitude,
        dish_names: dishNames,
        reason,
        media_ids: mediaIds,
        disclosure,
        idempotency_key: idemRef.current ?? undefined,
      });
      setDone(s);
      setFailure(null);
      setDishNames([]);
      setReason('');
      setMediaIds([]);
      clearDraft();
      idemRef.current = newIdempotencyKey();
      void loadDetail(restaurantId);
    } catch (e) {
      setFailure(readFailure(e));
      setDone(null);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(): Promise<void> {
    if (restaurantId === null) return;
    if (!confirm('撤回后这条反馈立即停止公开、立即停止计票，更早的已批准版本不会自动恢复。确定撤回？')) return;
    setBusy(true);
    setFailure(null);
    try {
      await api.withdrawFeedback(restaurantId);
      setNotice('已撤回，本店票数已重算');
      await loadDetail(restaurantId);
    } catch (e) {
      setFailure(readFailure(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="page page-narrow">
        <StatusBlock kind="loading" message="正在确认登录状态…" />
      </div>
    );
  }

  const my = detail?.my_current_feedback ?? null;
  const reasonLen = reason.trim().length;
  const selected = detail ?? null;

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>{revise ? '修改这条反馈' : '推荐好店 · 提交实吃反馈'}</h1>
          <p className="hint">
            只写你真的吃过的那一家。提交后进入人工审核，通过才会公开并计入票数。规则版本 {RULE_VERSION}。
          </p>
        </div>
        <Link className="btn small plain" to="/map">
          回地图
        </Link>
      </div>

      {revise && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            修改会生成一个新的待审核版本；在新版本通过之前，原先已通过的版本继续公开显示并继续计票。
            {my && my.approved_revision !== null ? ` 当前公开的是第 ${my.approved_revision} 版。` : ''}
          </p>
        </div>
      )}

      {!user && (
        <StatusBlock
          kind="empty"
          message="投稿需要登录：实吃记录必须能对应到具体账号，页面本身不判定权限。以下内容可以先进在本机草稿里。"
          action={
            <div className="btn-row">
              <Link className="btn" to="/login?next=/submit">
                内测登录
              </Link>
              <Link className="btn plain" to="/map">
                先逛地图
              </Link>
            </div>
          }
        />
      )}

      {done && (
        <div className="panel">
          <div className="alert ok">
            <div>
              <strong>已提交，等待人工审核</strong>
              <p style={{ margin: '4px 0 0' }}>
                投稿号 {done.id} · 第 {done.version} 版 · 状态 {STATUS_LABEL[done.status]} · {done.restaurant_name}
              </p>
              {done.pending_verify_reason && <p className="hint" style={{ margin: '4px 0 0' }}>{done.pending_verify_reason}</p>}
              <div className="btn-row" style={{ marginTop: 8 }}>
                <Link className="btn small" to={`/restaurants/${done.restaurant_id}`}>
                  看门店页
                </Link>
                <Link className="btn small plain" to="/me">
                  看我的投稿
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && <div className="alert ok">{notice}</div>}

      {failure && (
        <div className="alert bad" role="alert">
          <div>
            <strong>{failure.message}</strong>
            {failure.code === 'IDEMPOTENCY_CONFLICT' && (
              <p className="hint" style={{ margin: '4px 0 0' }}>
                这个幂等键已经用过。若确实要改成另一份内容重新提交，点下面的按钮换一个新键（已填内容不会丢失）。
              </p>
            )}
            {extraErrors.map((k) => (
              <p key={k} className="hint" style={{ margin: '4px 0 0' }}>
                {k}：{failure.fields[k]}
              </p>
            ))}
            {failure.code === 'IDEMPOTENCY_CONFLICT' && (
              <button
                className="btn small plain"
                type="button"
                style={{ marginTop: 6 }}
                onClick={() => {
                  idemRef.current = newIdempotencyKey();
                  setFailure(null);
                }}
              >
                换幂等键重新开始一次提交
              </button>
            )}
          </div>
        </div>
      )}

      <section className="panel">
        <h2>选择门店</h2>
        <label className="field">
          <span className="label">搜索店名、菜品或地址</span>
          <input
            type="search"
            value={term}
            placeholder="例如：酸汤鱼、肠旺面"
            aria-label="搜索要投稿的门店"
            onChange={(e) => setTerm(e.target.value)}
          />
          <FieldErr msg={fieldError('restaurant_id')} />
        </label>

        {selected ? (
          <div className="card">
            <h3>
              {selected.name}
              {selected.branch ? <small>（{selected.branch}）</small> : null}
            </h3>
            <p className="card-dishes">{selected.address}</p>
            <div className="card-row">
              <span className={selected.place_status === 'VERIFIED' ? 'badge ok' : 'badge warn'}>
                {selected.place_status === 'VERIFIED' ? `地点已核验 ${selected.place_verified_at ?? ''}` : '地点待核验'}
              </span>
              {selected.is_test_data && <span className="badge muted">演示数据 #{selected.id}</span>}
            </div>
            <div className="btn-row">
              <Link className="btn small plain" to={`/restaurants/${selected.id}`}>
                看门店页
              </Link>
              <button className="btn small plain" type="button" onClick={() => setRestaurantId(null)}>
                清除选择
              </button>
            </div>
          </div>
        ) : detailNote ? (
          <p className="hint">读不到这家门店：{detailNote}</p>
        ) : (
          <p className="hint">还没有选择门店。搜索后从「平台收录」里选一家。</p>
        )}

        {found && (
          <>
            <h3 style={{ marginTop: 12 }}>平台收录（{found.own.length}）</h3>
            {found.own.length === 0 ? (
              <div className="card">
                <p className="hint">
                  没有匹配的已收录门店。如果这家店确实还没被收录，可以提交建店申请；审核员核验地点之后它才会进入待验证图层。
                </p>
                <div className="btn-row">
                  <button
                    className="btn small"
                    type="button"
                    disabled={candidateForm !== null}
                    onClick={() => {
                      setCandidateFailure(null);
                      setCandidateForm({ name: term.trim(), source: 'manual_point' });
                    }}
                  >
                    申请新增这家门店
                  </button>
                </div>
              </div>
            ) : (
              <div className="list">
                {found.own.slice(0, 6).map((r) => (
                  <div className={r.id === restaurantId ? 'card card-active' : 'card'} key={r.id}>
                    <h3>
                      {r.name}
                      {r.branch ? <small>（{r.branch}）</small> : null}
                    </h3>
                    <p className="card-dishes">{r.address}</p>
                    <p className="card-meta">
                      地点核验：{r.place_status === 'VERIFIED' ? '已核验' : '待核验'} · 推荐菜：{r.dish_highlights.slice(0, 3).join('、') || '尚未有人填写'}
                    </p>
                    <div className="btn-row">
                      <button className="btn small" type="button" onClick={() => pickStore(r)}>
                        选为投稿对象
                      </button>
                      <Link className="btn small plain" to={`/restaurants/${r.id}`}>
                        看依据
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ marginTop: 12 }}>地图地点候选（{found.provider.length}）</h3>
            {found.provider.length === 0 ? (
              <p className="hint">没有第三方地点候选结果。</p>
            ) : (
              <>
                <p className="hint">
                  候选来自地点数据，存在不等于好吃，也不等于平台收录；选中它只是把坐标和来源带进建店申请。
                </p>
                <ul className="pin-list">
                  {found.provider.slice(0, 4).map((c) => (
                    <li key={`${c.provider}-${c.poi_id}-${c.name}`}>
                      <div>
                        <strong>{c.name}</strong>
                        <div className="hint">
                          {c.address}（{c.provider} 候选 {c.poi_id} · {c.coord_note}）
                        </div>
                      </div>
                      <button
                        className="btn small"
                        type="button"
                        disabled={candidateForm !== null}
                        onClick={() => {
                          setCandidateFailure(null);
                          setCandidateForm({
                            name: c.name.replace(/^候选地点（未入库）·/, ''),
                            address: c.address,
                            lng: c.lng,
                            lat: c.lat,
                            source: 'provider_poi',
                            provider: c.provider,
                            poi_id: c.poi_id,
                          });
                        }}
                      >
                        以此候选新建门店
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {candidateFailure && (
        <div className="alert bad" role="alert">
          <strong>{candidateFailure.message}</strong>
          {candidateFailure.code === 'UNAUTHORIZED' && (
            <Link className="btn small" to="/login?next=/submit" style={{ marginLeft: 8 }}>
              去登录
            </Link>
          )}
        </div>
      )}

      {candidateForm && (
        <CandidateForm
          initial={candidateForm}
          busy={candidateBusy}
          submitLabel={user ? '提交建店申请' : '登录后提交建店申请'}
          fieldErrors={candidateFailure?.fields ?? {}}
          onSubmit={(facts) => void sendCandidate(facts)}
          onCancel={() => setCandidateForm(null)}
          draftKey={`qianwei.candidate-draft.${user?.id ?? 'anon'}`}
        />
      )}

      {candidate && (
        <section className="panel">
          <h2>我提交的建店申请</h2>
          <div className="card">
            <h3>
              {candidate.name}
              {candidate.branch ? <small>（{candidate.branch}）</small> : null}
            </h3>
            <p className="card-dishes">{candidate.address}</p>
            <div className="card-row">
              <span className={candidate.status === 'PENDING' ? 'badge warn' : 'badge ok'}>
                地点核验：{CANDIDATE_STATUS_LABEL[candidate.status]}
              </span>
              <span className="badge muted">
                {candidate.id} · 第 {candidate.revision} 版
              </span>
            </div>
            {candidate.reject_reason && <p>驳回原因：{candidate.reject_reason}</p>}
            {candidate.duplicates.length > 0 && (
              <ul className="pin-list">
                {candidate.duplicates.map((d) => (
                  <li key={`${d.kind}-${d.matched_id}-${d.reason}`}>
                    <div>
                      <strong>{d.name}</strong>
                      <div className="hint">
                        {DUPLICATE_REASON_LABEL[d.reason]}
                        {d.distance_m !== null ? ` · 约 ${d.distance_m} 米（直线）` : ''} · {d.matched_id}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="hint">重复提示只是给人看的线索：引擎不据此自动合并，也不自动驳回。</p>
            <div className="btn-row">
              <Link className="btn small plain" to="/me">
                看我的申请进度
              </Link>
              {candidate.restaurant_id && (
                <Link className="btn small plain" to={`/restaurants/${candidate.restaurant_id}`}>
                  看这家新店
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>{revise ? '新版本内容' : '实吃内容'}</h2>

        <div className="field">
          <span className="label" id="attitude-label">
            对这家店的态度
          </span>
          <div className="radio-row" role="radiogroup" aria-labelledby="attitude-label">
            {ATTITUDES.map((a) => (
              <label key={a}>
                <input type="radio" name="attitude" value={a} checked={attitude === a} onChange={() => setAttitude(a)} />
                {ATTITUDE_LABEL[a]}
              </label>
            ))}
          </div>
          <FieldErr msg={fieldError('attitude')} />
          <p className="hint">
            第一条「推荐好店」要用“推荐”，并附 1—6 张本人上传的图片和至少一道菜；同一门店后续的“一般／不推荐”不要求图片。
          </p>
        </div>

        <div className="form-grid form-grid-2">
          <label className="field">
            <span className="label">实吃日期</span>
            <input
              type="date"
              value={visitedDate}
              max={todayMax ?? undefined}
              onChange={(e) => setVisitedDate(e.target.value)}
            />
            <FieldErr msg={fieldError('visited_date')} />
          </label>
          <div className="field">
            <span className="label">人均（本表单不提交）</span>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              人均来自其他用户的报告值，只能通过门店记录的纠错与复核流程修改，投稿不会直接改动它。
            </p>
          </div>
        </div>

        <div className="field">
          <span className="label" id="dish-label">
            推荐菜
          </span>
          <input
            value={dishInput}
            aria-labelledby="dish-label"
            placeholder="例如：酸汤鱼、折耳根炒腊肉"
            onChange={(e) => setDishInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDish();
              }
            }}
          />
          <FieldErr msg={fieldError('dish_names')} />
          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn small" type="button" onClick={addDish} disabled={dishInput.trim() === ''}>
              添加
            </button>
            {dishNames.length > 0 && (
              <button className="btn small plain" type="button" onClick={() => setDishNames([])}>
                清空菜品
              </button>
            )}
          </div>
          {dishNames.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              {dishNames.map((d) => (
                <span className="chip" key={d}>
                  {d}
                  <button className="link-btn" type="button" onClick={() => setDishNames((cur) => cur.filter((x) => x !== d))}>
                    移除
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="field">
          <span className="label">理由（{reasonLen} 字，需要 20—500 字）</span>
          <textarea
            value={reason}
            maxLength={500}
            placeholder="写清你吃了什么、口味与分量如何、服务与交通，以及会不会再来。"
            onChange={(e) => setReason(e.target.value)}
          />
          <FieldErr msg={fieldError('reason')} />
        </label>

        <div className="field">
          <span className="label">图片（最多 {MAX_MEDIA} 张，推荐态度至少 1 张）</span>
          <div className="btn-row">
            <label className="btn small" style={{ opacity: busy || !user || restaurantId === null || mediaIds.length >= MAX_MEDIA ? 0.5 : 1 }}>
              上传图片（自动剥离位置信息）
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                disabled={busy || !user || restaurantId === null || mediaIds.length >= MAX_MEDIA}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void addRealPhoto(f);
                }}
              />
            </label>
            {meta !== null && meta.env !== 'production' && (
              <button
                className="btn small plain"
                type="button"
                disabled={busy || !user || restaurantId === null || mediaIds.length >= MAX_MEDIA}
                title={!user ? '需要登录' : restaurantId === null ? '先选择门店' : '生成一张标注为合成的演示图片'}
                onClick={() => void addPhoto()}
              >
                添加一张演示图片
              </button>
            )}
            <span className="hint" style={{ margin: 0 }}>
              上传的图片先审核后公开；服务端会剥离 EXIF 位置信息（含 GPS）。
            </span>
          </div>
          <FieldErr msg={fieldError('media_ids')} />
          {mediaIds.length > 0 && (
            <div className="thumbs" style={{ marginTop: 8 }}>
              {mediaIds.map((m) => (
                <div key={m} style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 120 }}>
                  {photos[m] ? (
                    <img className="thumb" src={photos[m]} alt={`合成图片 ${m}`} loading="lazy" />
                  ) : (
                    <span className="thumb" title="图片地址未返回" />
                  )}
                  <span className="hint" style={{ margin: 0 }}>
                    合成图，非真实探店照片
                  </span>
                  <button className="btn small plain" type="button" onClick={() => setMediaIds((cur) => cur.filter((x) => x !== m))}>
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <span className="label" id="disclosure-label">
            利益披露（必填）
          </span>
          <div className="radio-row" role="radiogroup" aria-labelledby="disclosure-label">
            {DISCLOSURES.map((d) => (
              <label key={d}>
                <input
                  type="radio"
                  name="disclosure"
                  value={d}
                  checked={disclosure === d}
                  onChange={() => setDisclosure(d)}
                />
                {DISCLOSURE_LABEL[d]}
              </label>
            ))}
          </div>
          <FieldErr msg={fieldError('disclosure')} />
          <p className="hint">
            非“无关联，自费实吃”会随这条反馈一起公开显示，但不计入社区独立票数。
          </p>
        </div>

        {user && (
          <div className="btn-row">
            <button className="btn" type="button" disabled={busy || restaurantId === null} onClick={() => void send()}>
              {busy ? '提交中…' : revise ? '提交新版本到审核' : '提交到审核'}
            </button>
            {restaurantId === null && <span className="hint" style={{ margin: 0 }}>先选择一家已收录门店。</span>}
          </div>
        )}
        <p className="hint">
          本表单持有一个幂等键，提交失败后重复点击不会产生第二条记录；草稿按账号存在本机（{draftKey}），
          绑定某个账号的草稿在切换账号后不能由另一个账号提交。
        </p>
      </section>

      {user && restaurantId !== null && my && (
        <section className="panel">
          <h3>已有一条我的反馈</h3>
          <div className="card-row">
            <span className="badge">{ATTITUDE_LABEL[my.attitude]}</span>
            <span className="badge">实吃 {my.visited_date}</span>
            <span className="badge">{STATUS_LABEL[my.content_status]}</span>
            {my.approved_revision !== null && <span className="badge ok">公开第 {my.approved_revision} 版</span>}
            {my.pending_revision !== null && <span className="badge warn">第 {my.pending_revision} 版待审</span>}
          </div>
          <p className="hint">{my.reason}</p>
          <p className="hint">撤回会立即停止公开并退出计票，更早的已批准版本不会自动复活，票数即时重算。</p>
          <div className="btn-row">
            <Link className="btn small ghost" to={`/submit?restaurant=${restaurantId}&revise=1`}>
              修改这条
            </Link>
            <button className="btn small danger" type="button" disabled={busy} onClick={() => void withdraw()}>
              撤回
            </button>
          </div>
        </section>
      )}

      <details className="panel qian-dict">
        <summary>黔味小词典 · 写反馈时对照</summary>
        <dl>
          <dt>酸汤</dt>
          <dd>苗侗家常的发酵汤底：红酸汤多以毛辣果（野生小番茄）发酵，白酸汤走米汤发酵，酸得干净不刺口。</dd>
          <dt>折耳根</dt>
          <dd>鱼腥草的根，凉拌菜与蘸水里的常客，气味门槛高，爱者极爱。</dd>
          <dt>丝娃娃</dt>
          <dd>贵阳街头小吃：薄面皮裹十来样素菜丝，灵魂在一碗蘸水。</dd>
          <dt>烙锅</dt>
          <dd>食材在平锅上烙熟蘸干辣椒面，贵州夜宵的常客。</dd>
          <dt>肠旺面</dt>
          <dd>肥肠、血旺、脆臊配碱水面，红油打底的贵阳早点。</dd>
          <dt>蘸水</dt>
          <dd>贵州餐桌的半条命：糊辣椒、折耳根、酸汤各成流派，一桌一配。</dd>
        </dl>
        <p className="hint" style={{ marginBottom: 0 }}>
          只讲味道文化，不替任何门店背书；哪家好吃，以你的实吃反馈为准。
        </p>
      </details>

      <div className="stale-note">
        演示版本：门店、图片与实吃记录均为合成测试数据，不代表任何真实餐馆；服务端还会复核账号、日期、图片归属与北京范围。
      </div>
    </div>
  );
}
