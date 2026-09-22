/** 我的清单：系统清单 + 自建清单。页面只展示接口返回的内容，规则由引擎/后端判定。 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Collection, PublicationStatus, SystemCollectionKind } from '@qianwei/contracts';
import { useApi } from '../data/api';
import { StatusBlock } from '../components/ui';

const PUB_LABEL: Record<PublicationStatus, string> = {
  PRIVATE: '未发布',
  PENDING_REVIEW: '发布待审',
  PUBLISHED: '已公开',
  REVOKED: '已撤销',
};

const SYSTEM_HINT: Record<SystemCollectionKind, string> = {
  want: '系统清单只是私人分类：想吃与吃过互斥，不会公开，也不能删除。',
  visited: '系统清单只是私人分类：标记吃过不产生公开实吃，也不计票，不能删除。',
  private_stash: '系统清单只是私人分类：只对自己可见，不能发布，也不能删除。',
};

/** 后端错误结构（ClientError / ApiError 同形）：消息原样显示，不自行改写。 */
interface ErrLike {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

function shareUrl(token: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}s/${token}`;
}

export function CollectionsPage() {
  const { api, user, ready } = useApi();
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string> | null>(null);
  const [share, setShare] = useState<Record<string, 'copied' | 'manual'>>({});

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setCols(await api.collections());
      setError(null);
    } catch (e) {
      setError((e as ErrLike).message ?? '清单读取失败');
    } finally {
      setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  async function create() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setFieldErr(null);
    try {
      const c = await api.createCollection(title, desc.trim() ? desc.trim() : null);
      setTitle('');
      setDesc('');
      setNotice(`已创建「${c.title}」，初始状态 ${PUB_LABEL[c.publication_status]}：只有你本人能读到。`);
      setCols(await api.collections());
    } catch (e) {
      const err = e as ErrLike;
      setError(err.message ?? '创建失败');
      setFieldErr(err.fieldErrors ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Collection) {
    if (!confirm(`删除「${c.title}」会同时撤销该清单的全部公开链接，旧链接永久失效且不会恢复。清单里的门店本身不受影响。确定删除？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteCollection(c.id);
      setNotice(`「${c.title}」已删除，它的公开链接同时失效。`);
      setCols(await api.collections());
    } catch (e) {
      setError((e as ErrLike).message ?? '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    if (!navigator.clipboard) {
      setShare((s) => ({ ...s, [token]: 'manual' }));
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setShare((s) => ({ ...s, [token]: 'copied' }));
    } catch {
      setShare((s) => ({ ...s, [token]: 'manual' }));
    }
  }

  if (!ready) {
    return (
      <div className="page page-narrow">
        <StatusBlock kind="loading" message="正在确认内测账号…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page page-narrow">
        <StatusBlock
          kind="empty"
          message="清单是个人的私密数据，登录后才能读取你自己的系统清单与自建清单。"
          action={
            <Link className="btn small" to="/login?next=/me/collections">
              内测登录
            </Link>
          }
        />
      </div>
    );
  }

  if (cols === null) {
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

  const custom = cols.filter((c) => c.kind === 'custom');
  const system = cols.filter((c) => c.kind === 'system');

  return (
    <div className="page page-narrow">
      <div className="page-head">
        <h1>我的清单</h1>
        <Link className="btn small ghost" to="/map">
          去地图找店
        </Link>
      </div>
      <p className="hint">
        清单分两类：系统清单（想吃 / 吃过 / 私藏）与自建清单。系统清单只是私人分类，不能发布也不能删除；自建清单默认私密，
        只有在编辑页显式提交发布申请、并经人工审核后才会生成公开链接。
      </p>

      {error && <div className="alert bad">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      <section className="panel">
        <h2>新建清单</h2>
        <label className="field">
          <span className="label">标题（必填）</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：贵州酸汤爱好者路线" />
          {fieldErr?.['title'] && <span className="err">{fieldErr['title']}</span>}
        </label>
        <label className="field">
          <span className="label">说明（可选）</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="一句话说明这份清单的用途" />
        </label>
        <div className="btn-row">
          <button className="btn small" type="button" disabled={busy || title.trim() === ''} onClick={() => void create()}>
            创建清单
          </button>
        </div>
        <p className="hint">新建的清单是私密的：初始状态未发布，只有你本人能读到，别人拿到地址也看不到。</p>
      </section>

      <section className="panel">
        <h2>自建清单（{custom.length}）</h2>
        {custom.length === 0 ? (
          <StatusBlock
            kind="empty"
            message="还没有自建清单。先去地图挑几家店，再回来创建清单并加入门店；本页不展示任何示例数据。"
            action={
              <Link className="btn small" to="/map">
                逛地图
              </Link>
            }
          />
        ) : (
          <div className="list">
            {custom.map((c) => {
              const token = c.active_token;
              return (
              <article className="card" key={c.id}>
                <div className="card-row">
                  <h3>{c.title}</h3>
                  <span className="badges">
                    <span className="badge">自建清单</span>
                    <span className={c.publication_status === 'PUBLISHED' ? 'badge ok' : c.publication_status === 'REVOKED' ? 'badge danger' : 'badge'}>
                      {PUB_LABEL[c.publication_status]}
                    </span>
                  </span>
                </div>
                <p className="card-dishes">{c.description ?? '没有填写说明。'}</p>
                <p className="card-meta">
                  {c.items.length} 家门店 · 草稿第 {c.version} 版 · 发布代数 {c.publication_generation}
                </p>
                <div className="card-actions">
                  <Link className="btn small" to={`/me/collections/${c.id}`}>
                    编辑顺序与笔记
                  </Link>
                  <Link className="btn small ghost" to={`/me/collections/${c.id}#publish`}>
                    发布与分享
                  </Link>
                  {token && (
                    <>
                      <Link className="btn small plain" to={`/s/${token}`}>
                        打开公开链接
                      </Link>
                      <button className="btn small plain" type="button" onClick={() => void copy(token)}>
                        复制链接
                      </button>
                    </>
                  )}
                  <button className="btn small danger" type="button" disabled={busy} onClick={() => void remove(c)}>
                    删除清单
                  </button>
                </div>
                {token && share[token] === 'copied' && <div className="alert ok">分享链接已复制到剪贴板。</div>}
                {token && share[token] === 'manual' && (
                  <div className="alert">
                    浏览器拒绝剪贴板访问，复制失败。请手动选中下面的完整地址：
                    <code style={{ display: 'block', marginTop: 4, wordBreak: 'break-all' }}>{shareUrl(token)}</code>
                  </div>
                )}
                {c.publication_status !== 'PUBLISHED' && (
                  <p className="hint">
                    当前公开状态为「{PUB_LABEL[c.publication_status]}」
                    {token ? '：上面的地址现在可能已失效，只有审核通过的快照才能打开。' : '：还没有公开链接。'}
                  </p>
                )}
              </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>系统清单（{system.length}）</h2>
        <p className="hint">系统清单只是私人分类，不能发布，也不能删除；这里的门店数由接口返回。</p>
        <div className="list">
          {system.map((c) => (
            <article className="card" key={c.id}>
              <div className="card-row">
                <h3>{c.title}</h3>
                <span className="badges">
                  <span className="badge muted">系统清单</span>
                  <span className="badge">不可发布</span>
                  <span className="badge">不可删除</span>
                </span>
              </div>
              <p className="card-meta">{c.items.length} 家门店</p>
              <p className="hint">{c.system_kind ? SYSTEM_HINT[c.system_kind] : '系统清单只是私人分类。'}</p>
              <div className="card-actions">
                {c.items.length > 0 ? (
                  <Link className="btn small plain" to={`/me/collections/${c.id}`}>
                    整理笔记与顺序
                  </Link>
                ) : (
                  <Link className="btn small plain" to="/map">
                    去地图添加门店
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
