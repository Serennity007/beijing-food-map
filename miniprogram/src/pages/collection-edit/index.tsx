/**
 * 清单编辑（小程序 C 端）：加店/移除/备注/顺序 + 显式发布为不可变快照 + 撤回 + 删除。
 * 规则全部由接口判定，页面不推算版本也不补数据；版本号只取接口返回的新记录。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button, Input, Textarea } from '@tarojs/components'
import type { Collection, CollectionItemRecord, PublicationStatus, Restaurant } from '@qianwei/contracts'
import {
  collections,
  deleteCollection,
  fetchDetail,
  requestPublication,
  searchStores,
  unpublish,
  updateCollectionItem,
} from '../../api'
import './index.scss'

const PUB_LABEL: Record<PublicationStatus, string> = {
  PRIVATE: '未发布',
  PENDING_REVIEW: '发布待审',
  PUBLISHED: '已公开',
  REVOKED: '已撤销',
}

function sortedItems(c: Collection): CollectionItemRecord[] {
  return [...c.items].sort((a, b) => a.position - b.position)
}

export default function CollectionEdit() {
  const { params } = useRouter()
  const id = params.id ?? ''
  const [col, setCol] = useState<Collection | null>(null)
  const [view, setView] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shops, setShops] = useState<Record<string, Restaurant>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Restaurant[] | null>(null)
  const searchSeq = useRef(0)

  const loadShops = useCallback(async (items: CollectionItemRecord[]) => {
    const ids = Array.from(new Set(items.map((i) => i.restaurant_id)))
    const res = await Promise.all(
      ids.map(async (rid) => {
        try {
          return { rid, r: await fetchDetail(rid) }
        } catch {
          return { rid, r: null }
        }
      }),
    )
    const map: Record<string, Restaurant> = {}
    for (const e of res) if (e.r) map[e.rid] = e.r
    setShops(map)
  }, [])

  const load = useCallback(async () => {
    setView('loading')
    setError(null)
    try {
      const list = await collections()
      const found = list.find((c) => c.id === id)
      if (!found) {
        setCol(null)
        setView('notfound')
        return
      }
      setCol(found)
      setView('ok')
      await loadShops(found.items)
    } catch (e) {
      const code = e instanceof Error && 'code' in e ? (e as { code?: string }).code : undefined
      if (code === 'NOT_FOUND' || code === 'FORBIDDEN') {
        setCol(null)
        setView('notfound')
      } else {
        setError((e as Error).message ?? '清单读取失败')
        setView('error')
      }
    }
  }, [id, loadShops])

  useEffect(() => {
    void load()
  }, [load])

  // 搜索平台收录门店（300ms 防抖）
  useEffect(() => {
    const seq = ++searchSeq.current
    const t = term.trim()
    if (!t) {
      setHits(null)
      return
    }
    const timer = setTimeout(() => {
      void searchStores(t)
        .then((r) => {
          if (seq === searchSeq.current) setHits(r.own)
        })
        .catch(() => {
          if (seq === searchSeq.current) setHits(null)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  async function patch(rid: string, p: { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number }, done?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fresh = await updateCollectionItem(id, rid, p)
      setCol(fresh)
      await loadShops(fresh.items)
      if (done) setNotice(done)
    } catch (e) {
      setError((e as Error).message ?? '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!col) return
    const ordered = sortedItems(col)
    const a = ordered[index]
    const b = ordered[index + dir]
    if (!a || !b) return
    setBusy(true)
    setError(null)
    try {
      let fresh = await updateCollectionItem(id, a.restaurant_id, { position: b.position })
      fresh = await updateCollectionItem(id, b.restaurant_id, { position: a.position })
      setCol(fresh)
      setNotice('顺序已更新')
    } catch (e) {
      setError((e as Error).message ?? '排序失败')
    } finally {
      setBusy(false)
    }
  }

  function nameOf(rid: string): string {
    const s = shops[rid]
    return s ? `「${s.name}${s.branch ? `（${s.branch}）` : ''}」` : `门店 ${rid}`
  }

  async function removeItem(rid: string) {
    const ok = await Taro.showModal({ title: '移除门店', content: `从清单移除 ${nameOf(rid)}？只影响这份清单，不删除门店，也不影响已发布的快照。`, confirmColor: '#a3231d' })
    if (!ok.confirm) return
    await patch(rid, { remove: true }, '已从清单移除。')
  }

  async function addItem(rid: string) {
    await patch(rid, {}, '已加入清单末尾。')
  }

  async function publish() {
    if (!col) return
    setBusy(true)
    setError(null)
    try {
      const ids = sortedItems(col)
        .filter((i) => selected[i.restaurant_id] ?? true)
        .map((i) => i.restaurant_id)
      const r = await requestPublication(id, ids)
      setNotice(`发布申请已受理：编号 ${r.id}，状态 ${r.status}，快照代数 ${r.generation}。等待人工审核。`)
      await load()
    } catch (e) {
      setError((e as Error).message ?? '发布申请提交失败')
    } finally {
      setBusy(false)
    }
  }

  async function doUnpublish() {
    const ok = await Taro.showModal({
      title: '撤销分享',
      content: '撤销后当前公开链接立即永久失效，旧链接不会恢复；再次公开需要重新提交发布申请。确定撤销？',
      confirmColor: '#a3231d',
    })
    if (!ok.confirm) return
    setBusy(true)
    setError(null)
    try {
      const fresh = await unpublish(id)
      setCol(fresh)
      setNotice('已撤销公开，旧链接永久失效。')
    } catch (e) {
      setError((e as Error).message ?? '撤销失败')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    const ok = await Taro.showModal({
      title: '删除清单',
      content: `删除清单「${col?.title ?? id}」？已发布的快照也会一并失效，不可撤销。`,
      confirmColor: '#a3231d',
    })
    if (!ok.confirm) return
    setBusy(true)
    setError(null)
    try {
      await deleteCollection(id)
      await Taro.showToast({ title: '清单已删除', icon: 'none' })
      Taro.navigateBack()
    } catch (e) {
      setError((e as Error).message ?? '删除失败')
    } finally {
      setBusy(false)
    }
  }

  if (view === 'notfound') {
    return (
      <View className="page">
        <View className="status bad">
          <Text>清单不存在、不属于当前账号，或已被删除。</Text>
        </View>
        <Button className="btn" onClick={() => Taro.navigateBack()}>
          返回
        </Button>
      </View>
    )
  }

  if (view === 'loading' || col === null) {
    return (
      <View className="page">
        {error ? (
          <View className="status bad">
            <Text>{error}</Text>
          </View>
        ) : (
          <View className="status">
            <Text>正在读取清单…</Text>
          </View>
        )}
        {error && (
          <Button className="btn" onClick={() => void load()}>
            重试
          </Button>
        )}
      </View>
    )
  }

  const ordered = sortedItems(col)
  const isSystem = col.kind === 'system'

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">{col.title}</Text>
        <Text className="sub">{col.description ?? '没有填写说明。'}</Text>
        <View className="badge-row">
          <Text className="badge muted">{isSystem ? '系统清单' : '自建清单'}</Text>
          <Text className={col.publication_status === 'PUBLISHED' ? 'badge ok' : col.publication_status === 'REVOKED' ? 'badge danger' : 'badge warn'}>
            {PUB_LABEL[col.publication_status]}
          </Text>
        </View>
        <Text className="hint">
          草稿第 {col.version} 版 · 发布代数 {col.publication_generation} · 共 {ordered.length} 家门店
        </Text>
      </View>

      {error && (
        <View className="alert bad">
          <Text>{error}</Text>
        </View>
      )}
      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
        </View>
      )}

      <View className="panel">
        <Text className="label">添加门店</Text>
        <Input value={term} onInput={(e) => setTerm(e.detail.value)} placeholder="输入店名、菜品或地址关键词" />
        {term.trim() !== '' && hits && hits.length === 0 && (
          <Text className="hint">没有匹配的平台收录门店。清单只能加入已收录门店，本页不创建新门店。</Text>
        )}
        {hits && hits.length > 0 && (
          <View className="list">
            {hits.slice(0, 6).map((r) => {
              const already = col.items.some((i) => i.restaurant_id === r.id)
              return (
                <View className="card" key={r.id}>
                  <Text className="card-name">
                    {r.name}
                    {r.branch ? `（${r.branch}）` : ''}
                  </Text>
                  <Text className="card-meta">{r.address}</Text>
                  {already ? (
                    <Text className="badge muted">已在清单中</Text>
                  ) : (
                    <Button className="btn-plain" disabled={busy} onClick={() => void addItem(r.id)}>
                      加入清单
                    </Button>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>

      <View className="panel">
        <Text className="label">条目（{ordered.length}）：顺序与笔记</Text>
        {ordered.length === 0 && <Text className="hint">这份清单还没有门店，因此也无法发布。</Text>}
        {ordered.map((it, idx) => {
          const shop = shops[it.restaurant_id]
          const draft = drafts[it.restaurant_id] ?? it.note ?? ''
          const dirty = draft !== (it.note ?? '')
          return (
            <View className="card" key={it.restaurant_id}>
              <Text className="card-name">
                {idx + 1}. {shop ? shop.name : `门店 ${it.restaurant_id}`}
                {shop?.branch ? `（${shop.branch}）` : ''}
              </Text>
              <Text className="card-meta">position {it.position}</Text>
              <View className="field">
                <Text className="label">笔记（默认私密）</Text>
                <Textarea
                  value={draft}
                  onInput={(e) => setDrafts((cur) => ({ ...cur, [it.restaurant_id]: e.detail.value }))}
                  placeholder="例如：酸汤锅底建议两人份，周末要等位。"
                />
              </View>
              <View className="btn-row">
                <Button className="btn-plain" disabled={busy || !dirty} onClick={() => void patch(it.restaurant_id, { note: draft }, '笔记已保存（私密草稿，未影响已发布快照）。')}>
                  保存
                </Button>
                <Button
                  className={it.note_shareable ? 'btn-primary' : 'btn-plain'}
                  disabled={busy}
                  onClick={() => void patch(it.restaurant_id, { note_shareable: !it.note_shareable }, '笔记公开权限已更新。')}
                >
                  {it.note_shareable ? '笔记可进快照' : '笔记私密'}
                </Button>
                <Button className="btn-plain" disabled={busy || idx === 0} onClick={() => void move(idx, -1)}>
                  上移
                </Button>
                <Button className="btn-plain" disabled={busy || idx === ordered.length - 1} onClick={() => void move(idx, 1)}>
                  下移
                </Button>
                <Button className="btn-plain" disabled={busy} onClick={() => void removeItem(it.restaurant_id)}>
                  移除
                </Button>
              </View>
            </View>
          )
        })}
      </View>

      {isSystem ? (
        <View className="panel">
          <Text className="label">发布与分享</Text>
          <Text className="hint">系统清单只是私人分类：接口不允许直接发布，也不允许删除。要公开分享请先新建自建清单。</Text>
        </View>
      ) : (
        <View className="panel">
          <Text className="label">发布与分享</Text>
          <View className="btn-row">
            <Button className="btn-plain" disabled={busy} onClick={() => setSelected(Object.fromEntries(ordered.map((i) => [i.restaurant_id, true])))}>
              全选
            </Button>
            <Button className="btn-plain" disabled={busy} onClick={() => setSelected(Object.fromEntries(ordered.map((i) => [i.restaurant_id, false])))}>
              全不选
            </Button>
          </View>
          <Text className="hint">
            已选 {ordered.filter((i) => selected[i.restaurant_id] ?? true).length} / {ordered.length}，默认全选
          </Text>
          {ordered.map((it, idx) => (
            <View className="row" key={it.restaurant_id} onClick={() => setSelected((s) => ({ ...s, [it.restaurant_id]: !(s[it.restaurant_id] ?? true) }))}>
              <Text className="row-main">
                {selected[it.restaurant_id] ?? true ? '✓ ' : '○ '}
                {idx + 1}. {nameOf(it.restaurant_id)}
                {it.note_shareable ? '（含笔记）' : it.note ? '（笔记不公开）' : ''}
              </Text>
            </View>
          ))}
          <Text className="hint">公开后任何拿到链接的人都能看到；快照不可变；撤回后旧链接永久失效，不会恢复。</Text>
          <View className="btn-row">
            <Button className="btn-primary" disabled={busy || ordered.length === 0} onClick={() => void publish()}>
              提交发布
            </Button>
            {col.publication_status === 'PUBLISHED' && (
              <Button className="btn-plain" disabled={busy} onClick={() => void doUnpublish()}>
                撤销分享
              </Button>
            )}
          </View>
          {col.publication_status === 'PUBLISHED' && col.active_token && (
            <View className="alert ok">
              <Text>已公开，生效令牌 {col.active_token}</Text>
              <Button
                className="btn-plain"
                disabled={busy}
                onClick={() => Taro.navigateTo({ url: `/pages/share/index?token=${encodeURIComponent(col.active_token ?? '')}` })}
              >
                预览公开页
              </Button>
            </View>
          )}
          {col.publication_status === 'PENDING_REVIEW' && <Text className="hint">有一份发布申请正在审核中，通过后才会生成新的公开链接。</Text>}
          <View className="btn-row">
            <Button className="btn-plain" disabled={busy} onClick={() => void doDelete()}>
              删除清单
            </Button>
          </View>
        </View>
      )}

      <View className="footer-note">
        <Text className="hint">演示版本：门店、图片与实吃记录均为合成测试数据。</Text>
      </View>
    </View>
  )
}
