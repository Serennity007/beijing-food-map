/**
 * 门店详情（M1 只读）：速览优先，完整依据给出一句话口径。
 * 规则判定全部来自后端（同一套 contracts 引擎），页面只搬运。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, Button } from '@tarojs/components'
import {
  CUISINE_LABEL,
  PLACE_LABEL,
  type RestaurantDetail,
} from '@qianwei/contracts'
import { fetchDetail } from '../../api'
import './index.scss'

export default function Detail() {
  const { params } = useRouter()
  const id = params.id ?? ''
  const [d, setD] = useState<RestaurantDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          完整依据（时间窗、三类票数、地点核验与坐标）以 Web 版为准；规则版本 {d.rule_version}。收藏、点赞和浏览都不计入票数。
        </Text>
      </View>

      <View className="footer-note">
        <Text className="hint">
          演示版本：门店与票数均为合成测试数据（{d.is_test_data ? 'is_test_data' : '数据标记异常'}）。
        </Text>
      </View>
    </View>
  )
}
