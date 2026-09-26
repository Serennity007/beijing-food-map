/**
 * 我的地图（小程序 C 端）：登录状态、我的投稿、我的举报、我的清单。
 * 只读列表 + 登录/退出；后台管理、清单发布与注销等高危操作留在 Web 端。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import {
  clearSession,
  collections,
  deleteDiningLog,
  logout,
  me,
  myCandidates,
  myDiningLogs,
  myReports,
  mySubmissions,
  type DiningLogPage,
  type Collection,
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
            内测登录
          </Button>
        )}
      </View>

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
                  {c.status === 'PENDING' ? '待核验' : c.status === 'APPROVED' ? '已核验' : '已驳回'}
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
              <View className="row" key={c.id}>
                <Text className="row-main">
                  {c.title}
                  {c.system_kind ? ' · 系统清单' : ''}
                </Text>
                <Text className="row-sub">{c.items.length} 家</Text>
              </View>
            ))}
            {cols.length === 0 && <Text className="hint">还没有清单（收藏后自动建立）。</Text>}
            <Text className="hint">清单的编辑与发布分享留在 Web 端操作。</Text>
          </View>
        </>
      )}

      <View className="footer-note">
        <Text className="hint">后台审核、清单发布/撤销、账号注销等操作请使用 Web 版（安全边界更高）。</Text>
      </View>
    </View>
  )
}
