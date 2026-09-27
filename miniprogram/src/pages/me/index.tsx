/**
 * 我的地图（小程序 C 端）：登录状态、我的投稿、我的举报、我的清单、打卡记账。
 * 只搬运数据，不重算任何业务规则；后台入口按 me() 返回的 roles 显示，403 时页面提示角色不足。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button, Input, Textarea } from '@tarojs/components'
import {
  clearSession,
  collections,
  createCollection,
  deleteAccount,
  deleteDiningLog,
  logout,
  me,
  myCandidates,
  myDiningLogs,
  myReports,
  mySubmissions,
  type Collection,
  type DiningLogPage,
  type ReportTicket,
  type RestaurantCandidate,
  type SessionUser,
  type Submission,
} from '../../api'
import './index.scss'

export default function Me() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [reports, setReports] = useState<ReportTicket[]>([])
  const [cols, setCols] = useState<Collection[]>([])
  const [candidates, setCandidates] = useState<RestaurantCandidate[]>([])
  const [dining, setDining] = useState<DiningLogPage | null>(null)

  // 新建清单（内联表单）
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoaded(true)
    try {
      const u = await me()
      setUser(u)
      if (!u) {
        setSubmissions([])
        setReports([])
        setCols([])
        setCandidates([])
        setDining(null)
        return
      }
      const [s, r, c, cd, d] = await Promise.all([
        mySubmissions().catch(() => []),
        myReports().catch(() => []),
        collections().catch(() => []),
        myCandidates().catch(() => []),
        myDiningLogs().catch(() => null),
      ])
      setSubmissions(s)
      setReports(r)
      setCols(c)
      setCandidates(cd)
      setDining(d)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function doLogout() {
    try {
      await logout()
    } finally {
      clearSession()
      Taro.removeStorageSync('qw.user')
      setUser(null)
      setSubmissions([])
      setReports([])
      setCols([])
      setCandidates([])
      setDining(null)
      await Taro.showToast({ title: '已退出', icon: 'none' })
    }
  }

  async function doCreate() {
    if (newTitle.trim() === '') return
    setCreateBusy(true)
    setNotice(null)
    try {
      const c = await createCollection(newTitle.trim(), newDesc.trim() === '' ? null : newDesc.trim())
      setCreateOpen(false)
      setNewTitle('')
      setNewDesc('')
      setNotice(`清单「${c.title}」已创建，点它进入编辑与发布`)
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreateBusy(false)
    }
  }

  async function doDeleteAccount() {
    const ok = await Taro.showModal({
      title: '注销账号',
      content: '注销会立即撤销你的会话与已公开分享、隐藏你提交的内容并退出计票，且不可撤销。确定注销？',
      confirmText: '注销',
      confirmColor: '#a3231d',
    })
    if (!ok.confirm) return
    try {
      const r = await deleteAccount()
      clearSession()
      Taro.removeStorageSync('qw.user')
      setUser(null)
      setSubmissions([])
      setReports([])
      setCols([])
      setCandidates([])
      setDining(null)
      await Taro.showToast({ title: `已提交注销（${r.deletion_job_id}）`, icon: 'none' })
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '注销失败')
    }
  }

  const canAdmin = user !== null && (user.roles.includes('moderator') || user.roles.includes('admin'))

  const statusLabel = (s: string): string =>
    s === 'PENDING' ? '待审核' : s === 'APPROVED' ? '已公开' : s === 'REJECTED' ? '未通过' : s === 'HIDDEN' ? '已隐藏' : s === 'OPEN' ? '待处理' : s === 'IN_REVIEW' ? '复核中' : s === 'RESOLVED' ? '已处理' : s === 'DISMISSED' ? '已驳回' : s

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">我的地图</Text>
        <Text className="sub">
          {user ? `${user.display_name}（${user.id}）· 角色 ${user.roles.join('/')}` : '未登录：登录后可投稿、收藏、举报'}
        </Text>
      </View>

      <View className="btn-row">
        {user ? (
          <Button className="btn-plain" onClick={() => void doLogout()}>
            退出登录
          </Button>
        ) : (
          <Button className="btn-primary" onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
            登录
          </Button>
        )}
      </View>

      {canAdmin && (
        <View className="btn-row">
          <Button className="btn-primary" onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}>
            内容后台（审核）
          </Button>
        </View>
      )}

      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
        </View>
      )}

      {user && (
        <>
          <View className="panel">
            <Text className="label">我的投稿（{submissions.length}）</Text>
            {submissions.map((s) => (
              <View className="row" key={s.id}>
                <Text className="row-main">
                  {s.id} · {s.restaurant_name}
                </Text>
                <Text className="row-sub">
                  第 {s.version} 版 · {statusLabel(s.status)}
                </Text>
              </View>
            ))}
            {submissions.length === 0 && <Text className="hint">还没有投稿。</Text>}
          </View>

          <View className="panel">
            <Text className="label">我的建店申请（{candidates.length}）</Text>
            {candidates.map((c) => (
              <View className="row" key={c.id}>
                <Text className="row-main">
                  {c.id} · {c.name}
                </Text>
                <Text className="row-sub">
                  {c.status === 'PENDING' ? '待核验' : c.status === 'VERIFIED' ? '已核验' : c.status === 'MERGED' ? '已并入' : '已驳回'}
                  {c.restaurant_id ? ` · 门店 ${c.restaurant_id}` : ''}
                </Text>
              </View>
            ))}
            {candidates.length === 0 && <Text className="hint">还没有建店申请。</Text>}
          </View>

          <View className="panel">
            <Text className="label">我的举报（{reports.length}）</Text>
            {reports.map((r) => (
              <View className="row" key={r.id}>
                <Text className="row-main">
                  {r.id} · {statusLabel(r.status)}
                </Text>
                {r.result_note && <Text className="row-sub">处理结果：{r.result_note}</Text>}
              </View>
            ))}
            {reports.length === 0 && <Text className="hint">还没有举报工单。</Text>}
          </View>

          <View className="panel">
            <Text className="label">美食打卡 · 记账{dining ? `（${dining.stats.month}：${dining.stats.count} 次 · ¥${(dining.stats.total_fen / 100).toFixed(2)}）` : ''}</Text>
            {dining && dining.logs.length === 0 && <Text className="hint">还没有打卡记录。在门店详情页点「打卡」。</Text>}
            {dining?.logs.map((l) => (
              <View className="row" key={l.id}>
                <Text className="row-main">
                  {l.visited_date} · {l.restaurant_name}
                  {l.amount_fen !== null ? ` · ¥${(l.amount_fen / 100).toFixed(2)}` : ''}
                </Text>
                {l.note ? <Text className="row-sub">{l.note}</Text> : null}
                <Button
                  className="btn-plain"
                  onClick={() =>
                    void (async () => {
                      await deleteDiningLog(l.id)
                      await load()
                    })()
                  }
                >
                  删除
                </Button>
              </View>
            ))}
            <Text className="hint">打卡与记账仅本人可见，不参与公开推荐与票数。</Text>
          </View>

          <View className="panel">
            <Text className="label">我的清单（{cols.length}）</Text>
            {cols.map((c) => (
              <View className="row" key={c.id} onClick={() => Taro.navigateTo({ url: `/pages/collection-edit/index?id=${encodeURIComponent(c.id)}` })}>
                <Text className="row-main">
                  {c.title}
                  {c.system_kind ? ' · 系统清单' : ''}
                  {c.publication_status === 'PUBLISHED' ? ' · 已公开' : c.publication_status === 'PENDING_REVIEW' ? ' · 发布待审' : ''}
                </Text>
                <Text className="row-sub">{c.items.length} 家 · 点击编辑 / 发布 / 分享</Text>
              </View>
            ))}
            {cols.length === 0 && <Text className="hint">还没有清单（收藏后自动建立）。</Text>}
            <View className="btn-row">
              <Button className="btn-plain" onClick={() => setCreateOpen(!createOpen)}>
                {createOpen ? '收起新建' : '新建清单'}
              </Button>
            </View>
            {createOpen && (
              <View className="field">
                <Text className="label">清单标题</Text>
                <Input value={newTitle} onInput={(e) => setNewTitle(e.detail.value)} placeholder="例如：望京贵州菜一日路线" />
                <View className="field">
                  <Text className="label">说明（可留空）</Text>
                  <Textarea value={newDesc} onInput={(e) => setNewDesc(e.detail.value)} placeholder="这份清单给谁看、想表达什么" />
                </View>
                <Button className="btn-primary" disabled={createBusy || newTitle.trim() === ''} onClick={() => void doCreate()}>
                  {createBusy ? '创建中…' : '创建'}
                </Button>
                <Text className="hint">自建清单可编辑、可发布分享；系统清单（想吃/吃过/私藏）只能收藏，不能发布。</Text>
              </View>
            )}
          </View>
        </>
      )}

      {user && (
        <View className="panel">
          <Text className="label">账号</Text>
          <View className="btn-row">
            <Button
              className="btn-plain"
              onClick={() => Taro.navigateTo({ url: '/pages/legal/index?kind=privacy' })}
            >
              隐私说明
            </Button>
            <Button
              className="btn-plain"
              onClick={() => Taro.navigateTo({ url: '/pages/legal/index?kind=terms' })}
            >
              用户条款
            </Button>
          </View>
          <Button className="btn-plain danger" onClick={() => void doDeleteAccount()}>
            注销账号
          </Button>
          <Text className="hint">注销会立即撤销本机会话与本人分享、隐藏 UGC、退出计票，不可撤销。</Text>
        </View>
      )}

      {user?.is_test_data && (
        <View className="footer-note">
          <Text className="hint">演示版本：门店、图片、实吃与票数均为合成测试数据。</Text>
        </View>
      )}
    </View>
  )
}
