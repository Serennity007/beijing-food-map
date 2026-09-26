/**
 * 投稿页（小程序 C 端）：搜索选店 →（可选）建店申请 → 实吃反馈表单。
 * 校验全部在后端（同一套 contracts 引擎）；本页只提交表单、展示后端返回的字段错误。
 * 未登录会得到 401：页面给出登录入口，不自行判定权限。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button, Picker, Textarea, Map } from '@tarojs/components'
import {
  ATTITUDE_LABEL,
  ATTITUDES,
  DISCLOSURE_LABEL,
  DISCLOSURES,
  type CandidateFacts,
} from '@qianwei/contracts'
import {
  ApiError,
  createCandidate,
  fetchDetail,
  fetchMap,
  fetchList,
  me,
  searchStores,
  submitFeedback,
  today,
  uploadTestPhoto,
  type Restaurant,
} from '../../api'
import './index.scss'

function newKey(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  return c && typeof c.randomUUID === 'function' ? c.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function Submit() {
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Restaurant[] | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [candidateDone, setCandidateDone] = useState<{ id: string; restaurantId: string | null } | null>(null)

  // 建店申请字段
  const [cName, setCName] = useState('')
  const [cAddress, setCAddress] = useState('')
  const [cCuisines, setCCuisines] = useState<string[]>([])
  const [cEvidence, setCEvidence] = useState('')
  const [cPick, setCPick] = useState<{ lng: number; lat: number } | null>(null)
  const [cPickOpen, setCPickOpen] = useState(false)
  const [cBusy, setCBusy] = useState(false)
  const [cErr, setCErr] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const cKey = useMemo(() => newKey(), [])

  // 实吃反馈字段
  const [attitude, setAttitude] = useState('recommend')
  const [visitedDate, setVisitedDate] = useState('')
  const [dishes, setDishes] = useState<string[]>([])
  const [dishInput, setDishInput] = useState('')
  const [reason, setReason] = useState('')
  const [disclosure, setDisclosure] = useState<string | null>(null)
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const [receipt, setReceipt] = useState<{ id: string; version: number; status: string; restaurant_name: string } | null>(null)
  const [todayMax, setTodayMax] = useState('')
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const submitKey = useMemo(() => newKey(), [])

  useEffect(() => {
    void (async () => {
      try {
        const t = await today()
        setTodayMax(t)
        setVisitedDate((prev) => prev || t)
      } catch {
        setTodayMax('')
      }
      try {
        setLoggedIn((await me()) !== null)
      } catch {
        setLoggedIn(false)
      }
    })()
  }, [])

  // 搜索门店（防抖 300ms）
  useEffect(() => {
    const t = term.trim()
    if (!t) {
      setHits(null)
      return
    }
    const timer = setTimeout(() => {
      void searchStores(t)
        .then((r) => setHits(r.own))
        .catch(() => setHits(null))
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  const pickStore = useCallback(async (r: Restaurant) => {
    console.log('[app] pickStore called', r.id)
    setRestaurant(r)
    setHits(null)
    setTerm('')
    try {
      const d = await fetchDetail(r.id)
      setMediaCount(0)
      void d
    } catch {
      /* 详情读失败不影响选择 */
    }
  }, [])

  // 建店申请提交
  async function sendCandidate() {
    if (!cPick) {
      setCErr({ message: '请先在地图上点选位置', fields: {} })
      return
    }
    setCBusy(true)
    setCErr(null)
    try {
      const facts: CandidateFacts = {
        name: cName.trim(),
        branch: null,
        address: cAddress.trim(),
        floor_info: null,
        cuisines: cCuisines,
        lng: cPick.lng,
        lat: cPick.lat,
        source: 'manual_point',
        provider: null,
        poi_id: null,
        evidence_note: cEvidence.trim(),
      }
      const created = await createCandidate(facts, cKey)
      setCandidateDone({ id: created.id, restaurantId: created.restaurant_id })
      setCandidateOpen(false)
      if (created.restaurant_id) {
        try {
          setRestaurant(await fetchDetail(created.restaurant_id))
        } catch {
          /* 读取失败不影响回执 */
        }
      }
      await Taro.showToast({ title: `建店申请 ${created.id} 已提交`, icon: 'none' })
    } catch (e) {
      const f = e instanceof ApiError ? e : null
      setCErr({ message: f?.message ?? '提交失败', fields: f?.fields ?? {} })
    } finally {
      setCBusy(false)
    }
  }

  // 添加演示图片
  async function addPhoto() {
    if (!restaurant) return
    setBusy(true)
    try {
      const m = await uploadTestPhoto(restaurant.id)
      setMediaIds((cur) => (cur.includes(m.id) ? cur : [...cur, m.id]))
      setMediaCount((n) => n + 1)
    } catch (e) {
      setErr({ message: e instanceof ApiError ? e.message : '图片登记失败', fields: {} })
    } finally {
      setBusy(false)
    }
  }

  // 提交实吃反馈
  async function send() {
    if (!restaurant) return
    setBusy(true)
    setErr(null)
    try {
      const r = await submitFeedback(
        {
          restaurant_id: restaurant.id,
          visited_date: visitedDate,
          attitude,
          dish_names: dishes,
          reason: reason.trim(),
          media_ids: mediaIds,
          disclosure,
        },
        submitKey,
      )
      setReceipt(r)
      setDishes([])
      setReason('')
      setMediaIds([])
      setMediaCount(0)
    } catch (e) {
      const f = e instanceof ApiError ? e : null
      setErr({ message: f?.message ?? '提交失败', fields: f?.fields ?? {} })
    } finally {
      setBusy(false)
    }
  }

  function toggleCuisine(c: string): void {
    setCCuisines((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c].slice(0, 3)))
  }

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">推荐好店 · 提交实吃反馈</Text>
        <Text className="sub">只写你真的吃过的那一家。提交后进入人工审核，通过才会公开并计入票数。</Text>
        {loggedIn === false && <Text className="hint">未登录：投稿需要登录（我的页 → 登录）。</Text>}
      </View>

      {receipt && (
        <View className="alert ok">
          <Text>
            已提交 {receipt.id} · 第 {receipt.version} 版 · {receipt.status} · {receipt.restaurant_name}
          </Text>
        </View>
      )}
      {err && (
        <View className="alert bad">
          <Text>{err.message}</Text>
          {Object.entries(err.fields).map(([k, v]) => (
            <Text className="err" key={k}>
              {k}：{v}
            </Text>
          ))}
        </View>
      )}

      <View className="panel">
        <Text className="label">搜索门店</Text>
        <Input className="f-store-search" value={term} onInput={(e) => setTerm(e.detail.value)} placeholder="店名、分店、菜名或地址" />
        {restaurant ? (
          <View className="card picked">
            <Text className="card-name">
              {restaurant.name}
              {restaurant.branch ? `（${restaurant.branch}）` : ''}
            </Text>
            <Text className="card-meta">{restaurant.address}</Text>
            <Button className="btn-plain" onClick={() => setRestaurant(null)}>
              清除选择
            </Button>
          </View>
        ) : (
          <Text className="hint">还没有选择门店。</Text>
        )}
        {hits && hits.length > 0 && (
          <View className="list">
            {hits.slice(0, 6).map((r) => (
              <View className="card" key={r.id} onClick={() => void pickStore(r)}>
                <Text className="card-name">
                  {r.name}
                  {r.branch ? `（${r.branch}）` : ''}
                </Text>
                <Text className="card-meta">{r.address}</Text>
                <Text className="dish-chip" onClick={() => void pickStore(r)}>
                  选为投稿对象
                </Text>
              </View>
            ))}
          </View>
        )}
        {hits && hits.length === 0 && (
          <View className="hint-box">
            <Text className="hint">没有匹配的已收录门店。可以直接提交建店申请。</Text>
            <Button className="btn-plain" onClick={() => setCandidateOpen(true)}>
              申请新增门店
            </Button>
          </View>
        )}
      </View>

      {candidateOpen && (
        <View className="panel">
          <Text className="label">新建门店申请</Text>
          <Text className="hint">提交后以「地点待核验」进入库，只出现在显式开启的待验证图层，不代表平台推荐。</Text>
          <View className="field">
            <Text className="label">门店名</Text>
            <Input value={cName} onInput={(e) => setCName(e.detail.value)} placeholder="例如：某某酸汤鱼" />
            {cErr?.fields.name && <Text className="err">{cErr.fields.name}</Text>}
          </View>
          <View className="field">
            <Text className="label">地址</Text>
            <Input value={cAddress} onInput={(e) => setCAddress(e.detail.value)} placeholder="写到门牌号，便于审核定位" />
            {cErr?.fields.address && <Text className="err">{cErr.fields.address}</Text>}
          </View>
          <View className="field">
            <Text className="label">菜系（最多 3 个）</Text>
            <View className="chips">
              {['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'].map((c) => (
                <Text key={c} className={cCuisines.includes(c) ? 'chip active' : 'chip'} onClick={() => toggleCuisine(c)}>
                  {c}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">位置（点地图选点）</Text>
            {cPickOpen ? (
              <View className="picker-map">
                <Map
                  className="the-map"
                  latitude={cPick?.lat ?? 39.9042}
                  longitude={cPick?.lng ?? 116.4074}
                  zoom={13}
                  showCompass={false}
                  onTap={(e) => {
                    const detail = (e as { detail?: { longitude?: number; latitude?: number } })?.detail
                    if (detail?.longitude !== undefined && detail?.latitude !== undefined) {
                      setCPick({ lng: detail.longitude, lat: detail.latitude })
                    }
                  }}
                />
              </View>
            ) : (
              <Button className="btn-plain" onClick={() => setCPickOpen(true)}>
                打开地图选点
              </Button>
            )}
            <Text className="hint">{cPick ? `已选位置 ${cPick.lng.toFixed(5)}, ${cPick.lat.toFixed(5)}（GCJ-02）` : '尚未选点：点击地图任意位置。'}</Text>
            {cErr?.fields.lng_lat && <Text className="err">{cErr.fields.lng_lat}</Text>}
          </View>
          <View className="field">
            <Text className="label">信息来源（你从哪知道这家店）</Text>
            <Textarea value={cEvidence} onInput={(e) => setCEvidence(e.detail.value)} maxlength={500} />
            {cErr?.fields.evidence_note && <Text className="err">{cErr.fields.evidence_note}</Text>}
          </View>
          <Button className="btn-primary" disabled={cBusy} onClick={() => void sendCandidate()}>
            {cBusy ? '提交中…' : '提交建店申请'}
          </Button>
          <Button className="btn-plain" onClick={() => setCandidateOpen(false)}>
            取消
          </Button>
        </View>
      )}

      {candidateDone && (
        <View className="alert ok">
          <Text>
            建店申请 {candidateDone.id} 已提交{candidateDone.restaurantId ? `，门店 ${candidateDone.restaurantId} 待核验` : ''}
          </Text>
        </View>
      )}

      {restaurant && (
        <View className="panel">
          <Text className="label">实吃内容</Text>
          <View className="field">
            <Text className="label">对这家店的态度</Text>
            <View className="chips">
              {ATTITUDES.map((a) => (
                <Text key={a} className={attitude === a ? 'chip active' : 'chip'} onClick={() => setAttitude(a)}>
                  {ATTITUDE_LABEL[a]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">实吃日期</Text>
            <Picker mode="date" value={visitedDate || todayMax} end={todayMax} onChange={(e) => setVisitedDate(e.detail.value)}>
              <View className="picker-value">{visitedDate || '选择日期'}</View>
            </Picker>
          </View>
          <View className="field">
            <Text className="label">推荐菜</Text>
            <View className="btn-row">
              <Input className="f-dish" value={dishInput} onInput={(e) => setDishInput(e.detail.value)} placeholder="例如：酸汤鱼" />
              <Button className="btn-plain" onClick={() => { if (dishInput.trim()) { setDishes((cur) => (cur.includes(dishInput.trim()) ? cur : [...cur, dishInput.trim()])); setDishInput('') } }}>
                添加
              </Button>
            </View>
            {dishes.map((x) => (
              <Text className="dish-chip" key={x} onClick={() => setDishes((cur) => cur.filter((y) => y !== x))}>
                {x} ✕
              </Text>
            ))}
          </View>
          <View className="field">
            <Text className="label">理由（20—500 字）</Text>
            <Textarea className="f-reason" value={reason} onInput={(e) => setReason(e.detail.value)} maxlength={500} />
            {err?.fields.reason && <Text className="err">{err.fields.reason}</Text>}
          </View>
          <View className="field">
            <Text className="label">利益披露（必填）</Text>
            <View className="chips">
              {DISCLOSURES.map((d) => (
                <Text key={d} className={disclosure === d ? 'chip active' : 'chip'} onClick={() => setDisclosure(d)}>
                  {DISCLOSURE_LABEL[d]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">图片（演示合成图，{mediaCount} 张）</Text>
            <Button className="btn-plain" disabled={busy} onClick={() => void addPhoto()}>
              添加一张演示图片
            </Button>
            <Text className="hint">本演示不接真实相册：图片由服务端登记为合成素材。</Text>
          </View>
          <Button className="btn-primary" disabled={busy || !loggedIn} onClick={() => void send()}>
            {busy ? '提交中…' : '提交到审核'}
          </Button>
          {!loggedIn && <Text className="hint">登录后才能提交（我的页 → 登录）。</Text>}
        </View>
      )}

      <View className="footer-note">
        <Text className="hint">演示版本：门店、图片、实吃与票数均为合成测试数据。</Text>
      </View>
    </View>
  )
}
