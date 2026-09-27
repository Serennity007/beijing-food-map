/**
 * 内容后台（小程序，moderator / admin）：待审队列、地点核验、举报复核、门店状态、合并（admin）、审计日志。
 * 页面只调接口并原样展示引擎/服务端的结果与错误；权限、版本锁、重算都在引擎里。
 * 入口隐藏不是安全边界：403 时给出「角色不足」提示。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Input, Textarea } from '@tarojs/components'
import {
  BUSINESS_STATUSES,
  CANDIDATE_SOURCE_LABEL,
  CANDIDATE_STATUS_LABEL,
  DUPLICATE_REASON_LABEL,
  PLACE_STATUSES,
  PLACE_STATUS_LABEL,
  REPORT_KIND_LABEL,
  REPORT_STATUS_LABEL,
  RISK_STATUSES,
  SCORING_WINDOW_DAYS,
  addDays,
  type AuditRec,
  type BusinessStatus,
  type EndorsementStatus,
  type ModerationQueueEntry,
  type PlaceVerificationStatus,
  type ReportQueueEntry,
  type Restaurant,
  type RestaurantCandidate,
  type RestaurantDetail,
  type RiskStatus,
  type SessionUser,
} from '@qianwei/contracts'
import {
  ApiError,
  auditLog,
  candidateQueue,
  decideCandidate,
  decideReport,
  editorialEndorsement,
  fetchDetail,
  me,
  mergeRestaurants,
  moderate,
  moderationQueue,
  patchRestaurantStatus,
  reportQueue,
  searchStores,
} from '../../api'
import './index.scss'

const BUSINESS_LABEL: Record<BusinessStatus, string> = {
  UNKNOWN: '营业状态未核实',
  OPEN: '营业中',
  SUSPECTED_CLOSED: '疑似闭店',
  CLOSED: '已闭店',
}

const RISK_LABEL: Record<RiskStatus, string> = {
  CLEAR: '无风险标记',
  REVIEW_REQUIRED: '需人工复核',
  BLOCKED: '已阻断',
}

const QUEUE_TYPE_LABEL: Record<ModerationQueueEntry['type'], string> = {
  submission: '实吃记录（首次）',
  feedback_version: '实吃记录（修订版）',
  media: '图片',
  publication: '清单发布申请',
  endorsement: '编辑背书复核',
}

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
  candidate_create: '提交建店申请',
  candidate_resubmit: '建店申请补材料',
  candidate_verify: '地点核验通过',
  candidate_reject: '地点核验驳回',
  candidate_merge: '建店申请并入已有门店',
  delete_account: '账号注销',
}

function failureText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'VERSION_CONFLICT') return '已被其他人处理，队列已刷新'
    const values = Object.values(e.fields)
    return values[0] ? `${e.message}（${values[0]}）` : e.message
  }
  return e instanceof Error ? e.message : '请求失败'
}

type TabKey = 'queue' | 'candidates' | 'reports' | 'status' | 'merge' | 'endorsement' | 'audit'

export default function Admin() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<TabKey>('queue')
  const [detail, setDetail] = useState<RestaurantDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const detailSeq = useRef(0)

  const loadDetail = useCallback(async (id: string) => {
    const my = ++detailSeq.current
    setDetailBusy(true)
    try {
      const d = await fetchDetail(id)
      if (my !== detailSeq.current) return
      setDetail(d)
      setDetailError(null)
    } catch (e) {
      if (my !== detailSeq.current) return
      setDetail(null)
      setDetailError(failureText(e))
    } finally {
      if (my === detailSeq.current) setDetailBusy(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        setUser(await me())
      } catch {
        setUser(null)
      } finally {
        setReady(true)
      }
    })()
  }, [])

  if (!ready) {
    return (
      <View className="page">
        <View className="status">
          <Text>正在确认当前账号身份…</Text>
        </View>
      </View>
    )
  }

  if (!user) {
    return (
      <View className="page">
        <View className="status bad">
          <Text>内容后台需要登录，且账号需具备 moderator 或 admin 角色。</Text>
        </View>
        <Button className="btn" onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
          去登录
        </Button>
      </View>
    )
  }

  const canModerate = user.roles.includes('moderator') || user.roles.includes('admin')
  const isAdmin = user.roles.includes('admin')

  if (!canModerate) {
    return (
      <View className="page">
        <View className="status bad">
          <Text>当前账号「{user.display_name}」没有 moderator 或 admin 角色。这些接口在服务端同样会以 403 拒绝。</Text>
        </View>
        <Button className="btn" onClick={() => Taro.switchTab({ url: '/pages/me/index' })}>
          回到我的
        </Button>
      </View>
    )
  }

  const TABS: Array<{ key: TabKey; label: string; adminOnly?: boolean }> = [
    { key: 'queue', label: '待审队列' },
    { key: 'candidates', label: '地点核验' },
    { key: 'reports', label: '举报复核' },
    { key: 'status', label: '门店状态' },
    { key: 'merge', label: '合并', adminOnly: true },
    { key: 'endorsement', label: '编辑背书' },
    { key: 'audit', label: '审计日志' },
  ]
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin)

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">内容后台</Text>
        <Text className="sub">当前账号 {user.display_name}（{user.roles.join('/')}）</Text>
      </View>

      <View className="tab-chips">
        {visibleTabs.map((t) => (
          <Text key={t.key} className={tab === t.key ? 'chip active' : 'chip'} onClick={() => setTab(t.key)}>
            {t.label}
          </Text>
        ))}
      </View>
      <Text className="hint">合并门店只对 admin 开放；审核、状态变更需要 moderator 或 admin。</Text>

      {detail && (
        <View className="panel">
          <Text className="label">当前工作门店</Text>
          <Text className="row-main">
            {detail.name}
            {detail.branch ? `（${detail.branch}）` : ''} · {detail.id}
          </Text>
          <Text className="row-sub">
            v{detail.version} · 地点版本 v{detail.location_version} · {detail.in_default_layer ? '在默认好图层内' : '不在默认好图层'}
          </Text>
        </View>
      )}

      {tab === 'queue' && <QueuePanel />}
      {tab === 'candidates' && <CandidatesPanel isAdmin={isAdmin} onPick={(id) => void loadDetail(id)} />}
      {tab === 'reports' && <ReportsPanel onPick={(id) => void loadDetail(id)} />}
      {tab === 'status' && <StatusPanel picked={detail} busy={detailBusy} error={detailError} onPick={(id) => void loadDetail(id)} />}
      {tab === 'merge' && <MergePanel source={detail} onReload={(id) => void loadDetail(id)} />}
      {tab === 'endorsement' && (
        <EndorsementPanel
          picked={detail}
          busy={detailBusy}
          error={detailError}
          onPick={(r) => void loadDetail(r.id)}
          onReload={(id) => void loadDetail(id)}
        />
      )}
      {tab === 'audit' && <AuditPanel />}

      <View className="footer-note">
        <Text className="hint">演示后台使用合成数据，生产环境后台为独立部署并需强认证。</Text>
      </View>
    </View>
  )
}

function StorePicker({ label, pickedName, onPick }: { label: string; pickedName: string | null; onPick: (r: Restaurant) => void }) {
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Restaurant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const my = ++seq.current
    const t = term.trim()
    if (!t) {
      setHits(null)
      return
    }
    const timer = setTimeout(() => {
      void searchStores(t)
        .then((r) => {
          if (my !== seq.current) return
          setHits(r.own)
          setError(null)
        })
        .catch((e: unknown) => {
          if (my !== seq.current) return
          setHits(null)
          setError(failureText(e))
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  return (
    <View>
      <View className="field">
        <Text className="label">{label}</Text>
        <Input value={term} onInput={(e) => setTerm(e.detail.value)} placeholder="门店名、分店、菜名或地址" />
      </View>
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {hits && hits.length === 0 && <Text className="hint">平台内没有匹配门店。</Text>}
      {hits && hits.length > 0 && (
        <View className="list">
          {hits.slice(0, 8).map((r) => (
            <View className="card" key={r.id}>
              <Text className="card-name">
                {r.name}
                {r.branch ? `（${r.branch}）` : ''}
              </Text>
              <Text className="card-meta">
                {r.id} · {r.address}
              </Text>
              <View className="badge-row">
                <Text className={r.in_default_layer ? 'badge ok' : 'badge muted'}>{r.in_default_layer ? '默认层内' : '默认层外'}</Text>
                <Text className={r.place_status === 'VERIFIED' ? 'badge ok' : 'badge warn'}>地点{PLACE_STATUS_LABEL[r.place_status]}</Text>
                <Text className={r.business_status === 'OPEN' ? 'badge ok' : r.business_status === 'UNKNOWN' ? 'badge muted' : 'badge danger'}>{BUSINESS_LABEL[r.business_status]}</Text>
                <Text className={r.risk_status === 'CLEAR' ? 'badge muted' : 'badge danger'}>{RISK_LABEL[r.risk_status]}</Text>
                <Text className="badge muted">v{r.version}</Text>
              </View>
              <Button className="btn-plain" onClick={() => onPick(r)}>
                载入该门店
              </Button>
            </View>
          ))}
        </View>
      )}
      {pickedName && <Text className="hint">已选：{pickedName}</Text>}
    </View>
  )
}

function QueuePanel() {
  const [entries, setEntries] = useState<ModerationQueueEntry[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setEntries(await moderationQueue())
      setError(null)
    } catch (e) {
      setEntries([])
      setError(failureText(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(entry: ModerationQueueEntry, action: 'approve' | 'reject' | 'hide') {
    const reason = (reasons[entry.id] ?? '').trim()
    if (action !== 'approve' && reason === '') {
      setError('驳回与隐藏必须写明理由')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await moderate({ target: entry.id, action, reason: reason === '' ? undefined : reason, expected_version: entry.version })
      setNotice(`已处置 ${entry.id}（${QUEUE_TYPE_LABEL[entry.type]}）`)
    } catch (e) {
      setError(failureText(e))
    } finally {
      await load()
    }
  }

  return (
    <View className="panel">
      <View className="card-title">
        <Text className="label">待审队列</Text>
        <Button className="btn-plain" disabled={busy} onClick={() => void load()}>
          {busy ? '读取中…' : '重载'}
        </Button>
      </View>
      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
        </View>
      )}
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {!entries && !error && (
        <View className="status">
          <Text>队列读取中…</Text>
        </View>
      )}
      {entries && entries.length === 0 && !error && (
        <View className="empty">
          <Text>没有待审条目。</Text>
        </View>
      )}
      {entries?.map((entry) => (
        <View className="card" key={entry.id}>
          <View className="badge-row">
            <Text className="badge muted">
              {QUEUE_TYPE_LABEL[entry.type]} {entry.id}
            </Text>
            <Text className="badge muted">v{entry.version}</Text>
          </View>
          <Text className="card-name">{entry.restaurant_name ?? '—'}</Text>
          <Text className="card-meta">作者 {entry.author} · 摘要 {entry.preview}</Text>
          {entry.is_author_self ? (
            <Text className="hint">作者不能审核自己的内容：服务端会以 403 拒绝，请交给其他审核人员。</Text>
          ) : (
            <>
              <View className="field">
                <Text className="label">操作理由（驳回/隐藏必填）</Text>
                <Input value={reasons[entry.id] ?? ''} onInput={(e) => setReasons((cur) => ({ ...cur, [entry.id]: e.detail.value }))} placeholder="驳回/隐藏理由" />
              </View>
              <View className="btn-row">
                <Button className="btn-primary" disabled={busy} onClick={() => void act(entry, 'approve')}>
                  通过
                </Button>
                <Button className="btn-plain" disabled={busy} onClick={() => void act(entry, 'reject')}>
                  驳回
                </Button>
                <Button className="btn-plain" disabled={busy} onClick={() => void act(entry, 'hide')}>
                  隐藏
                </Button>
              </View>
            </>
          )}
        </View>
      ))}
    </View>
  )
}

function CandidatesPanel({ isAdmin, onPick }: { isAdmin: boolean; onPick: (id: string) => void }) {
  const [rows, setRows] = useState<RestaurantCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [mergePicks, setMergePicks] = useState<Record<string, { id: string; name: string } | null>>({})

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setRows(await candidateQueue())
    } catch (e) {
      setError(failureText(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(c: RestaurantCandidate, action: 'verify' | 'reject' | 'merge') {
    setBusy(true)
    setError(null)
    try {
      await decideCandidate({
        id: c.id,
        action,
        reason: (reasons[c.id] ?? '').trim() === '' ? undefined : (reasons[c.id] ?? '').trim(),
        target_restaurant_id: action === 'merge' ? (mergePicks[c.id]?.id ?? '').trim() || undefined : undefined,
        expected_version: c.version,
      })
      setRows(await candidateQueue())
    } catch (e) {
      setError(failureText(e))
      try {
        setRows(await candidateQueue())
      } catch {
        /* 保留上面的错误文案 */
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="panel">
      <View className="card-title">
        <Text className="label">地点核验</Text>
        <Button className="btn-plain" disabled={busy} onClick={() => void load()}>
          刷新
        </Button>
      </View>
      <Text className="hint">核验通过只解决「这家店在哪里、是否真实存在」；能不能进默认好店层仍要看社区票或编辑背书。</Text>
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {rows?.length === 0 && (
        <View className="empty">
          <Text>没有待处理的建店申请。</Text>
        </View>
      )}
      {rows?.map((c) => {
        const dupStores = c.duplicates.filter((d) => d.kind === 'restaurant')
        const pending = c.status === 'PENDING'
        return (
          <View className="card" key={c.id}>
            <Text className="card-name">
              {c.name}
              {c.branch ? `（${c.branch}）` : ''}
            </Text>
            <Text className="card-meta">{c.address}</Text>
            <View className="badge-row">
              <Text className={c.status === 'PENDING' ? 'badge warn' : c.status === 'REJECTED' ? 'badge danger' : 'badge ok'}>{CANDIDATE_STATUS_LABEL[c.status]}</Text>
              <Text className="badge muted">
                {c.id} · 第 {c.revision} 版 · v{c.version}
              </Text>
              <Text className="badge muted">{CANDIDATE_SOURCE_LABEL[c.source]}</Text>
            </View>
            <Text className="hint">来源说明：{c.evidence_note}</Text>
            <Text className="hint">
              提交人 {c.author_display_name} · 坐标 {c.lng.toFixed(5)}, {c.lat.toFixed(5)}（GCJ-02）· 菜系 {c.cuisines.join('、')}
            </Text>
            {c.reject_reason && <Text className="hint">上次驳回原因：{c.reject_reason}</Text>}
            {dupStores.length > 0 &&
              dupStores.map((d) => (
                <View className="row" key={`${d.kind}-${d.matched_id}`}>
                  <Text className="row-main">{d.name}</Text>
                  <Text className="row-sub">
                    {DUPLICATE_REASON_LABEL[d.reason]}
                    {d.distance_m !== null ? ` · 约 ${d.distance_m} 米（直线）` : ''} · {d.matched_id}
                  </Text>
                  <View className="btn-row">
                    <Button className="btn-plain" onClick={() => onPick(d.matched_id)}>
                      看这家店
                    </Button>
                    {isAdmin && pending && !c.is_author_self && (
                      <Button className="btn-plain" disabled={busy} onClick={() => setMergePicks((cur) => ({ ...cur, [c.id]: { id: d.matched_id, name: d.name } }))}>
                        并入到这家
                      </Button>
                    )}
                  </View>
                </View>
              ))}
            {c.is_author_self ? (
              <Text className="hint">这条是你本人提交的申请：按规则不能自审，服务端会以 403 拒绝。</Text>
            ) : pending ? (
              <>
                <View className="field">
                  <Text className="label">处理理由（驳回与并入必填）</Text>
                  <Input value={reasons[c.id] ?? ''} onInput={(e) => setReasons((cur) => ({ ...cur, [c.id]: e.detail.value }))} placeholder="例如：现场照片与门牌一致" />
                </View>
                <View className="btn-row">
                  <Button className="btn-primary" disabled={busy} onClick={() => void decide(c, 'verify')}>
                    地点核验通过
                  </Button>
                  <Button className="btn-plain" disabled={busy} onClick={() => void decide(c, 'reject')}>
                    驳回
                  </Button>
                </View>
                {isAdmin && (
                  <>
                    <StorePicker
                      label="并入目标门店（搜索后点选）"
                      pickedName={mergePicks[c.id] ? `${mergePicks[c.id]!.name} · ${mergePicks[c.id]!.id}` : null}
                      onPick={(r) => setMergePicks((cur) => ({ ...cur, [c.id]: { id: r.id, name: r.name } }))}
                    />
                    <View className="btn-row">
                      <Button className="btn-plain" disabled={busy || !(mergePicks[c.id]?.id)} onClick={() => void decide(c, 'merge')}>
                        并入已有门店
                      </Button>
                      {mergePicks[c.id] && (
                        <Button className="btn-plain" disabled={busy} onClick={() => setMergePicks((cur) => ({ ...cur, [c.id]: null }))}>
                          清除选择
                        </Button>
                      )}
                    </View>
                  </>
                )}
              </>
            ) : (
              <Text className="hint">该申请已处理完成，状态不可回退。</Text>
            )}
            {c.restaurant_id && (
              <Button className="btn-plain" onClick={() => onPick(c.restaurant_id!)}>
                看新建的这家店
              </Button>
            )}
          </View>
        )
      })}
    </View>
  )
}

