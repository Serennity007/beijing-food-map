/**
 * 门店详情（M1 只读）：速览优先，完整依据给出一句话口径。
 * 规则判定全部来自后端（同一套 contracts 引擎），页面只搬运。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button, Input, Picker } from '@tarojs/components'
import {
  ATTITUDE_LABEL,
  CUISINE_LABEL,
  type RestaurantDetail,
} from '@qianwei/contracts'
import {
  collections,
  createDiningLog,
  createReport,
  fetchDetail,
  me,
  today,
  toggleSystemItem,
  withdrawFeedback,
} from '../../api'
import './index.scss'

export default function Detail() {
  const { params } = useRouter()
  const id = params.id ?? ''
  const [d, setD] = useState<RestaurantDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [favKinds, setFavKinds] = useState<string[]>([])
  const [favBusy, setFavBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportKind, setReportKind] = useState('wrong_info')
  const [reportDetail, setReportDetail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinDate, setCheckinDate] = useState('')
  const [checkinAmount, setCheckinAmount] = useState('')
  const [checkinNote, setCheckinNote] = useState('')
  const [todayMax, setTodayMax] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  const feedbackStatusLabel = (s: string): string =>
    s === 'PENDING' ? '待审核' : s === 'APPROVED' ? '已公开' : s === 'REJECTED' ? '未通过' : s === 'HIDDEN' ? '已隐藏' : s === 'WITHDRAWN' ? '已撤回' : s === 'DRAFT' ? '草稿' : s

  const load = useCallback(async () => {
    setError(null)
    try {
      setD(await fetchDetail(id))
    } catch (e) {
      setError((e as Error).message || '读取失败')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void today()
      .then((t) => setTodayMax(t))
      .catch(() => setTodayMax(''))
  }, [])

  // 登录态与收藏标记
  useEffect(() => {
    if (!d) return
    void (async () => {
      try {
        const u = await me()
        setLoggedIn(u !== null)
        if (u) {
          const cols = await collections()
          const kinds: string[] = []
          for (const c of cols) {
            if (c.system_kind && c.items.some((i) => i.restaurant_id === d.id)) kinds.push(c.system_kind)
          }
          setFavKinds(kinds)
        } else {
          setFavKinds([])
        }
      } catch {
        setLoggedIn(false)
      }
    })()
  }, [d])

  async function toggleFav(kind: string): Promise<void> {
    if (!d) return
    setFavBusy(true)
    try {
      const on = !favKinds.includes(kind)
      const cols = await toggleSystemItem(d.id, kind, on)
      const kinds: string[] = []
      for (const c of cols) {
        if (c.system_kind && c.items.some((i) => i.restaurant_id === d.id)) kinds.push(c.system_kind)
      }
      setFavKinds(kinds)
      setNotice(on ? '已加入' : '已移除')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '操作失败')
    } finally {
      setFavBusy(false)
    }
  }

  async function sendReport(): Promise<void> {
    if (!d) return
    try {
      const t = await createReport({ restaurant_id: d.id, kind: reportKind, detail: reportDetail.trim() })
      setReportOpen(false)
      setReportDetail('')
      setNotice(`工单 ${t.id}（${t.status}）已记入复核队列；同一问题重复提交不会新增工单`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '提交失败')
    }
  }

  async function sendCheckin(): Promise<void> {
    if (!d) return
    try {
      const log = await createDiningLog({
        restaurant_id: d.id,
        visited_date: checkinDate,
        amount_yuan: checkinAmount.trim() === '' ? null : Number(checkinAmount),
        note: checkinNote.trim() === '' ? null : checkinNote.trim(),
      })
      setCheckinOpen(false)
      setCheckinAmount('')
      setCheckinNote('')
      setNotice(`打卡成功（${log.visited_date}）${log.amount_fen !== null ? `，已记账 ¥${(log.amount_fen / 100).toFixed(2)}` : ''}；记录只本人可见，可在「我的」页管理`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '打卡失败')
    }
  }

  function openNav(): void {
    if (!d) return
    void Taro.openLocation({ latitude: d.lat, longitude: d.lng, name: d.name, address: d.address, scale: 16 })
  }

  async function doWithdraw(): Promise<void> {
    if (!d) return
    const ok = await Taro.showModal({
      title: '撤回反馈',
      content: '撤回后这条反馈立即停止公开、立即停止计票，更早的已批准版本不会自动恢复。确定撤回？',
      confirmText: '撤回',
      confirmColor: '#a3231d',
    })
    if (!ok.confirm) return
    setWithdrawBusy(true)
    try {
      await withdrawFeedback(d.id)
      setNotice('已撤回，本店票数已重算')
      await load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '撤回失败')
    } finally {
      setWithdrawBusy(false)
    }
  }

  function copyLink(): void {
    const url = `https://serennity007.github.io/beijing-food-map/restaurants/${d?.id ?? ''}`
    void Taro.setClipboardData({ data: url }).then(() => setNotice('链接已复制（演示数据链接）'))
  }

  if (error) {
    return (
      <View className="page">
        <View className="status bad">
          <Text>{error}</Text>
        </View>
        <Button className="btn" onClick={() => void load()}>
          重试
        </Button>
      </View>
    )
  }
  if (!d) {
    return (
      <View className="page">
        <View className="status">
          <Text>正在读取门店资料…</Text>
        </View>
      </View>
    )
  }

  const cuisineNames = d.cuisines.map((c) => CUISINE_LABEL[c as keyof typeof CUISINE_LABEL]).join(' · ')
  const price = d.price.average === null ? '人均未知' : `¥${d.price.average}`
  const my = d.my_current_feedback
  const basisLine = d.in_default_layer
    ? `为什么在好店地图上：近 180 天里 ${d.basis.tally.recommend} 位用户推荐（共 ${d.basis.tally.total} 份有效反馈），地点已核验。`
    : `这家店暂不在默认好店地图：${d.ineligibility_reasons.join('；') || '未满足推荐资格'}`

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">
          {d.name}
          {d.branch ? `（${d.branch}）` : ''}
        </Text>
        <Text className="sub">{cuisineNames} · {d.place_status === 'VERIFIED' ? '地点已核验' : '地点待核验'}</Text>
      </View>

      {!d.in_default_layer && (
        <View className="basis warn">
          <Text className="basis-title">这家店暂不在默认好店地图</Text>
          {d.ineligibility_reasons.map((r) => (
            <Text className="basis-item" key={r}>
              · {r}
            </Text>
          ))}
        </View>
      )}

      <View className="panel">
        <View className="fact">
          <Text className="dt">人均</Text>
          <Text className="dd price">
            {d.price.average === null ? '未知' : `¥${d.price.average}`}
            <Text className="price-unit"> / 人 · {d.price.report_count} 人报告（用户自报）</Text>
          </Text>
        </View>
        <View className="fact">
          <Text className="dt">推荐菜</Text>
          <Text className="dd">{d.dish_highlights.join('、') || '尚未有人填写'}</Text>
        </View>
        <View className="fact">
          <Text className="dt">地址</Text>
          <Text className="dd">
            {d.address}
            {d.floor_info ? ` · ${d.floor_info}` : ''}
          </Text>
        </View>
        <View className="fact">
          <Text className="dt">营业状态</Text>
          <Text className="dd">
            {d.business_status_note}
            {d.business_status === 'UNKNOWN' ? ' · 不自动推导"营业中"' : ''}
          </Text>
        </View>
        <View className="fact">
          <Text className="dt">口味</Text>
          <Text className="dd">{d.taste_tags.join('、') || '无'}</Text>
        </View>
      </View>

      <View className="basis ok">
        <Text className="basis-text">{basisLine}</Text>
      </View>

      <View className="panel">
        <Text className="hint">
          完整依据（时间窗、三类票数、地点核验与坐标）以 Web 版为准；规则版本 {d.basis.rule_version}。收藏、点赞和浏览都不计入票数。
        </Text>
      </View>

      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
        </View>
      )}

      {my && (
        <View className="panel">
          <Text className="label">已有一条我的反馈</Text>
          <View className="badge-row">
            <Text className="badge editorial">{ATTITUDE_LABEL[my.attitude as keyof typeof ATTITUDE_LABEL]}</Text>
            <Text className="badge muted">实吃 {my.visited_date}</Text>
            <Text className="badge warn">{feedbackStatusLabel(my.content_status)}</Text>
            {my.approved_revision !== null && <Text className="badge ok">公开第 {my.approved_revision} 版</Text>}
            {my.pending_revision !== null && <Text className="badge warn">第 {my.pending_revision} 版待审</Text>}
          </View>
          {my.reason ? <Text className="hint">{my.reason}</Text> : null}
          <Text className="hint">撤回会立即停止公开并退出计票，更早的已批准版本不会自动复活，票数即时重算。</Text>
          <View className="btn-row">
            <Button className="btn-plain" onClick={() => Taro.navigateTo({ url: `/pages/revise/index?id=${encodeURIComponent(d.id)}` })}>
              修改这条
            </Button>
            <Button className="btn-plain" disabled={withdrawBusy} onClick={() => void doWithdraw()}>
              {withdrawBusy ? '撤回中…' : '撤回'}
            </Button>
          </View>
        </View>
      )}

      <View className="panel">
        <Text className="label">我的记录</Text>
        <View className="chips">
          {[
            { kind: 'want', label: '想吃' },
            { kind: 'visited', label: '吃过' },
            { kind: 'private_stash', label: '私藏' },
          ].map((x) => (
            <Text
              key={x.kind}
              className={favKinds.includes(x.kind) ? 'chip active' : 'chip'}
              onClick={() => (loggedIn ? void toggleFav(x.kind) : Taro.navigateTo({ url: '/pages/login/index' }))}
            >
              {favKinds.includes(x.kind) ? '✓ ' : '+ '}
              {x.label}
            </Text>
          ))}
        </View>
        <Text className="hint">私人清单不会公开，也不会代替实吃反馈。</Text>
        <View className="btn-row">
          <Button className="btn-primary" onClick={() => { setCheckinDate(todayMax); setCheckinOpen(!checkinOpen) }}>
            {checkinOpen ? '收起打卡' : '打卡'}
          </Button>
          <Button className="btn-primary" onClick={openNav}>
            到店导航
          </Button>
          <Button className="btn-primary" onClick={() => Taro.switchTab({ url: '/pages/submit/index' })}>
            写反馈
          </Button>
          <Button className="btn-plain" onClick={copyLink}>
            复制链接
          </Button>
          <Button className="btn-plain" onClick={() => setReportOpen(!reportOpen)}>
            {reportOpen ? '收起举报' : '纠错/举报'}
          </Button>
        </View>
        {reportOpen && (
          <View className="report-box">
            <Text className="label">问题类型</Text>
            <View className="chips">
              {[
                { kind: 'closed', label: '已经闭店/搬走了' },
                { kind: 'wrong_location', label: '位置不对' },
                { kind: 'wrong_info', label: '信息有误' },
                { kind: 'abuse', label: '内容违规' },
              ].map((k) => (
                <Text key={k.kind} className={reportKind === k.kind ? 'chip active' : 'chip'} onClick={() => setReportKind(k.kind)}>
                  {k.label}
                </Text>
              ))}
            </View>
            <Textarea value={reportDetail} onInput={(e) => setReportDetail(e.detail.value)} maxlength={300} placeholder="说明具体情况，例如：门头已换成别的店。" />
            <Button className="btn-primary" disabled={reportDetail.trim() === ''} onClick={() => void sendReport()}>
              提交工单
            </Button>
            <Text className="hint">举报只是复核线索，不会自动下架内容或判定闭店。</Text>
          </View>
        )}
      </View>

      {checkinOpen && (
        <View className="panel">
          <Text className="label">打卡 · 记账</Text>
          <View className="field">
            <Text className="label">到店日期</Text>
            <Picker mode="date" value={checkinDate || todayMax} end={todayMax} onChange={(e) => setCheckinDate(e.detail.value)}>
              <View className="picker-value">{checkinDate || '选择日期'}</View>
            </Picker>
          </View>
          <View className="field">
            <Text className="label">消费金额（元，可留空）</Text>
            <Input type="digit" value={checkinAmount} onInput={(e) => setCheckinAmount(e.detail.value)} placeholder="例如：128.50" />
          </View>
          <View className="field">
            <Text className="label">备注（可留空）</Text>
            <Input value={checkinNote} onInput={(e) => setCheckinNote(e.detail.value)} placeholder="例如：和朋友的周末早午餐" />
          </View>
          <Button className="btn-primary" disabled={checkinDate === ''} onClick={() => void sendCheckin()}>
            保存打卡
          </Button>
          <Text className="hint">打卡与记账仅本人可见，不参与公开推荐与票数；可在「我的」页管理。</Text>
        </View>
      )}

      <View className="footer-note">
        <Text className="hint">
          演示版本：门店与票数均为合成测试数据（{d.is_test_data ? 'is_test_data' : '数据标记异常'}）。
        </Text>
      </View>
    </View>
  )
}
