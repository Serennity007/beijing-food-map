/**
 * 修订反馈页（小程序 C 端，非 tab 页）：从 my_current_feedback 预填，
 * 再次 POST /submissions 生成新待审版本。校验与票数规则全部在后端。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Input, Button, Picker, Textarea } from '@tarojs/components'
import {
  ATTITUDE_LABEL,
  ATTITUDES,
  DISCLOSURE_LABEL,
  DISCLOSURES,
  type RestaurantDetail,
} from '@qianwei/contracts'
import { ApiError, fetchDetail, submitFeedback, today, uploadTestPhoto } from '../../api'
import './index.scss'

function newKey(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  return c && typeof c.randomUUID === 'function' ? c.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function Revise() {
  const { params } = useRouter()
  const id = params.id ?? ''
  const [d, setD] = useState<RestaurantDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [attitude, setAttitude] = useState('recommend')
  const [visitedDate, setVisitedDate] = useState('')
  const [dishes, setDishes] = useState<string[]>([])
  const [dishInput, setDishInput] = useState('')
  const [reason, setReason] = useState('')
  const [disclosure, setDisclosure] = useState<string | null>(null)
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [todayMax, setTodayMax] = useState('')
  const submitKey = useMemo(() => newKey(), [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const detail = await fetchDetail(id)
      setD(detail)
      const my = detail.my_current_feedback
      if (my) {
        setAttitude(my.attitude)
        setVisitedDate(my.visited_date)
        setDishes(my.dish_names)
        setReason(my.reason)
        setDisclosure(my.disclosure)
        setMediaIds(my.media_ids)
      }
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

  async function addPhoto(): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const m = await uploadTestPhoto(id)
      setMediaIds((cur) => (cur.includes(m.id) ? cur : [...cur, m.id]))
    } catch (e) {
      setErr({ message: e instanceof ApiError ? e.message : '图片登记失败', fields: {} })
    } finally {
      setBusy(false)
    }
  }

  async function send(): Promise<void> {
    setBusy(true)
    setErr(null)
    try {
      const r = await submitFeedback(
        {
          restaurant_id: id,
          visited_date: visitedDate,
          attitude,
          dish_names: dishes,
          reason: reason.trim(),
          media_ids: mediaIds,
          disclosure,
        },
        submitKey,
      )
      setNotice(`已提交新版本 ${r.id} · 第 ${r.version} 版 · ${r.status}`)
      await Taro.showToast({ title: `新版本 ${r.id} 已提交`, icon: 'none' })
    } catch (e) {
      const f = e instanceof ApiError ? e : null
      setErr({ message: f?.message ?? '提交失败', fields: f?.fields ?? {} })
    } finally {
      setBusy(false)
    }
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

  const my = d.my_current_feedback

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">修改这条反馈</Text>
        <Text className="sub">
          {d.name}
          {d.branch ? `（${d.branch}）` : ''}
        </Text>
      </View>

      {!my && (
        <View className="alert bad">
          <Text>这家店还没有你提交过的反馈，无法修改。</Text>
        </View>
      )}

      {my && (
        <View className="panel">
          <Text className="hint">
            修改会生成一个新的待审核版本；在新版本通过之前，原先已通过的版本继续公开显示并继续计票。
            {my.approved_revision !== null ? ` 当前公开的是第 ${my.approved_revision} 版。` : ''}
          </Text>
        </View>
      )}

      {notice && (
        <View className="alert ok">
          <Text>{notice}</Text>
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

      {my && (
        <View className="panel">
          <Text className="label">新版本内容</Text>
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
              <Input value={dishInput} onInput={(e) => setDishInput(e.detail.value)} placeholder="例如：酸汤鱼" />
              <Button
                className="btn-plain"
                onClick={() => {
                  if (dishInput.trim()) {
                    setDishes((cur) => (cur.includes(dishInput.trim()) ? cur : [...cur, dishInput.trim()]))
                    setDishInput('')
                  }
                }}
              >
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
            <Textarea value={reason} onInput={(e) => setReason(e.detail.value)} maxlength={500} />
            {err?.fields.reason && <Text className="err">{err.fields.reason}</Text>}
          </View>
          <View className="field">
            <Text className="label">利益披露（必填）</Text>
            <View className="chips">
              {DISCLOSURES.map((x) => (
                <Text key={x} className={disclosure === x ? 'chip active' : 'chip'} onClick={() => setDisclosure(x)}>
                  {DISCLOSURE_LABEL[x]}
                </Text>
              ))}
            </View>
          </View>
          <View className="field">
            <Text className="label">图片（演示合成图，{mediaIds.length} 张）</Text>
            <Button className="btn-plain" disabled={busy} onClick={() => void addPhoto()}>
              添加一张演示图片
            </Button>
            <Text className="hint">本演示不接真实相册：图片由服务端登记为合成素材。</Text>
          </View>
          <Button className="btn-primary" disabled={busy} onClick={() => void send()}>
            {busy ? '提交中…' : '提交新版本到审核'}
          </Button>
        </View>
      )}

      {d?.is_test_data && (
        <View className="footer-note">
          <Text className="hint">演示版本：门店、图片、实吃与票数均为合成测试数据。</Text>
        </View>
      )}
    </View>
  )
}