function ReportsPanel({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<ReportQueueEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'>('ALL')
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setRows(await reportQueue(filter === 'ALL' ? null : filter))
    } catch (e) {
      setError(failureText(e))
    } finally {
      setBusy(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(r: ReportQueueEntry, action: 'start' | 'resolve' | 'dismiss') {
    setBusy(true)
    setError(null)
    try {
      await decideReport({
        id: r.id,
        action,
        reason: (reasons[r.id] ?? '').trim() === '' ? undefined : (reasons[r.id] ?? '').trim(),
        expected_version: r.version,
      })
      setRows(await reportQueue(filter === 'ALL' ? null : filter))
    } catch (e) {
      setError(failureText(e))
      try {
        setRows(await reportQueue(filter === 'ALL' ? null : filter))
      } catch {
        /* 保留错误文案 */
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="panel">
      <View className="card-title">
        <Text className="label">举报复核</Text>
        <Button className="btn-plain" disabled={busy} onClick={() => void load()}>
          刷新
        </Button>
      </View>
      <Text className="hint">这里只处置工单本身：闭店与风险结论要在「门店状态」里单独确认——举报不会自动判定一家店关门。</Text>
      <View className="tab-chips">
        {(['ALL', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const).map((f) => (
          <Text key={f} className={filter === f ? 'chip active' : 'chip'} onClick={() => setFilter(f)}>
            {f === 'ALL' ? '全部' : f === 'OPEN' ? '待处理' : f === 'IN_REVIEW' ? '复核中' : f === 'RESOLVED' ? '已处理' : '已驳回'}
          </Text>
        ))}
      </View>
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {rows?.length === 0 && (
        <View className="empty">
          <Text>{filter === 'ALL' ? '暂无举报。' : '该状态下没有工单。'}</Text>
        </View>
      )}
      {rows?.map((r) => (
        <View className="card" key={r.id}>
          <Text className="card-name">
            {r.restaurant_name ?? '门店信息不可用'} · {REPORT_KIND_LABEL[r.kind]}
          </Text>
          <Text className="card-meta">{r.detail}</Text>
          <View className="badge-row">
            <Text className={r.status === 'RESOLVED' ? 'badge ok' : r.status === 'DISMISSED' ? 'badge muted' : r.status === 'IN_REVIEW' ? 'badge warn' : 'badge danger'}>
              {REPORT_STATUS_LABEL[r.status]}
            </Text>
            <Text className="badge muted">
              {r.id} · v{r.version}
            </Text>
            {r.feedback_target && <Text className="badge muted">关联反馈 {r.feedback_target}</Text>}
          </View>
          {r.result_note && <Text className="hint">处理结果：{r.result_note}</Text>}
          {r.is_reporter_self ? (
            <Text className="hint">这条是你本人提交的举报：按规则不能自己处置，服务端会以 403 拒绝。</Text>
          ) : (
            <>
              {(r.status === 'OPEN' || r.status === 'IN_REVIEW') && (
                <View className="field">
                  <Text className="label">处理结果（结案与驳回必填，会回写给举报人）</Text>
                  <Input value={reasons[r.id] ?? ''} onInput={(e) => setReasons((cur) => ({ ...cur, [r.id]: e.detail.value }))} placeholder="例如：电话核实仍在营业" />
                </View>
              )}
              <View className="btn-row">
                {r.status === 'OPEN' && (
                  <Button className="btn-plain" disabled={busy} onClick={() => void decide(r, 'start')}>
                    开始复核
                  </Button>
                )}
                {(r.status === 'OPEN' || r.status === 'IN_REVIEW') && (
                  <>
                    <Button className="btn-primary" disabled={busy} onClick={() => void decide(r, 'resolve')}>
                      确认并结案
                    </Button>
                    <Button className="btn-plain" disabled={busy} onClick={() => void decide(r, 'dismiss')}>
                      驳回
                    </Button>
                  </>
                )}
              </View>
            </>
          )}
          {r.restaurant_id && (
            <Button className="btn-plain" onClick={() => onPick(r.restaurant_id)}>
              核验门店状态
            </Button>
          )}
        </View>
      ))}
    </View>
  )
}

function StatusPanel({ picked, busy, error, onPick }: { picked: RestaurantDetail | null; busy: boolean; error: string | null; onPick: (id: string) => void }) {
  const [place, setPlace] = useState<PlaceVerificationStatus>('PENDING')
  const [business, setBusiness] = useState<BusinessStatus>('UNKNOWN')
  const [risk, setRisk] = useState<RiskStatus>('CLEAR')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (picked) {
      setPlace(picked.place_status)
      setBusiness(picked.business_status)
      setRisk(picked.risk_status)
      setReason('')
      setNotice(null)
      setSubmitError(null)
    }
  }, [picked])

  async function save() {
    if (!picked) return
    if (reason.trim() === '') {
      setSubmitError('状态变更必须写明理由，日志会记录')
      return
    }
    setSaving(true)
    setSubmitError(null)
    try {
      const next: Parameters<typeof patchRestaurantStatus>[0] = {
        id: picked.id,
        reason: reason.trim(),
      }
      if (place !== picked.place_status) next.place_status = place
      if (business !== picked.business_status) next.business_status = business
      if (risk !== picked.risk_status) next.risk_status = risk
      const r = await patchRestaurantStatus(next)
      setNotice(`状态已提交，门店版本升至 v${r.version}；引擎判定${r.in_default_layer ? '已进入默认好图层' : `仍在层外（${r.ineligibility_reasons.join('、') || '未通过谓词'}）`}`)
      onPick(picked.id)
    } catch (e) {
      setSubmitError(failureText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="panel">
      <Text className="label">门店状态</Text>
      <Text className="hint">检索平台收录的全部门店（含默认好图层之外）。风险复核不会由举报自动判定，必须由人确认。</Text>
      <StorePicker label="检索门店（防抖 300ms）" pickedName={picked ? `${picked.name} · ${picked.id}` : null} onPick={(r) => onPick(r.id)} />
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {busy && !picked && (
        <View className="status">
          <Text>门店详情读取中…</Text>
        </View>
      )}
      {picked && (
        <View>
          <Text className="card-name">
            {picked.name}
            {picked.branch ? `（${picked.branch}）` : ''}
          </Text>
          <View className="badge-row">
            <Text className="badge muted">地点 {PLACE_STATUS_LABEL[picked.place_status]}</Text>
            <Text className="badge muted">{BUSINESS_LABEL[picked.business_status]}</Text>
            <Text className="badge muted">{RISK_LABEL[picked.risk_status]}</Text>
            <Text className="badge muted">v{picked.version}</Text>
          </View>
          {picked.ineligibility_reasons.length > 0 && (
            <View className="badge-row">
              {picked.ineligibility_reasons.map((r) => (
                <Text className="badge warn" key={r}>
                  {r}
                </Text>
              ))}
            </View>
          )}
          <View className="field">
            <Text className="label">地点核验状态</Text>
            <View className="chips">
              {PLACE_STATUSES.map((s) => (
                <Text key={s} className={place === s ? 'chip active' : 'chip'} onClick={() => setPlace(s)}>
                  {PLACE_STATUS_LABEL[s]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">营业状态</Text>
            <View className="chips">
              {BUSINESS_STATUSES.map((s) => (
                <Text key={s} className={business === s ? 'chip active' : 'chip'} onClick={() => setBusiness(s)}>
                  {BUSINESS_LABEL[s]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">风险状态</Text>
            <View className="chips">
              {RISK_STATUSES.map((s) => (
                <Text key={s} className={risk === s ? 'chip active' : 'chip'} onClick={() => setRisk(s)}>
                  {RISK_LABEL[s]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">理由（写入审计日志）</Text>
            <Textarea value={reason} onInput={(e) => setReason(e.detail.value)} placeholder="例：现场照片确认已搬迁，旧址核验作废" />
          </View>
          {notice && (
            <View className="alert ok">
              <Text>{notice}</Text>
            </View>
          )}
          {submitError && (
            <View className="alert bad">
              <Text>{submitError}</Text>
            </View>
          )}
          <Button className="btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? '提交中…' : '提交变更'}
          </Button>
        </View>
      )}
    </View>
  )
}

function MergePanel({ source, onReload }: { source: RestaurantDetail | null; onReload: (id: string) => void }) {
  const [target, setTarget] = useState<Restaurant | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function run() {
    if (!source || !target) {
      setSubmitError('先选择来源门店与目标门店')
      return
    }
    if (reason.trim() === '') {
      setSubmitError('合并必须写明理由')
      return
    }
    if (source.id === target.id) {
      setSubmitError('不能与自身合并')
      return
    }
    const ok = await Taro.showModal({
      title: '执行合并',
      content: `把 ${source.id}（${source.name}）合并进 ${target.id}（${target.name}）？旧 ID 永久重定向到目标，反馈与清单引用会迁移，不可撤销。`,
      confirmColor: '#a3231d',
    })
    if (!ok.confirm) return
    setSaving(true)
    setSubmitError(null)
    try {
      const r = await mergeRestaurants({
        source_id: source.id,
        target_id: target.id,
        reason: reason.trim(),
        expected_version: source.version,
      })
      setNotice(`已合并，canonical 门店为 ${r.canonical}`)
      setTarget(null)
      setReason('')
      onReload(r.canonical)
    } catch (e) {
      setSubmitError(failureText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="panel">
      <Text className="label">合并门店</Text>
      <Text className="hint">只有确认为同一家分店才合并；需要 admin 角色，expected_version 取来源门店版本，冲突返回 409。来源门店在「门店状态」里选择。</Text>
      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
        </View>
      )}
      {!source && <Text className="hint">先在「门店状态」载入来源门店。</Text>}
      {source && (
        <View className="card">
          <Text className="card-name">
            来源：{source.name}
            {source.branch ? `（${source.branch}）` : ''}
          </Text>
          <Text className="card-meta">
            {source.id} · v{source.version}
          </Text>
        </View>
      )}
      <StorePicker label="目标门店（保留的 canonical）" pickedName={target ? `${target.name} · ${target.id}` : null} onPick={(r) => setTarget(r)} />
      <View className="field">
        <Text className="label">合并理由</Text>
        <Textarea value={reason} onInput={(e) => setReason(e.detail.value)} placeholder="例：营业执照与实地核验为同一家" />
      </View>
      {submitError && (
        <View className="alert bad">
          <Text>{submitError}</Text>
        </View>
      )}
      <Button className="btn-primary" disabled={saving || !source || !target} onClick={() => void run()}>
        {saving ? '合并中…' : '执行合并'}
      </Button>
    </View>
  )
}

const ENDORSEMENT_LABEL: Record<EndorsementStatus, string> = {
  NONE: '无编辑背书',
  ACTIVE: '背书有效',
  EXPIRED: '背书已过期',
  REVOKED: '背书已撤销',
}

function EndorsementPanel({
  picked,
  busy,
  error,
  onPick,
  onReload,
}: {
  picked: RestaurantDetail | null
  busy: boolean
  error: string | null
  onPick: (r: Restaurant) => void
  onReload: (id: string) => void
}) {
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function run(action: 'verify' | 'revoke') {
    if (!picked) return
    if (action === 'revoke' && reason.trim() === '') {
      setLocalError('撤销背书必须写明理由')
      return
    }
    setLocalError(null)
    setSubmitError(null)
    setSaving(true)
    try {
      const r = await editorialEndorsement({
        restaurant_id: picked.id,
        action,
        reason: reason.trim() === '' ? undefined : reason.trim(),
      })
      setNotice(
        action === 'verify'
          ? `背书已核验，当前状态 ${ENDORSEMENT_LABEL[r.basis.editorial]}；到期仍按实吃日期计算`
          : `背书已撤销，门店 ${r.id} 的背书来源已移除，票数已重算`,
      )
      setReason('')
      onReload(picked.id)
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined
      setSubmitError(code === 'NOT_FOUND' ? '该门店没有编辑背书' : failureText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="panel">
      <Text className="label">编辑背书</Text>
      <Text className="hint">
        背书有效期由真实实吃日期决定：实吃日为第 1 天，到实吃日 +{SCORING_WINDOW_DAYS - 1} 天自然结束即失效，重新核验不会把到期日往后推。核验必须由背书作者之外的人执行，作者即使是 admin 也会被判 FORBIDDEN。
      </Text>
      <StorePicker label="检索门店" pickedName={picked ? `${picked.name} · ${picked.id}` : null} onPick={onPick} />
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {busy && !picked && (
        <View className="status">
          <Text>门店详情读取中…</Text>
        </View>
      )}
      {picked && (
        <>
          <View className="card">
            <View className="badge-row">
              <Text className={picked.basis.editorial === 'ACTIVE' ? 'badge ok' : 'badge muted'}>
                {ENDORSEMENT_LABEL[picked.basis.editorial]}
              </Text>
            </View>
            <Text className="card-meta">作者 {picked.basis.editorial_detail ? picked.basis.editorial_detail.author : '—'}</Text>
            {picked.basis.editorial_detail ? (
              <Text className="card-meta">
                实吃日期 {picked.basis.editorial_detail.visited_date}（有效期至 {addDays(picked.basis.editorial_detail.visited_date, SCORING_WINDOW_DAYS - 1)}）
              </Text>
            ) : (
              <Text className="hint">该门店没有编辑背书记录（门店级 basis.editorial 为 {picked.basis.editorial}）</Text>
            )}
            {picked.basis.editorial_detail && <Text className="card-meta">理由 {picked.basis.editorial_detail.reason}</Text>}
            <Text className="hint">公开来源：{picked.basis.sources.length ? picked.basis.sources.join('、') : '无'}</Text>
          </View>
          <View className="field">
            <Text className="label">理由（撤销必填，建议核验也写明依据）</Text>
            <Textarea value={reason} onInput={(e) => setReason(e.detail.value)} placeholder="例：本人于该日到店复核，菜单与照片一致" />
          </View>
          {localError && <Text className="err">{localError}</Text>}
          {notice && (
            <View className="alert ok">
              <Text>{notice}</Text>
            </View>
          )}
          {submitError && (
            <View className="alert bad">
              <Text>{submitError}</Text>
            </View>
          )}
          <View className="btn-row">
            <Button className="btn-primary" disabled={saving} onClick={() => void run('verify')}>
              {saving ? '处理中…' : '核验'}
            </Button>
            <Button className="btn-plain" disabled={saving} onClick={() => void run('revoke')}>
              撤销
            </Button>
          </View>
        </>
      )}
    </View>
  )
}

function AuditPanel() {
  const [rows, setRows] = useState<AuditRec[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const list = await auditLog()
      setRows([...list].sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at))))
      setError(null)
    } catch (e) {
      setRows([])
      setError(failureText(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View className="panel">
      <View className="card-title">
        <Text className="label">审计日志</Text>
        <Button className="btn-plain" disabled={busy} onClick={() => void load()}>
          {busy ? '读取中…' : '重载'}
        </Button>
      </View>
      <Text className="hint">需要 moderator 或 admin 角色；接口只返回最近 200 条。</Text>
      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {rows?.length === 0 && (
        <View className="empty">
          <Text>还没有审计记录。</Text>
        </View>
      )}
      {rows?.map((r) => (
        <View className="row" key={r.id}>
          <Text className="row-main">
            {AUDIT_LABEL[r.action] ?? r.action} · {r.target}
          </Text>
          <Text className="row-sub">
            {r.at} · 操作者 {r.actor_id} · {r.reason ?? '—'} · v{r.from_version ?? '—'} → v{r.to_version ?? '—'}
          </Text>
        </View>
      ))}
    </View>
  )
}
