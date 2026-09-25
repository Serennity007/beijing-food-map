import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ATTITUDE_LABEL,
  COMMUNITY_QUALIFICATION_LABEL,
  CUISINE_LABEL,
  DISCLOSURE_LABEL,
  REPORT_STATUS_LABEL,
  shanghaiDay,
  type FeedbackPublic,
  type ReportTicket,
  type RestaurantDetail,
  type SystemCollectionKind,
} from '@qianwei/contracts';
import { useApi } from '../data/api';
import { describeError, readErrorCode } from '../data/errors';
import { CuisineBadges, SourceBadges, StatusBlock, navUrl } from '../components/ui';

const REPORT_KINDS: Array<{ value: ReportTicket['kind']; label: string }> = [
  { value: 'closed', label: '已经闭店／搬走了' },
  { value: 'wrong_location', label: '位置不对' },
  { value: 'wrong_info', label: '店名、地址等信息有误' },
  { value: 'abuse', label: '内容违规或人身攻击' },
];

const SYS_KINDS: Array<{ kind: SystemCollectionKind; label: string; hint: string }> = [
  { kind: 'want', label: '想吃', hint: '与“吃过”互斥，切换时自动移除另一标记' },
  { kind: 'visited', label: '吃过', hint: '只是私人分类，不会自动生成公开实吃或推荐票' },
  { kind: 'private_stash', label: '私藏', hint: '与其他清单一样只对自己可见' },
];

