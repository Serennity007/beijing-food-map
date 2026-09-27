/**
 * 清单分享只读页（对应 Web /s/:token）：展示接口返回的不可变公开快照。
 * 匿名可读；错误一律提示「链接无效或已撤销」，不区分不存在与已撤销、不复述内部原因。
 * 支持微信转发：onShareAppMessage 把 token 带给下一个打开的人。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro, { useShareAppMessage, useRouter } from '@tarojs/taro'
import { View, Text, Image, Button } from '@tarojs/components'
import { CUISINE_LABEL } from '@qianwei/contracts'
import { mediaUrl, sharedSnapshot, type SharedCollectionSnapshot } from '../../api'
import './index.scss'

export default function Share() {
  const { params } = useRouter()
  const token = params.token ?? ''
  const [snap, setSnap] = useState<SharedCollectionSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      setSnap(await sharedSnapshot(token))
    } catch {
      setSnap(null)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useShareAppMessage(() => ({
    title: snap ? `清单分享：${snap.title}` : '京城黔味地图 · 清单分享',
    path: `/pages/share/index?token=${encodeURIComponent(token)}`,
  }))

  if (loading) {
    return (
      <View className="page">
        <View className="status">
          <Text>正在读取分享快照…</Text>
        </View>
      </View>
    )
  }

  if (failed || !snap) {
    return (
      <View className="page">
        <View className="status bad">
          <Text>链接无效或已撤销。</Text>
        </View>
        <Button className="btn" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
          回到地图
        </Button>
      </View>
    )
  }

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">{snap.title}</Text>
        <View className="badge-row">
          <Text className="badge muted">演示快照</Text>
        </View>
        {snap.description && <Text className="sub">{snap.description}</Text>}
        <Text className="card-meta">
          作者 {snap.author_display_name} · 发布于 {snap.published_at} · 共 {snap.items.length} 家门店
        </Text>
        <Text className="hint">这是发布当时的不可变快照：作者之后编辑私密草稿不会改变本页内容。</Text>
      </View>

      {snap.items.length === 0 ? (
        <View className="status">
          <Text>这份快照里没有可显示的门店：门店可能在快照发布后被隐藏、撤回或合并。</Text>
        </View>
      ) : (
        <View className="panel">
          <Text className="label">清单内容（{snap.items.length}）</Text>
          {snap.items.map((it) => (
            <View className="card" key={it.restaurant_id}>
              <Text className="card-name">
                {it.name}
                {it.branch ? `（${it.branch}）` : ''}
              </Text>
              <View className="badge-row">
                {it.cuisines.map((c) => (
                  <Text className="badge muted" key={c}>
                    {CUISINE_LABEL[c]}
                  </Text>
                ))}
                {it.pending_verification && <Text className="badge warn">作者个人推荐，平台尚未验证</Text>}
              </View>
              {it.pending_verification && (
                <Text className="hint">
                  这个标识只说明该店尚未满足平台默认好店图层的条件，不改变平台的推荐判定规则，也不代表已核实。
                </Text>
              )}
              {it.note && <Text className="card-meta">{it.note}</Text>}
              {it.media_ids.length > 0 && (
                <View className="thumbs">
                  {it.media_ids.map((m) => (
                    <Image
                      className="thumb"
                      key={m}
                      src={mediaUrl(m)}
                      mode="aspectFill"
                      lazyLoad
                    />
                  ))}
                </View>
              )}
              <View className="btn-row">
                <Button
                  className="btn-plain"
                  onClick={() =>
                    Taro.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(it.restaurant_id)}` })
                  }
                >
                  看门店详情
                </Button>
                <Button className="btn-plain" onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
                  去地图逛逛
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className="footer-note">
        <Text className="hint">生产环境本页会以 no-store 响应头提供，避免权限撤销之后仍被缓存命中。门店、图片与笔记均为合成测试数据。</Text>
      </View>
    </View>
  )
}
