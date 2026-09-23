/**
 * 我的页面。只显示服务端返回的投稿与工单，不在前端推断状态；
 * 角色与注销后果由服务端执行，前端仅负责发起请求与展示回执。
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ATTITUDE_LABEL,
  DISCLOSURE_LABEL,
  REPORT_KIND_LABEL,
  REPORT_STATUS_LABEL,
  type ContentVersionStatus,
  type ReportTicket,
  type Submission,
} from '@qianwei/contracts';
import { useApi } from '../data/api';
import { clearLocalDraft } from '../data/client';
import { StatusBlock } from '../components/ui';

const STATUS_LABEL: Record<ContentVersionStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待审核',
  APPROVED: '已公开',
  REJECTED: '未通过',
  HIDDEN: '已隐藏',
  WITHDRAWN: '已撤回',
};

const STATUS_CLASS: Record<ContentVersionStatus, string> = {
  DRAFT: 'badge muted',
  PENDING: 'badge warn',
  APPROVED: 'badge ok',
  REJECTED: 'badge danger',
  HIDDEN: 'badge danger',
  WITHDRAWN: 'badge muted',
};

const DELETE_TEXT =
  '注销后：立即撤销本机会话与本人公开分享，隐藏投稿与资料，相关票数即时重算；' +
  '随后自动清除账号的投稿、图片、清单与分享快照，并把显示名与电话清空。' +
  '去标识的账号 ID、举报状态与审计记录会保留供复核。此操作不可自助撤销，确定继续？';

function readFailure(e: unknown): { code: string | null; message: string } {
  if (typeof e === 'object' && e !== null) {
    const o = e as { code?: unknown; message?: unknown };
    return {
      code: typeof o.code === 'string' ? o.code : null,
      message: typeof o.message === 'string' && o.message ? o.message : '请求失败，请稍后重试',
    };
  }
  return { code: null, message: e instanceof Error ? e.message : '请求失败，请稍后重试' };
}

export function MePage() {
  const { api, user, ready, signOut } = useApi();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [reports, setReports] = useState<ReportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([api.mySubmissions(), api.myReports()]);
      setSubs(s);
      setReports(r);
    } catch (e) {
      const f = readFailure(e);
      setError(f.code ? `${f.message}（${f.code}）` : f.message);
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  async function destroy(): Promise<void> {
    if (!confirm(DELETE_TEXT)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.deleteAccount();
      setJob(r.deletion_job_id);
      if (user) clearLocalDraft(user.id);
      await signOut();
      setSubs(null);
      setReports(null);
    } catch (e) {
      // 只透传服务端结果：FORBIDDEN／UNAUTHORIZED 由后端判定
      const f = readFailure(e);
      setError(f.code ? `${f.message}（${f.code}）` : f.message);
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

  if (!user) {
    return (
      <div className="page page-narrow">
        <h1>我的</h1>
        {job ? (
          <div className="panel">
            <div className="alert ok">
              <div>
                <strong>注销请求已受理</strong>
                <p style={{ margin: '4px 0 8px' }}>删除任务编号 {job}，后台会自动继续完成清除；票数已按撤回处理重算。</p>
                <Link className="btn small" to="/map">
                  回到地图
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <StatusBlock
            kind="empty"
            message="登录后查看自己的投稿、纠错工单与账号设置。演示版使用预置的合成邀请账号。"
            action={
              <Link className="btn" to="/login?next=/me">
                内测登录
              </Link>
            }
          />
        )}
        {error && <div className="alert bad" role="alert">{error}</div>}
      </div>
    );
  }

  const canAdmin = user.roles.some((r) => r === 'moderator' || r === 'admin');

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>我的</h1>
        <div className="btn-row">
          <Link className="btn small ghost" to="/me/collections">
            我的地图
          </Link>
          <Link className="btn small plain" to="/submit">
            写一条实吃反馈
          </Link>
        </div>
      </div>

      {error && <div className="alert bad" role="alert">{error}</div>}
      {job && <div className="alert ok">注销请求已受理，删除任务编号 {job}。会话已撤销。</div>}

      <section className="panel">
        <h2>账号</h2>
        <div className="card-row">
          <strong>{user.display_name}</strong>
          <span className="badge">{user.id}</span>
          <span className="badge muted">合成账号 · is_test_data</span>
          {user.account_status === 'deleting' && <span className="badge warn">注销处理中</span>}
        </div>
        <dl className="facts">
          <div>
            <dt>角色</dt>
            <dd>{user.roles.join(' / ')}</dd>
          </div>
          <div>
            <dt>手机</dt>
            <dd>{user.phone_masked}</dd>
          </div>
        </dl>
        <p className="hint">
          角色只用于显示入口，真正的权限判定在每次请求时由服务端执行；改前端不能提权。
        </p>
        {canAdmin && (
          <div className="btn-row">
            <Link className="btn small" to="/admin">
              内容后台
            </Link>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>我的投稿（{subs ? subs.length : '…'}）</h2>
        {subs === null && !error ? (
          <StatusBlock kind="loading" message="正在读取投稿…" />
        ) : subs && subs.length === 0 ? (
          <StatusBlock
            kind="empty"
            message="还没有投稿记录。演示数据不会替你生成实吃，需要你真的吃过之后写第一条。"
            action={
              <Link className="btn small" to="/submit">
                去推荐好店
              </Link>
            }
          />
        ) : (
          <div className="list">
            {subs?.map((s) => (
              <article className="card" key={s.id}>
                <h3>
                  <Link to={`/restaurants/${s.restaurant_id}`}>{s.restaurant_name}</Link>
                </h3>
                <div className="card-row">
                  <span className="badge">{ATTITUDE_LABEL[s.attitude]}</span>
                  <span className={STATUS_CLASS[s.status]}>{STATUS_LABEL[s.status]}</span>
                  <span className="badge muted">第 {s.version} 版</span>
                  <span className="badge">实吃 {s.visited_date}</span>
                </div>
                <p className="card-dishes">{s.dish_names.length ? `推荐菜：${s.dish_names.join('、')}` : '未填写推荐菜'}</p>
                <p style={{ margin: '4px 0' }}>{s.reason}</p>
                <p className="hint" style={{ margin: 0 }}>
                  {DISCLOSURE_LABEL[s.disclosure]} · 图片 {s.media_ids.length} 张 · 投稿号 {s.id} · 提交 {s.created_at.slice(0, 10)}
                </p>
                {s.reject_reason && <p className="hint" style={{ margin: '4px 0 0' }}>未通过原因：{s.reject_reason}</p>}
                {s.pending_verify_reason && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>核验提示：{s.pending_verify_reason}</p>
                )}
              </article>
            ))}
          </div>
        )}
        {subs !== null && subs.length > 0 && (
          <p className="hint">
            待审核期间，该门店此前已通过的版本继续公开并计票；同一幂等键的重试不会产生新记录。
          </p>
        )}
      </section>

      <section className="panel">
        <h2>我的纠错与举报（{reports ? reports.length : '…'}）</h2>
        {reports === null && !error ? (
          <StatusBlock kind="loading" message="正在读取工单…" />
        ) : reports && reports.length === 0 ? (
          <p className="hint">还没有提交过工单。在门店页可以报告闭店、位置或信息有误，工单只触发人工复核。</p>
        ) : (
          <div className="list">
            {reports?.map((r) => (
              <article className="card" key={r.id}>
                <div className="card-row">
                  <span className="badge">{REPORT_KIND_LABEL[r.kind]}</span>
                  <span className={r.status === 'RESOLVED' ? 'badge ok' : r.status === 'DISMISSED' ? 'badge muted' : 'badge warn'}>
                    {REPORT_STATUS_LABEL[r.status]}
                  </span>
                  <span className="badge muted">工单 {r.id}</span>
                </div>
                <p className="card-dishes">
                  <Link to={`/restaurants/${r.restaurant_id}`}>门店 {r.restaurant_id}</Link> · 提交 {r.created_at.slice(0, 10)}
                </p>
                <p style={{ margin: '4px 0' }}>{r.detail}</p>
                <p className="hint" style={{ margin: 0 }}>
                  处理结果：{r.result_note ?? '暂无（仍待人工复核）'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h3>注销账号</h3>
        <p className="hint">
          会话与本人公开分享立即撤销，投稿与资料隐藏、票数即时重算；随后自动清除投稿、图片、清单与分享快照，并清空显示名与电话。
        </p>
        <div className="btn-row">
          <button className="btn danger" type="button" disabled={busy} onClick={() => void destroy()}>
            {busy ? '处理中…' : '申请注销账号'}
          </button>
        </div>
        <p className="hint">
          {api.mode === 'static'
            ? '当前为静态演示：注销只清除本机浏览器保存的数据。'
            : '注销请求会发送到后端并登记清除任务，服务重启后继续未完成的部分。'}
          本机的投稿草稿会立即删除。
        </p>
      </section>
    </div>
  );
}