/** 餐馆详情：公开资料 + 推荐依据 + 反馈来源；私密操作在服务端鉴权后进行。 */
export function RestaurantPage() {
  const { id = '' } = useParams();
  const { api, user } = useApi();
  const [params] = useSearchParams();
  const [d, setD] = useState<RestaurantDetail | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [inCollections, setInCollections] = useState<Record<SystemCollectionKind, boolean>>({
    want: false,
    visited: false,
    private_stash: false,
  });
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportKind, setReportKind] = useState<ReportTicket['kind']>('wrong_info');
  const [reportDetail, setReportDetail] = useState('');
  const [reportTarget, setReportTarget] = useState<FeedbackPublic | null>(null);
  const reportBox = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const detail = await api.detail(id);
      setD(detail);
      setNotFound(false);
      setPhotos(await api.mediaUrls(detail.photo_media_ids));
      if (user) {
        const cols = await api.collections();
        const next = { want: false, visited: false, private_stash: false };
        for (const c of cols) {
          if (c.system_kind && c.items.some((i) => i.restaurant_id === detail.id)) next[c.system_kind] = true;
        }
        setInCollections(next);
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      // 未公开与不存在统一表现，不泄露存在性
      if (code === 'NOT_FOUND') setNotFound(true);
      else setError(describeError(readErrorCode(e), (e as Error).message));
    } finally {
      setBusy(false);
    }
  }, [api, id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleCollection(kind: SystemCollectionKind, on: boolean) {
    setBusy(true);
    setError(null);
    try {
      const cols = await api.toggleSystemItem(id, kind, on);
      const next = { want: false, visited: false, private_stash: false };
      for (const c of cols) {
        if (c.system_kind && c.items.some((i) => i.restaurant_id === id)) next[c.system_kind] = true;
      }
      setInCollections(next);
      setNotice(on ? '已加入' : '已移除');
    } catch (e) {
      setError(describeError(readErrorCode(e), (e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm('撤回后这条反馈立即停止公开并不再计票，历史版本不会自动复活。确定撤回？')) return;
    setBusy(true);
    setError(null);
    try {
      await api.withdrawFeedback(id);
      setNotice('已撤回，本店票数已重算');
      await load();
    } catch (e) {
      setError(describeError(readErrorCode(e), (e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  /** 从某条反馈进来的举报要带着版本指针，否则审核员只知道"这家店有人不满"。 */
  function openReportFor(target: FeedbackPublic | null) {
    setReportTarget(target);
    if (target) setReportKind('abuse');
    setReportOpen(true);
    requestAnimationFrame(() => reportBox.current?.scrollIntoView({ block: 'center' }));
  }

  async function sendReport() {
    setBusy(true);
    setError(null);
    const target = reportTarget ? `${reportTarget.id}#v${reportTarget.revision}` : null;
    try {
      const t = await api.createReport({ restaurant_id: id, kind: reportKind, detail: reportDetail, feedback_target: target });
      setNotice(
        `工单 ${t.id}（${REPORT_STATUS_LABEL[t.status]}）已记入复核队列${t.feedback_target ? `，关联到第 ${reportTarget?.revision ?? ''} 版反馈 ${t.feedback_target}` : ''}` +
          '：同一门店同一问题重复提交不会新增工单，处理结果会显示在“我的”页面',
      );
      setReportOpen(false);
      setReportTarget(null);
      setReportDetail('');
    } catch (e) {
      setError(describeError(readErrorCode(e), (e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="page page-narrow">
        <StatusBlock
          kind="error"
          message="门店不存在、未公开或已被合并。"
          action={
            <Link className="btn small" to="/map">
              回到地图
            </Link>
          }
        />
      </div>
    );
  }

  if (!d) {
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
          <StatusBlock kind="loading" message="正在读取门店资料…" />
        )}
      </div>
    );
  }

  const back = `/map${params.get('from') === 'list' ? '' : `?focus=${d.id}`}`;

  return (
    <div className="page">
      <p className="hint" style={{ marginBottom: 8 }}>
        <Link to={back}>← 返回地图（保留视野与筛选）</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>
            {d.name}
            {d.branch ? <small>（{d.branch}）</small> : null}
          </h1>
          <div className="card-row">
            <CuisineBadges cuisines={d.cuisines} />
            <SourceBadges r={d} />
          </div>
        </div>
        <div className="btn-row">
          <a className="btn small" href={navUrl(d)} target="_blank" rel="noreferrer">
            外部导航
          </a>
          <Link className="btn small ghost" to={`/submit?restaurant=${d.id}`}>
            我吃过，写反馈
          </Link>
        </div>
      </div>

      {error && <div className="alert bad">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      {/* B2：不达标的原因必须醒目常显，不能折叠进"完整依据"里 */}
      {!d.in_default_layer && (
        <div className="basis warn" style={{ marginTop: 14 }}>
          <strong>这家店暂不在默认好店地图</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {d.ineligibility_reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* B2：首屏先回答"吃什么、多少钱、在哪"；完整依据按需展开 */}
      <section className="panel" style={{ marginTop: 14 }}>
        {d.photo_media_ids.length > 0 ? (
          <div className="thumbs">
            {d.photo_media_ids.map((m) =>
              photos[m] ? (
                <img className="thumb" key={m} src={photos[m]} alt={`门店图片 ${m}（测试图片，非真实门店）`} loading="lazy" />
              ) : (
                <span className="thumb" key={m} title="未审核图片仅作者可见" />
              ),
            )}
          </div>
        ) : (
          <p className="hint" style={{ margin: 0 }}>还没有原创门店图片。</p>
        )}
        <dl className="facts" style={{ marginTop: 10 }}>
          <div>
            <dt>地址</dt>
            <dd>
              {d.address}
              {d.floor_info ? ` · ${d.floor_info}` : ''}
            </dd>
          </div>
          <div>
            <dt>人均</dt>
            <dd className="money">
              {d.price.average === null ? '未知' : `¥${d.price.average}`}（{d.price.report_count} 人报告，用户自报）
            </dd>
          </div>
          <div>
            <dt>推荐菜</dt>
            <dd>{d.dish_highlights.join('、') || '尚未有人填写'}</dd>
          </div>
          <div>
            <dt>口味标签</dt>
            <dd>{d.taste_tags.join('、') || '无'}</dd>
          </div>
          <div>
            <dt>营业状态</dt>
            <dd>
              {d.business_status_note}
              {d.business_status === 'UNKNOWN' ? ' · 不自动推导“营业中”' : ''}
            </dd>
          </div>
        </dl>
        {d.in_default_layer && (
          <p className="basis-line">
            为什么在好店地图上：近 180 天里 {d.basis.tally.recommend} 位用户推荐（共 {d.basis.tally.total} 份有效反馈）
            {d.basis.editorial === 'ACTIVE' ? '，另有编辑实吃核验' : ''}，地点已核验。
          </p>
        )}
        <details className="basis-details">
          <summary>查看完整推荐依据（时间窗、票数、地点核验与坐标）</summary>
          <div className={d.in_default_layer ? 'basis' : 'basis warn'} style={{ marginTop: 8 }}>
            <strong>推荐依据</strong>
            <p style={{ margin: '4px 0 0' }}>
              {d.in_default_layer ? '这家店出现在默认好店图层，因为：' : '这家店暂不在默认好店图层。'}
            </p>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>
                社区：{COMMUNITY_QUALIFICATION_LABEL[d.basis.community]}。近 180 天窗口 {d.basis.window_start} ~ {d.basis.window_end}，推荐
                {d.basis.tally.recommend} / 一般 {d.basis.tally.neutral} / 不推荐 {d.basis.tally.not_recommend}，共 {d.basis.tally.total} 张有效独立票
              </li>
              <li>
                编辑实吃背书：
                {d.basis.editorial === 'ACTIVE' && d.basis.editorial_detail
                  ? `有效（${d.basis.editorial_detail.author} 于 ${d.basis.editorial_detail.visited_date} 实吃，另有人员核验）`
                  : d.basis.editorial === 'EXPIRED'
                    ? '已过期（超过实吃日起 180 天）'
                    : d.basis.editorial === 'REVOKED'
                      ? '已撤销'
                      : '无'}
              </li>
              <li>地点核验：{d.place_status === 'VERIFIED' ? `已核验 ${d.place_verified_at ?? ''}` : '未核验'}</li>
              {d.ineligibility_reasons.map((r) => (
                <li key={r}>不符合项：{r}</li>
              ))}
            </ul>
            <p className="hint" style={{ margin: '6px 0 0' }}>
              规则版本 {d.basis.rule_version}。收藏、点赞和浏览都不计入票数。
            </p>
          </div>
          <dl className="facts" style={{ marginTop: 8 }}>
            <div>
              <dt>地点核验</dt>
              <dd>{d.verification_note}</dd>
            </div>
            <div>
              <dt>坐标</dt>
              <dd>
                {d.lng.toFixed(5)}, {d.lat.toFixed(5)}（{d.coord_system}）
                {user ? '' : ' · 登录授权后才显示直线距离'}
              </dd>
            </div>
            <div>
              <dt>数据来源</dt>
              <dd>
                {d.basis.sources.length ? d.basis.sources.map((s) => (s === 'community' ? '社区实吃' : '编辑实吃')).join(' + ') : '尚无有效来源'}
                ，最近更新 {shanghaiDay(d.updated_at)}
              </dd>
            </div>
          </dl>
        </details>
      </section>

      <div className="detail-grid" style={{ marginTop: 14 }}>
        <div>
          <section className="panel">
            <h2>最近反馈（{d.feedback_page.items.length}）</h2>
            {d.feedback_page.items.length === 0 ? (
              <p className="hint">还没有公开反馈。真实吃过之后可以写第一条。</p>
            ) : (
              d.feedback_page.items.map((f) => <FeedbackRow key={f.id} f={f} onReport={user ? openReportFor : undefined} />)
            )}
          </section>
        </div>

        <div className="detail-aside">
          <section className="panel">
            <h3>我的记录</h3>
            {!user ? (
              <>
                <p className="hint">登录后可收藏、写实吃反馈和纠错。</p>
                <Link className="btn small" to="/login">
                  内测登录
                </Link>
              </>
            ) : (
              <>
                <div className="chips">
                  {SYS_KINDS.map((s) => (
                    <button
                      key={s.kind}
                      type="button"
                      className={inCollections[s.kind] ? 'chip active' : 'chip'}
                      aria-pressed={inCollections[s.kind]}
                      title={s.hint}
                      disabled={busy}
                      onClick={() => void toggleCollection(s.kind, !inCollections[s.kind])}
                    >
                      {inCollections[s.kind] ? '✓ ' : '+ '}
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="hint">私人清单不会公开，也不会代替实吃反馈。</p>

                {d.my_current_feedback ? (
                  <div className="feedback">
                    <div className="feedback-head">
                      <strong>{ATTITUDE_LABEL[d.my_current_feedback.attitude]}</strong>
                      <span>· 实吃 {d.my_current_feedback.visited_date}</span>
                      <span className="badge">{statusLabel(d.my_current_feedback.content_status)}</span>
                      {d.my_current_feedback.pending_revision !== null && (
                        <span className="badge warn">第 {d.my_current_feedback.pending_revision} 版待审</span>
                      )}
                    </div>
                    <p className="hint" style={{ margin: '6px 0' }}>
                      {d.my_current_feedback.reason}
                    </p>
                    <p className="hint" style={{ margin: '0 0 8px' }}>
                      {d.my_current_feedback.approved_revision !== null
                        ? `当前公开第 ${d.my_current_feedback.approved_revision} 版`
                        : '尚无已批准公开版本'}
                      {' · '}
                      {DISCLOSURE_LABEL[d.my_current_feedback.disclosure]}
                    </p>
                    <div className="btn-row">
                      <Link className="btn small ghost" to={`/submit?restaurant=${d.id}&revise=1`}>
                        修改这条
                      </Link>
                      <button className="btn small plain" type="button" disabled={busy} onClick={() => void withdraw()}>
                        撤回
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="hint">你还没有记录过这家店。</p>
                )}

                <div className="feedback" ref={reportBox}>
                  <h3>纠错／举报</h3>
                  {!reportOpen ? (
                    <button
                      className="btn small plain"
                      type="button"
                      onClick={() => {
                        setReportTarget(null);
                        setReportKind('wrong_info');
                        setReportOpen(true);
                      }}
                    >
                      提交纠错
                    </button>
                  ) : (
                    <>
                      {reportTarget && (
                        <p className="hint">
                          这条工单关联到「{reportTarget.author.display_name} 的第 {reportTarget.revision} 版反馈」
                          <button className="link-btn" type="button" onClick={() => setReportTarget(null)}>
                            改为举报整店
                          </button>
                        </p>
                      )}
                      <label className="field">
                        <span className="label">问题类型</span>
                        <select value={reportKind} onChange={(e) => setReportKind(e.target.value as ReportTicket['kind'])}>
                          {REPORT_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="label">说明</span>
                        <textarea
                          value={reportDetail}
                          onChange={(e) => setReportDetail(e.target.value)}
                          placeholder="例如：门头已换成别的店，最后一次经过是 9 月。"
                        />
                      </label>
                      <div className="btn-row">
                        <button className="btn small" type="button" disabled={busy} onClick={() => void sendReport()}>
                          提交工单
                        </button>
                        <button className="btn small plain" type="button" onClick={() => setReportOpen(false)}>
                          取消
                        </button>
                      </div>
                      <p className="hint">举报不会自动判定闭店或下架内容，只生成复核工单。</p>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="panel">
            <h3>菜系</h3>
            <p className="hint">{d.cuisines.map((c) => CUISINE_LABEL[c]).join(' · ')}</p>
            <p className="hint">
              演示数据 #{d.id}（is_test_data）。地址与图片均为合成内容，不代表真实门店。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  return s === 'PENDING' ? '待审核' : s === 'APPROVED' ? '已公开' : s === 'REJECTED' ? '未通过' : s === 'HIDDEN' ? '已隐藏' : '草稿';
}

function FeedbackRow({ f, onReport }: { f: FeedbackPublic; onReport?: (f: FeedbackPublic) => void }) {
  return (
    <article className="feedback">
      <div className="feedback-head">
        <strong>{ATTITUDE_LABEL[f.attitude]}</strong>
        <span>{f.author.display_name}</span>
        {f.author.is_editor && <span className="badge editorial">编辑</span>}
        <span>实吃 {f.visited_date}</span>
        <span className="badge">第 {f.revision} 版</span>
        {!f.counted_in_tally && (
          <span className="badge muted" title="关联披露、超出窗口或地点版本变化等情况不计数">
            不计入票数
          </span>
        )}
      </div>
      <p style={{ margin: '6px 0' }}>{f.reason}</p>
      <p className="hint" style={{ margin: 0 }}>
        {f.dish_names.length ? `菜品：${f.dish_names.join('、')} · ` : ''}
        {DISCLOSURE_LABEL[f.disclosure]}
        {f.disclosure_note ? `（${f.disclosure_note}）` : ''}
        {f.media_ids.length ? ` · ${f.media_ids.length} 张图` : ''}
      </p>
      {onReport && (
        <p style={{ margin: '6px 0 0' }}>
          <button className="link-btn" type="button" onClick={() => onReport(f)}>
            举报这条内容
          </button>
          <span className="hint"> · 工单会带上这条的具体版本，不会自动下架它</span>
        </p>
      )}
    </article>
  );
}
