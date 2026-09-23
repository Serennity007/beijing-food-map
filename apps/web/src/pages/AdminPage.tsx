/** 内容后台：页面只调用接口并原样展示引擎/服务端的结果与错误；权限、版本锁、重算都在引擎里。 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BUSINESS_STATUSES,
  PLACE_STATUSES,
  REPORT_KIND_LABEL,
  REPORT_STATUS_LABEL,
  RISK_STATUSES,
  RULE_VERSION,
  SCORING_WINDOW_DAYS,
  addDays,
  type AuditRec,
  type ReportQueueEntry,
  type BusinessStatus,
  type EndorsementStatus,
  type ModerationQueueEntry,
  type PlaceVerificationStatus,
  type Restaurant,
  type RestaurantDetail,
  type RiskStatus,
} from '@qianwei/contracts';
import { useApi } from '../data/api';
import { ClientError, type PatchStatusInput } from '../data/client';
import { StatusBlock } from '../components/ui';

type ModerateAction = 'approve' | 'reject' | 'hide';
type TabKey = 'reports' | 'queue' | 'status' | 'merge' | 'endorsement' | 'audit';

const TABS: Array<{ key: TabKey; label: string; adminOnly?: boolean }> = [
  { key: 'queue', label: '待审队列' },
  { key: 'reports', label: '举报复核' },
  { key: 'status', label: '门店状态' },
  { key: 'merge', label: '合并', adminOnly: true },
  { key: 'endorsement', label: '编辑背书' },
  { key: 'audit', label: '审计日志' },
];

const PLACE_LABEL: Record<PlaceVerificationStatus, string> = {
  PENDING: '待核验',
  VERIFIED: '已核验',
  REJECTED: '核验未通过',
};

const BUSINESS_LABEL: Record<BusinessStatus, string> = {
  UNKNOWN: '营业状态未核实',
  OPEN: '营业中',
  SUSPECTED_CLOSED: '疑似闭店',
  CLOSED: '已闭店',
};

const RISK_LABEL: Record<RiskStatus, string> = {
  CLEAR: '无风险标记',
  REVIEW_REQUIRED: '需人工复核',
  BLOCKED: '已阻断',
};

const ENDORSEMENT_LABEL: Record<EndorsementStatus, string> = {
  NONE: '无编辑背书',
  ACTIVE: '背书有效',
  EXPIRED: '背书已过期',
  REVOKED: '背书已撤销',
};

const QUEUE_TYPE_LABEL: Record<ModerationQueueEntry['type'], string> = {
  submission: '实吃记录（首次）',
  feedback_version: '实吃记录（修订版）',
  media: '图片',
  publication: '清单发布申请',
  endorsement: '编辑背书复核',
};

const AUDIT_LABEL: Record<string, string> = {
  feedback_approve: '内容版本通过',
  feedback_reject: '内容版本驳回',
  feedback_hide: '内容版本隐藏',
  publication_approve: '发布申请通过',
  publication_reject: '发布申请驳回',
  publication_hide: '发布申请撤销',
  media_approve: '图片通过',
  media_reject: '图片驳回',
  media_hide: '图片隐藏',
  patch_status: '门店状态变更',
  merge: '门店合并',
  merge_conflict: '合并票冲突记录',
  endorsement_verify: '编辑背书核验',
  endorsement_revoke: '编辑背书撤销',
  workorder_created: '举报生成复核工单',
  delete_account: '账号注销',
};

interface Failure {
  code: string;
  message: string;
  field: string | null;
}

/** 引擎/服务端错误统一取出 code、message 与首个字段错误，页面不改写措辞。 */
function toFailure(e: unknown): Failure {
  if (e instanceof ClientError) {
    const values = e.fieldErrors ? Object.values(e.fieldErrors) : [];
    return { code: e.code, message: e.message, field: values[0] ?? null };
  }
  return { code: '', message: e instanceof Error ? e.message : '请求失败', field: null };
}

function failureText(f: Failure): string {
  if (f.code === 'VERSION_CONFLICT') return '已被其他人处理，队列已刷新';
  return f.field ? `${f.message}（${f.field}）` : f.message;
}

