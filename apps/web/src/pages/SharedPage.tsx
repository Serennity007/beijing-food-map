/** 公开快照页：只读展示接口返回的不可变快照；错误一律不区分「不存在」与「已撤销」。 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SharedCollectionSnapshot } from '@qianwei/contracts';
import { useApi } from '../data/api';
import { CuisineBadges, StatusBlock } from '../components/ui';

export function SharedPage() {
  const { api, demoBadge } = useApi();
  const { token = '' } = useParams();
  const [snap, setSnap] = useState<SharedCollectionSnapshot | null>(null);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const s = await api.sharedSnapshot(token);
      setSnap(s);
      const ids = Array.from(new Set(s.items.flatMap((i) => i.media_ids)));
      setMedia(ids.length ? await api.mediaUrls(ids) : {});
    } catch {
      // 引擎与后端对缺失/已撤销都返回 NOT_FOUND；这里不区分，也不复述内部原因
      setSnap(null);
      setMedia({});
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page page-narrow">
        <StatusBlock kind="loading" message="正在读取分享快照…" />
      </div>
    );
  }

  if (failed || snap === null) {
    return (
      <div className="page page-narrow">
        <StatusBlock
          kind="error"
          message="链接无效或已撤销。"
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
  }

  return (
    <div className="page page-narrow">
      <section className="shared-hero">
        <div className="card-row">
          <h1>{snap.title}</h1>
          <span className="badges">
            <span className="badge">演示快照</span>
            <span className="badge muted">{demoBadge}</span>
          </span>
        </div>
        {snap.description && <p className="card-dishes">{snap.description}</p>}
        <p className="card-meta">
          作者 {snap.author_display_name} · 发布于 {snap.published_at} · 共 {snap.items.length} 家门店
        </p>
        <p className="hint">这是发布当时的不可变快照：作者之后编辑私密草稿不会改变本页内容。</p>
      </section>

      {snap.items.length === 0 ? (
        <StatusBlock
          kind="empty"
          message="这份快照里没有可显示的门店：门店可能在快照发布后被隐藏、撤回或合并。"
          action={
            <Link className="btn small" to="/map">
              回到地图
            </Link>
          }
        />
      ) : (
        <section className="panel">
          <h2>清单内容（{snap.items.length}）</h2>
          <ol className="pin-list">
            {snap.items.map((it) => (
              <li key={it.restaurant_id}>
                <div style={{ width: '100%' }}>
                  <div className="card-row">
                    <strong>
                      {it.name}
                      {it.branch ? <small>（{it.branch}）</small> : null}
                    </strong>
                    <CuisineBadges cuisines={it.cuisines} />
                    {it.pending_verification && <span className="badge warn">作者个人推荐，平台尚未验证</span>}
                  </div>
                  {it.pending_verification && (
                    <p className="hint" style={{ margin: '2px 0' }}>
                      这个标识只说明该店尚未满足平台默认好店图层的条件，不改变平台的推荐判定规则，也不代表已核实。
                    </p>
                  )}
                  {it.note && <p style={{ margin: '4px 0' }}>{it.note}</p>}
                  {it.media_ids.length > 0 && (
                    <div className="thumbs">
                      {it.media_ids.map((m) =>
                        media[m] ? (
                          <img
                            className="thumb"
                            key={m}
                            src={media[m]}
                            alt={`清单图片 ${m}（测试图片，非真实门店）`}
                            loading="lazy"
                          />
                        ) : (
                          <span className="thumb" key={m} title="未通过审核的图片不出现在公开快照中" />
                        ),
                      )}
                    </div>
                  )}
                  <div className="card-actions" style={{ marginTop: 6 }}>
                    <Link className="btn small" to={`/map?focus=${it.restaurant_id}`}>
                      在地图中查看
                    </Link>
                    <Link className="btn small plain" to={`/restaurants/${it.restaurant_id}`}>
                      详情
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="hint">
        生产环境本页会以 no-store 响应头提供，避免权限撤销之后仍被浏览器或 CDN 缓存命中；当前
        {api.mode === 'static' ? '静态演示中，快照直接读取本机浏览器内的领域引擎数据。' : '演示后端返回同一份快照数据。'}
        门店、图片与笔记均为合成测试数据。
      </p>
      <div className="btn-row">
        <Link className="btn small ghost" to="/map">
          我也想去逛地图
        </Link>
        <Link className="btn small plain" to="/me/collections">
          管理我的清单
        </Link>
      </div>
    </div>
  );
}