function statusMeta(s: string): { label: string; cls: string } {
  switch (s) {
    case 'PENDING':
      return { label: '待审', cls: 'warn' };
    case 'PENDING_REVIEW':
      return { label: '待审', cls: 'warn' };
    case 'APPROVED':
      return { label: '已批准', cls: 'ok' };
    case 'PUBLISHED':
      return { label: '已公开', cls: 'ok' };
    case 'REJECTED':
      return { label: '已驳回', cls: 'danger' };
    case 'REVOKED':
      return { label: '已撤销', cls: 'danger' };
    case 'HIDDEN':
      return { label: '已隐藏', cls: 'muted' };
    case 'WITHDRAWN':
      return { label: '作者已撤回', cls: 'muted' };
    case 'DRAFT':
      return { label: '草稿', cls: 'muted' };
    case 'PRIVATE':
      return { label: '未公开', cls: 'muted' };
    default:
      return { label: s, cls: 'muted' };
  }
}

/** 结果文案只描述引擎确实做的事（公开、计票、链接失效），不做额外承诺。 */
function resultMessage(entry: ModerationQueueEntry, action: ModerateAction): string {
  const store = entry.restaurant_name ? `（${entry.restaurant_name}）` : '';
  if (entry.type === 'publication') {
    if (action === 'approve') return `发布申请 ${entry.id} 已通过，清单已公开并生成新的分享令牌`;
    if (action === 'reject') return `发布申请 ${entry.id} 已驳回，清单保持未公开`;
    return `发布申请 ${entry.id} 已撤销公开，旧分享链接立即失效`;
  }
  if (entry.type === 'media') {
    if (action === 'approve') return `图片 ${entry.id} 已过审，可对公众显示`;
    if (action === 'reject') return `图片 ${entry.id} 已驳回，不再进入可显示白名单`;
    return `图片 ${entry.id} 已隐藏`;
  }
  if (action === 'approve') return `版本 ${entry.id} 已公开，票数已重算${store}`;
  if (action === 'reject') return `版本 ${entry.id} 已驳回，不计入社区票，票数已重算${store}`;
  return `版本 ${entry.id} 已隐藏，该条不再计票，票数已重算${store}`;
}

function Alert({ kind, children }: { kind: 'ok' | 'bad'; children: ReactNode }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function AdminPage() {
  const { api, user, ready } = useApi();
  const [tab, setTab] = useState<TabKey>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailSeq = useRef(0);

  const loadDetail = useCallback(
    async (id: string) => {
      const my = ++detailSeq.current;
      setDetailBusy(true);
      try {
        const d = await api.detail(id);
        if (my !== detailSeq.current) return;
        setDetail(d);
        setSelectedId(id);
        setDetailError(null);
      } catch (e) {
        if (my !== detailSeq.current) return;
        setDetail(null);
        setDetailError(toFailure(e).message);
      } finally {
        if (my === detailSeq.current) setDetailBusy(false);
      }
    },
    [api],
  );

  const canModerate = user !== null && (user.roles.includes('moderator') || user.roles.includes('admin'));
  const isAdmin = user !== null && user.roles.includes('admin');
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const active: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : 'queue';

  if (!ready) {
    return (
      <div className="page page-narrow">
        <StatusBlock kind="loading" message="正在确认当前账号身份…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page page-narrow">
        <StatusBlock
          kind="empty"
          message="内容后台需要登录。请使用具备 moderator 或 admin 角色的内测账号。"
          action={
            <Link className="btn small" to="/login?next=/admin">
              去登录
            </Link>
          }
        />
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div className="page page-narrow">
        <h1>内容后台</h1>
        <StatusBlock
          kind="error"
          message={`当前账号「${user.display_name}」没有 moderator 或 admin 角色。本页面只是入口便利，不是权限边界：这些接口在引擎/服务端同样会以 403 FORBIDDEN 拒绝，前端隐藏按钮并不能绕过。`}
          action={
            <Link className="btn small plain" to="/map">
              回到地图
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>内容后台</h1>
        <span className="hint">
          当前账号 {user.display_name}（{user.roles.join('/')}） · 数据通道 {api.mode === 'static' ? '浏览器内引擎' : '后端 API'} · 规则版本 {RULE_VERSION}
        </span>
      </div>

      <div className="chips" role="group" aria-label="后台分区">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip ${active === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="hint">
        合并门店只对 admin 开放，这里按同一条服务端规则隐藏入口；审核、状态变更、背书核验需要 moderator 或 admin。
      </p>

      {selectedId && (
        <div className="panel">
          <h2>当前工作门店</h2>
          {detail ? (
            <dl className="facts">
              <div>
                <dt>门店</dt>
                <dd>
                  <Link to={`/restaurants/${detail.id}`}>
                    {detail.name}
                    {detail.branch ? `（${detail.branch}）` : ''}
                  </Link>
                  <small> {detail.id}</small>
                </dd>
              </div>
              <div>
                <dt>版本</dt>
                <dd>
                  v{detail.version} · 地点版本 v{detail.location_version}
                </dd>
              </div>
              <div>
                <dt>图层</dt>
                <dd>{detail.in_default_layer ? '在默认好图层内' : '不在默认好图层'}</dd>
              </div>
            </dl>
          ) : (
            <p className="hint">{detailBusy ? '门店读取中…' : (detailError ?? `已选择 ${selectedId}`)}</p>
          )}
        </div>
      )}

      {active === 'queue' && <QueuePanel />}
      {active === 'status' && (
        <StatusPanel picked={detail} busy={detailBusy} error={detailError} onPick={(id) => void loadDetail(id)} />
      )}
      {active === 'merge' && (
        <MergePanel source={detail} busy={detailBusy} onReload={(id) => loadDetail(id)} />
      )}
      {active === 'endorsement' && (
        <EndorsementPanel detail={detail} busy={detailBusy} error={detailError} onPick={(id) => void loadDetail(id)} onReload={(id) => loadDetail(id)} />
      )}
      {active === 'reports' && <ReportsPanel onPick={(id) => { void loadDetail(id); setTab('status'); }} />}
      {active === 'audit' && <AuditPanel />}

      <p className="hint">
        演示后台使用合成数据，生产环境后台为独立部署并需强认证（MFA/受控身份源）。
      </p>
    </div>
  );
}

function StorePicker({
  label,
  pickedName,
  onPick,
}: {
  label: string;
  pickedName: string | null;
  onPick: (r: Restaurant) => void;
}) {
  const { api } = useApi();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Restaurant[] | null>(null);
  const [candidateCount, setCandidateCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  /* 输入 300ms 防抖，晚到的旧结果丢弃 */
  useEffect(() => {
    const t = term.trim();
    const my = ++seq.current;
    if (!t) {
      setHits(null);
      setCandidateCount(0);
      return;
    }
    const timer = setTimeout(() => {
      void api
        .search(t)
        .then((r) => {
          if (my !== seq.current) return;
          setHits(r.own);
          setCandidateCount(r.provider_candidates.length);
          setError(null);
        })
        .catch((e: unknown) => {
          if (my !== seq.current) return;
          setHits(null);
          setError(toFailure(e).message);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, api]);

  return (
    <div>
      <label className="field">
        <span className="label">{label}</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="门店名、分店、菜名或地址"
          aria-label={label}
        />
      </label>
      {error && <Alert kind="bad">{error}</Alert>}
      {hits && hits.length === 0 && <p className="hint">平台内没有匹配门店。</p>}
      {candidateCount > 0 && <p className="hint">另有 {candidateCount} 条供应商候选（未入库），本后台不创建门店。</p>}
      {hits && hits.length > 0 && (
        <div className="list">
          {hits.map((r) => (
            <div className="card" key={r.id}>
              <h3>
                {r.name}
                {r.branch ? <small>（{r.branch}）</small> : null}
              </h3>
              <p className="card-meta">
                {r.id} · {r.address}
              </p>
              <div className="card-row">
                <span className={`badge ${r.in_default_layer ? 'ok' : 'muted'}`}>
                  {r.in_default_layer ? '默认层内' : '默认层外'}
                </span>
                <span className={`badge ${r.place_status === 'VERIFIED' ? 'ok' : 'warn'}`}>
                  地点{PLACE_LABEL[r.place_status]}
                </span>
                <span className={`badge ${r.business_status === 'OPEN' ? 'ok' : r.business_status === 'UNKNOWN' ? 'muted' : 'danger'}`}>
                  {BUSINESS_LABEL[r.business_status]}
                </span>
                <span className={`badge ${r.risk_status === 'CLEAR' ? 'muted' : 'danger'}`}>{RISK_LABEL[r.risk_status]}</span>
                <span className="badge">v{r.version}</span>
              </div>
              <div className="card-actions">
                <button type="button" className="btn small" onClick={() => onPick(r)} aria-label={`载入 ${r.name}（${r.id}）`}>
                  载入该门店
                </button>
                <Link className="btn small plain" to={`/restaurants/${r.id}`}>
                  看公开页
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {pickedName && <p className="hint">已选：{pickedName}</p>}
    </div>
  );
}

function QueuePanel() {
  const { api } = useApi();
  const [entries, setEntries] = useState<ModerationQueueEntry[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setBusy(true);
    try {
      const list = await api.moderationQueue();
      const map = await api.mediaUrls(list.flatMap((e) => e.media_ids));
      if (my !== seq.current) return;
      setEntries(list);
      setUrls((prev) => ({ ...prev, ...map }));
      setError(null);
    } catch (e) {
      if (my !== seq.current) return;
      setEntries([]);
      setError(toFailure(e).message);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (entry: ModerationQueueEntry, action: ModerateAction, reason: string) => {
      setBusy(true);
      try {
        await api.moderate({ target: entry.id, action, reason, expected_version: entry.version });
        setNotice(resultMessage(entry, action));
        setError(null);
      } catch (e) {
        const f = toFailure(e);
        setNotice(null);
        setError(failureText(f));
      } finally {
        await load();
      }
    },
    [api, load],
  );

  return (
    <div className="panel">
      <div className="page-head">
        <h2>待审队列</h2>
        <button type="button" className="btn small ghost" onClick={() => void load()} disabled={busy}>
          {busy ? '读取中…' : '重载队列'}
        </button>
      </div>
      <p className="hint">
        队列目标即 target：反馈版本 <code>V0001#v2</code>、发布申请 <code>PUBxxxx</code>、图片 <code>MMxxxx</code>；乐观版本取条目版本号。
        较低 revision 不能覆盖已批准的较高 revision；隐藏只作用于当前已批准版本，对队列里的待审版本会返回 409。
      </p>
      {notice && <Alert kind="ok">{notice}</Alert>}
      {error && <Alert kind="bad">{error}</Alert>}
      {!entries && !error && <StatusBlock kind="loading" message="队列读取中…" />}
      {entries && entries.length === 0 && !error && <StatusBlock kind="empty" message="没有待审条目。反馈、发布申请与图片都被处理完了。" />}
      {entries && entries.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">待审内容队列，每行可执行通过、驳回、隐藏</caption>
            <thead>
              <tr>
                <th scope="col">类型</th>
                <th scope="col">门店</th>
                <th scope="col">作者</th>
                <th scope="col">摘要</th>
                <th scope="col">提交时间</th>
                <th scope="col">状态</th>
                <th scope="col">版本号</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <QueueRow key={entry.id} entry={entry} urls={urls} busy={busy} onAct={act} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QueueRow({
  entry,
  urls,
  busy,
  onAct,
}: {
  entry: ModerationQueueEntry;
  urls: Record<string, string>;
  busy: boolean;
  onAct: (entry: ModerationQueueEntry, action: ModerateAction, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const st = statusMeta(entry.status);

  function ask(action: ModerateAction) {
    if (action !== 'approve' && !reason.trim()) {
      setLocalError('驳回与隐藏必须写明理由');
      return;
    }
    setLocalError(null);
    void onAct(entry, action, reason.trim());
  }

  return (
    <tr>
      <td>
        {QUEUE_TYPE_LABEL[entry.type]}
        <small> {entry.id}</small>
      </td>
      <td>
        {entry.restaurant_id ? (
          <Link to={`/restaurants/${entry.restaurant_id}`}>{entry.restaurant_name ?? entry.restaurant_id}</Link>
        ) : (
          <span>
            {entry.restaurant_name ?? '—'}
            <small> 无门店关联</small>
          </span>
        )}
      </td>
      <td>{entry.author}</td>
      <td>
        <span>{entry.preview}</span>
        {entry.media_ids.length > 0 && (
          <div className="thumbs">
            {entry.media_ids.map((id) => {
              const url = urls[id];
              return url ? (
                <span
                  key={id}
                  className="hint"
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 120 }}
                >
                  <img className="thumb" src={url} alt={`待审测试图 ${id}`} />
                  <span>待审测试图</span>
                </span>
              ) : (
                <span className="hint" key={id}>
                  {id}：接口未返回可显示地址（未过审图片只向作者本人给出）
                </span>
              );
            })}
          </div>
        )}
      </td>
      <td>
        <small>{entry.submitted_at ?? '时间未知'}</small>
      </td>
      <td>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </td>
      <td>v{entry.version}</td>
      <td>
        <label className="field">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="驳回/隐藏理由"
            aria-label={`操作理由 ${entry.id}`}
          />
        </label>
        {entry.is_author_self ? (
          <p className="hint">
            <span className="badge danger">作者不能审核自己的内容</span>
          </p>
        ) : null}
        {localError && <span className="err">{localError}</span>}
        <div className="btn-row">
          <button
            type="button"
            className="btn small"
            disabled={busy || entry.is_author_self}
            onClick={() => ask('approve')}
            aria-label={`通过 ${entry.id}`}
          >
            通过
          </button>
          <button
            type="button"
            className="btn small plain"
            disabled={busy || entry.is_author_self}
            onClick={() => ask('reject')}
            aria-label={`驳回 ${entry.id}`}
          >
            驳回
          </button>
          <button
            type="button"
            className="btn small danger"
            disabled={busy || entry.is_author_self}
            onClick={() => ask('hide')}
            aria-label={`隐藏 ${entry.id}`}
          >
            隐藏
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusPanel({
  picked,
  busy,
  error,
  onPick,
}: {
  picked: RestaurantDetail | null;
  busy: boolean;
  error: string | null;
  onPick: (id: string) => void;
}) {
  const { api } = useApi();
  const [notice, setNotice] = useState<string | null>(null);

  async function patch(target: RestaurantDetail, input: PatchStatusInput): Promise<void> {
    setNotice(null);
    const r = await api.patchRestaurantStatus(input);
    const reasons = r.ineligibility_reasons;
    setNotice(
      `${target.id} 状态已提交，门店版本升至 v${r.version}；引擎判定${
        r.in_default_layer ? '已进入默认好图层' : `仍在层外（${reasons.join('、') || '未通过谓词'}）`
      }`,
    );
    onPick(target.id);
  }

  return (
    <div className="panel">
      <h2>门店状态</h2>
      <p className="hint">
        这里检索平台收录的全部门店，包括默认好图层之外的（未核验、疑似闭店、被举报的都要能被找到）。
        风险复核不会由举报自动判定，必须由人确认；变更地点会递增 location_version，旧址票只作历史。
      </p>
      <StorePicker label="检索门店（防抖 300ms）" pickedName={picked ? `${picked.name} · ${picked.id}` : null} onPick={(r) => onPick(r.id)} />
      {error && <Alert kind="bad">{error}</Alert>}
      {busy && !picked && <StatusBlock kind="loading" message="门店详情读取中…" />}
      {picked && (
        <StatusForm key={`${picked.id}#${picked.version}`} detail={picked} onPatch={patch} />
      )}
      {notice && <Alert kind="ok">{notice}</Alert>}
    </div>
  );
}

function StatusForm({
  detail,
  onPatch,
}: {
  detail: RestaurantDetail;
  onPatch: (target: RestaurantDetail, input: PatchStatusInput) => Promise<void>;
}) {
  const [place, setPlace] = useState<PlaceVerificationStatus>(detail.place_status);
  const [business, setBusiness] = useState<BusinessStatus>(detail.business_status);
  const [risk, setRisk] = useState<RiskStatus>(detail.risk_status);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next: PatchStatusInput = {
    id: detail.id,
    ...(place !== detail.place_status ? { place_status: place } : {}),
    ...(business !== detail.business_status ? { business_status: business } : {}),
    ...(risk !== detail.risk_status ? { risk_status: risk } : {}),
    reason: reason.trim(),
  };
  const dirty =
    next.place_status !== undefined || next.business_status !== undefined || next.risk_status !== undefined;

  async function save() {
    if (!dirty) {
      setLocalError('没有需要提交的变更');
      return;
    }
    if (!reason.trim()) {
      setLocalError('状态变更必须写明理由，日志会记录');
      return;
    }
    setLocalError(null);
    setSubmitError(null);
    setSaving(true);
    try {
      await onPatch(detail, next);
    } catch (e) {
      setSubmitError(failureText(toFailure(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3>
        {detail.name}
        {detail.branch ? <small>（{detail.branch}）</small> : null}
      </h3>
      <dl className="facts">
        <div>
          <dt>门店 ID</dt>
          <dd>{detail.id}</dd>
        </div>
        <div>
          <dt>地点核验</dt>
          <dd>
            {PLACE_LABEL[detail.place_status]}
            {detail.place_verified_at ? <small> 核验于 {detail.place_verified_at}</small> : null}
          </dd>
        </div>
        <div>
          <dt>营业状态</dt>
          <dd>{BUSINESS_LABEL[detail.business_status]}</dd>
        </div>
        <div>
          <dt>风险状态</dt>
          <dd>{RISK_LABEL[detail.risk_status]}</dd>
        </div>
        <div>
          <dt>默认层</dt>
          <dd>
            {detail.in_default_layer ? '在层内' : '不在层内'}
            {detail.ineligibility_reasons.length > 0 && (
              <span className="badges">
                {detail.ineligibility_reasons.map((r) => (
                  <span className="badge warn" key={r}>
                    {r}
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>
            v{detail.version} · location_version v{detail.location_version}
            {detail.merged_into ? <small> 已合并到 {detail.merged_into}</small> : null}
          </dd>
        </div>
      </dl>

      <div className="form-grid form-grid-2">
        <label className="field">
          <span className="label">地点核验状态</span>
          <select value={place} onChange={(e) => setPlace(e.target.value as PlaceVerificationStatus)} aria-label="地点核验状态">
            {PLACE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PLACE_LABEL[s]}（{s}）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">营业状态</span>
          <select
            value={business}
            onChange={(e) => setBusiness(e.target.value as BusinessStatus)}
            aria-label="营业状态"
          >
            {BUSINESS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUSINESS_LABEL[s]}（{s}）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">风险状态</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value as RiskStatus)} aria-label="风险状态">
            {RISK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RISK_LABEL[s]}（{s}）
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">理由（写入审计日志）</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：现场照片确认已搬迁，旧址核验作废"
            aria-label="状态变更理由"
          />
        </label>
      </div>
      {localError && <span className="err">{localError}</span>}
      {submitError && <Alert kind="bad">{submitError}</Alert>}
      <div className="btn-row">
        <button type="button" className="btn" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? '提交中…' : '提交变更'}
        </button>
        {!dirty && <span className="hint">三项状态与当前值相同，没有可提交的变更</span>}
      </div>
    </div>
  );
}

function MergePanel({
  source,
  busy,
  onReload,
}: {
  source: RestaurantDetail | null;
  busy: boolean;
  onReload: (id: string) => Promise<void>;
}) {
  const { api } = useApi();
  const [target, setTarget] = useState<Restaurant | null>(null);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function run() {
    if (!source || !target) {
      setLocalError('先选择来源门店与目标门店');
      return;
    }
    if (!reason.trim()) {
      setLocalError('合并必须写明理由');
      return;
    }
    if (source.id === target.id) {
      setLocalError('不能与自身合并');
      return;
    }
    setLocalError(null);
    const ok = window.confirm(
      `把 ${source.id}（${source.name}）合并进 ${target.id}（${target.name}）？旧 ID 永久重定向到目标，反馈与清单引用会迁移，不可撤销。`,
    );
    if (!ok) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const r = await api.mergeRestaurants({
        source_id: source.id,
        target_id: target.id,
        reason: reason.trim(),
        expected_version: source.version,
      });
      setCanonical(r.canonical);
      setTarget(null);
      setReason('');
      await onReload(r.canonical);
    } catch (e) {
      setSubmitError(failureText(toFailure(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>合并门店</h2>
      <p className="hint">
        只有确认为同一家分店才合并；品牌相同、距离相近都不是理由。合并需要 admin 角色，expected_version 取来源门店版本，
        冲突时返回 409。来源门店在「门店状态」里选择。
      </p>
      {canonical && (
        <Alert kind="ok">
          已合并，canonical 门店为 {canonical} ·{' '}
          <Link className="btn small" to={`/restaurants/${canonical}`}>
            打开 canonical
          </Link>
        </Alert>
      )}
      {!source && (busy ? <StatusBlock kind="loading" message="来源门店读取中…" /> : <StatusBlock kind="empty" message="先在「门店状态」载入来源门店。" />)}
      {source && (
        <dl className="facts">
          <div>
            <dt>来源</dt>
            <dd>
              {source.name}
              {source.branch ? `（${source.branch}）` : ''} · {source.id} · v{source.version}
            </dd>
          </div>
        </dl>
      )}
      <StorePicker
        label="目标门店（保留的 canonical）"
        pickedName={target ? `${target.name} · ${target.id}` : null}
        onPick={(r) => setTarget(r)}
      />
      <label className="field">
        <span className="label">合并理由</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：营业执照与实地核验为同一家，历史重复条目并入"
          aria-label="合并理由"
        />
      </label>
      {localError && <span className="err">{localError}</span>}
      {submitError && <Alert kind="bad">{submitError}</Alert>}
      <div className="btn-row">
        <button type="button" className="btn danger" disabled={saving || !source || !target} onClick={() => void run()}>
          {saving ? '合并中…' : '执行合并'}
        </button>
      </div>
    </div>
  );
}

function EndorsementPanel({
  detail,
  busy,
  error,
  onPick,
  onReload,
}: {
  detail: RestaurantDetail | null;
  busy: boolean;
  error: string | null;
  onPick: (id: string) => void;
  onReload: (id: string) => Promise<void>;
}) {
  const { api } = useApi();
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function run(action: 'verify' | 'revoke') {
    if (!detail) return;
    if (action === 'revoke' && !reason.trim()) {
      setLocalError('撤销背书必须写明理由');
      return;
    }
    setLocalError(null);
    setSubmitError(null);
    setSaving(true);
    try {
      const r = await api.revokeOrVerifyEndorsement({
        restaurant_id: detail.id,
        action,
        reason: reason.trim() || undefined,
      });
      setNotice(
        action === 'verify'
          ? `背书已核验，当前状态 ${ENDORSEMENT_LABEL[r.endorsement]}；到期仍按实吃日期计算`
          : `背书已撤销，门店 ${r.id} 的背书来源已移除，票数已重算`,
      );
      setReason('');
      await onReload(detail.id);
    } catch (e) {
      const f = toFailure(e);
      setSubmitError(f.code === 'NOT_FOUND' ? '该门店没有编辑背书' : failureText(f));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>编辑背书</h2>
      <p className="hint">
        背书有效期由真实实吃日期决定：实吃日为第 1 天，到实吃日 +{SCORING_WINDOW_DAYS - 1} 天自然结束即失效，
        重新核验不会把到期日往后推。核验必须由背书作者之外的人执行，作者即使是 admin 也会被判 FORBIDDEN。
      </p>
      <StorePicker label="检索门店" pickedName={detail ? `${detail.name} · ${detail.id}` : null} onPick={(r) => onPick(r.id)} />
      {error && <Alert kind="bad">{error}</Alert>}
      {busy && !detail && <StatusBlock kind="loading" message="门店详情读取中…" />}
      {detail && (
        <>
          <dl className="facts">
            <div>
              <dt>门店</dt>
              <dd>
                {detail.name}
                {detail.branch ? `（${detail.branch}）` : ''} · {detail.id}
              </dd>
            </div>
            <div>
              <dt>背书状态</dt>
              <dd>
                <span className={`badge ${detail.basis.editorial === 'ACTIVE' ? 'editorial' : 'muted'}`}>
                  {ENDORSEMENT_LABEL[detail.basis.editorial]}
                </span>
              </dd>
            </div>
            {detail.basis.editorial_detail ? (
              <>
                <div>
                  <dt>作者</dt>
                  <dd>{detail.basis.editorial_detail.author}</dd>
                </div>
                <div>
                  <dt>实吃日期</dt>
                  <dd>
                    {detail.basis.editorial_detail.visited_date}
                    <small> 有效期至 {addDays(detail.basis.editorial_detail.visited_date, SCORING_WINDOW_DAYS - 1)}</small>
                  </dd>
                </div>
                <div>
                  <dt>理由</dt>
                  <dd>{detail.basis.editorial_detail.reason}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>理由</dt>
                <dd>该门店没有编辑背书记录（门店级 basis.editorial 为 {detail.basis.editorial}）</dd>
              </div>
            )}
            <div>
              <dt>公开来源</dt>
              <dd>{detail.basis.sources.length ? detail.basis.sources.join('、') : '无'}</dd>
            </div>
          </dl>
          <label className="field">
            <span className="label">理由（撤销必填，建议核验也写明依据）</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：本人于该日到店复核，菜单与照片一致"
              aria-label="背书操作理由"
            />
          </label>
          {localError && <span className="err">{localError}</span>}
          {notice && <Alert kind="ok">{notice}</Alert>}
          {submitError && <Alert kind="bad">{submitError}</Alert>}
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void run('verify')}
              aria-label={`核验编辑背书 ${detail.id}`}
            >
              核验
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={saving}
              onClick={() => void run('revoke')}
              aria-label={`撤销编辑背书 ${detail.id}`}
            >
              撤销
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AuditPanel() {
  const { api } = useApi();
  const [rows, setRows] = useState<AuditRec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setBusy(true);
    try {
      const list = await api.auditLog();
      if (my !== seq.current) return;
      setRows([...list].sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at))));
      setError(null);
    } catch (e) {
      if (my !== seq.current) return;
      setRows([]);
      setError(toFailure(e).message);
    } finally {
      if (my === seq.current) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="panel">
      <div className="page-head">
        <h2>审计日志</h2>
        <button type="button" className="btn small ghost" onClick={() => void load()} disabled={busy}>
          {busy ? '读取中…' : '重载'}
        </button>
      </div>
      <p className="hint">需要 moderator 或 admin 角色；接口只返回最近 200 条，完整留痕在服务端存储里。</p>
      {error && <Alert kind="bad">{error}</Alert>}
      {!rows && !error && <StatusBlock kind="loading" message="日志读取中…" />}
      {rows && rows.length === 0 && !error && <StatusBlock kind="empty" message="还没有审计记录。" />}
      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <caption className="sr-only">最近 {rows.length} 条后台操作记录，最新在前</caption>
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">操作者</th>
                <th scope="col">动作</th>
                <th scope="col">目标</th>
                <th scope="col">理由</th>
                <th scope="col">版本</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <small>{r.at}</small>
                  </td>
                  <td>{r.actor_id}</td>
                  <td>
                    {AUDIT_LABEL[r.action] ?? r.action}
                    <small> {r.action}</small>
                  </td>
                  <td>{r.target}</td>
                  <td>{r.reason ?? '—'}</td>
                  <td>
                    {r.from_version ?? '—'} → {r.to_version ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsPanel({ onPick }: { onPick: (id: string) => void }) {
  const { api } = useApi();
  const [rows, setRows] = useState<ReportQueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try { setRows(await api.reportQueue()); }
    catch (e) { setError(toFailure(e).message); }
    finally { setBusy(false); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  return <div className="panel">
    <div className="page-head"><h2>举报复核</h2><button className="btn small ghost" disabled={busy} onClick={() => void load()}>刷新</button></div>
    <p className="hint">最新 200 条举报。当前举报针对门店，未关联具体反馈；请先核实说明，再进入门店状态处理。工单状态流转在下一阶段补齐。</p>
    {error && <Alert kind="bad">{error}</Alert>}
    {!rows && busy && <StatusBlock kind="loading" message="举报读取中…" />}
    {rows?.length === 0 && <StatusBlock kind="empty" message="暂无举报。" />}
    {rows?.map(r => <article className="card" key={r.id}>
      <h3>{r.restaurant_name ?? '门店信息不可用'} · {REPORT_KIND_LABEL[r.kind]}</h3>
      <p>{r.detail}</p><p className="hint">{r.created_at} · {REPORT_STATUS_LABEL[r.status]} · {r.id}</p>
      {r.result_note && <p>{r.result_note}</p>}
      <button className="btn small" onClick={() => onPick(r.restaurant_id)}>核验门店状态</button>
    </article>)}
  </div>;
}
