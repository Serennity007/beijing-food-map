/**
 * 小程序首页（M1 只读）：腾讯原生 <map> + 门店列表。
 * 数据走后端 HTTP（本机 8787 或部署后端），业务规则全部来自共享的 @qianwei/contracts，
 * 小程序端不重算任何资格与计票。
 */
import { useCallback, useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import Taro from '@tarojs/taro'
import { Map, View, Text, ScrollView, Input, Button } from '@tarojs/components'
import type { CommonEvent } from '@tarojs/components'
import { BEIJING_BOUNDS, BEIJING_CENTER } from '@qianwei/contracts'
import { fetchMap, fetchList, searchStores, type MapQuery, type MapEntity, type Restaurant } from '../../api'
import markerRestaurant from '../../assets/marker-restaurant.png'
import markerCluster from '../../assets/marker-cluster.png'
import './index.scss'

/** <Map markers> 收窄断言的目标类型（Taro 未从包根导出 MapProps，经组件 props 推导） */
type TaroMapMarker = NonNullable<ComponentProps<typeof Map>['markers']>[number]

/** Taro 的 MapProps 把微信可选的 onError 标成必填，这里按 props 推导的类型给个记录性空实现 */
const onMapError: ComponentProps<typeof Map>['onError'] = () => {
  console.warn('[map] 地图组件触发 onError')
}

/**
 * 本页 marker 的最小类型。Taro 的 MapProps.label/callout 把微信可选字段
 * （anchorX/borderWidth/textAlign 等）标成必填，为不虚构默认值改变渲染，
 * 这里只声明实际用到的字段，在 <Map> 传入处断言一次。
 */
interface MapMarker {
  id: number
  latitude: number
  longitude: number
  width: number
  height: number
  iconPath: string
  label?: {
    content: string
    color: string
    bgColor: string
    borderRadius: number
    padding: number
    fontSize: number
    anchorX: number
    anchorY: number
    textAlign: 'center'
  }
  callout?: {
    content: string
    color: string
    bgColor: string
    padding: number
    borderRadius: number
    display: 'ALWAYS'
    fontSize: number
  }
}

const QUERY: MapQuery = {
  west: BEIJING_BOUNDS.west,
  south: BEIJING_BOUNDS.south,
  east: BEIJING_BOUNDS.east,
  north: BEIJING_BOUNDS.north,
  zoom: 11,
  view: 'guizhou',
  layer: 'qualified',
}

interface MarkerModel {
  id: number
  entity: MapEntity
}

export default function Index() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<MapEntity[]>([])
  const [list, setList] = useState<Restaurant[]>([])
  const [totalMatched, setTotalMatched] = useState(0)
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [models, setModels] = useState<Record<number, MarkerModel>>({})
  const [region, setRegion] = useState({ ...BEIJING_CENTER, zoom: 11 })
  const [view, setView] = useState<'guizhou' | 'southwest' | 'other'>('guizhou')
  const [layer, setLayer] = useState<'qualified' | 'pending_verification'>('qualified')
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<Restaurant[] | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q: MapQuery = { ...QUERY, view, layer }
    try {
      const map = await fetchMap(q)
      const nextModels: Record<number, MarkerModel> = {}
      const nextMarkers: MapMarker[] = map.items.map((entity, i) => {
        const id = i + 1
        nextModels[id] = { id, entity }
        const base = {
          id,
          latitude: entity.latitude,
          longitude: entity.longitude,
          width: 24,
          height: 24,
        }
        if (entity.kind === 'cluster') {
          return {
            ...base,
            iconPath: markerCluster,
            label: {
              content: String(entity.count),
              color: '#ffffff',
              bgColor: '#2e5f86',
              borderRadius: 12,
              padding: 5,
              fontSize: 12,
              anchorX: 0,
              anchorY: -22,
              textAlign: 'center' as const,
            },
          }
        }
        return {
          ...base,
          iconPath: markerRestaurant,
          callout: {
            content: entity.branch ? `${entity.name}（${entity.branch}）` : entity.name,
            color: '#221f1c',
            bgColor: '#fffefb',
            padding: 6,
            borderRadius: 8,
            display: 'ALWAYS' as const,
            fontSize: 12,
          },
        }
      })
      setEntities(map.items)
      setTotalMatched(map.total_matched)
      setSnapshotId(map.snapshot_id)
      setMarkers(nextMarkers)
      setModels(nextModels)
      const page = await fetchList(q, map.snapshot_id)
      setList(page.items)
    } catch (e) {
      setError((e as Error).message || '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [view, layer])

  useEffect(() => {
    void load()
  }, [load])

  // 门店搜索（防抖 300ms），结果叠在地图列表之上；失败保留关键词进入可重试态
  useEffect(() => {
    const t = term.trim()
    if (!t) {
      setHits(null)
      setSearchFailed(false)
      return
    }
    const timer = setTimeout(() => {
      void searchStores(t)
        .then((r) => {
          setHits(r.own)
          setSearchFailed(false)
        })
        .catch(() => {
          setHits(null)
          setSearchFailed(true)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [term])

  const rerunSearch = useCallback(() => {
    const t = term.trim()
    if (!t) return
    setSearchFailed(false)
    void searchStores(t)
      .then((r) => {
        setHits(r.own)
        setSearchFailed(false)
      })
      .catch(() => {
        setHits(null)
        setSearchFailed(true)
      })
  }, [term])

  /** 搜索结果「在地图查看」：相机飞至该门店（与 Web 搜索定位同一交互意图） */
  const flyTo = useCallback((r: Restaurant) => {
    setRegion({ lat: r.lat, lng: r.lng, zoom: 16 })
  }, [])

  const onMarkerTap = useCallback(
    (e: CommonEvent<{ markerId: number | string }>) => {
      const markerId = Number(e.detail.markerId)
      if (!Number.isFinite(markerId)) return
      const model = models[markerId]
      if (!model) return
      const { entity } = model
      if (entity.kind === 'restaurant') {
        Taro.navigateTo({ url: `/pages/detail/index?id=${entity.id}` })
        return
      }
      // 聚合点：放大到 expansion_bounds 并按新视野重新查询
      const b = entity.expansion_bounds
      const nextQuery: MapQuery = {
        ...QUERY,
        west: b.west,
        south: b.south,
        east: b.east,
        north: b.north,
        zoom: 14,
      }
      setRegion({
        lat: (b.south + b.north) / 2,
        lng: (b.west + b.east) / 2,
        zoom: 14,
      })
      void (async () => {
        setLoading(true)
        try {
          const map = await fetchMap(nextQuery)
          const nextModels: Record<number, MarkerModel> = {}
          setMarkers(
            map.items.map((entity, i) => {
              const id = i + 1
              nextModels[id] = { id, entity }
              return {
                id,
                latitude: entity.latitude,
                longitude: entity.longitude,
                width: 24,
                height: 24,
                iconPath: entity.kind === 'cluster' ? markerCluster : markerRestaurant,
              }
            }),
          )
          setModels(nextModels)
          setEntities(map.items)
          setTotalMatched(map.total_matched)
          const page = await fetchList(nextQuery, map.snapshot_id)
          setList(page.items)
        } finally {
          setLoading(false)
        }
      })()
    },
    [models],
  )

  const openDetail = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/detail/index?id=${id}` })
  }, [])

  return (
    <View className="page">
      <View className="toolbar">
        <Input className="search-input" value={term} onInput={(e) => setTerm(e.detail.value)} placeholder="搜店名、菜名或地址" />
        <View className="chips">
          {(['guizhou', 'southwest', 'other'] as const).map((v) => (
            <Text key={v} className={view === v ? 'chip active' : 'chip'} onClick={() => setView(v)}>
              {v === 'guizhou' ? '贵州菜' : v === 'southwest' ? '西南风味' : '北京其他'}
            </Text>
          ))}
          <Text
            className={layer === 'pending_verification' ? 'chip active' : 'chip'}
            onClick={() => setLayer(layer === 'pending_verification' ? 'qualified' : 'pending_verification')}
          >
            {layer === 'pending_verification' ? '显示待验证' : '待验证图层'}
          </Text>
        </View>
      </View>
      <View className="map-wrap">
        <Map
          className="the-map"
          latitude={region.lat}
          longitude={region.lng}
          scale={region.zoom}
          markers={markers as TaroMapMarker[]}
          onMarkerTap={onMarkerTap}
          onError={onMapError}
          showCompass={false}
          enableRotate={false}
          enable3D={false}
        />
        <View className="statusline">
          <Text className="pill">
            {loading ? '加载中… ' : ''}
            匹配 {totalMatched} 家
          </Text>
          {error && <Text className="pill warn">{error}</Text>}
        </View>
      </View>

      {hits && hits.length > 0 && (
        <View className="panel">
          <Text className="label">搜索结果（{hits.length}）</Text>
          {hits.slice(0, 6).map((r) => (
            <View className="row" key={r.id} onClick={() => openDetail(r.id)}>
              <Text className="row-main">
                {r.name}
                {r.branch ? `（${r.branch}）` : ''}
              </Text>
              <Text className="row-sub">{r.address}</Text>
              <Text
                className="dish-chip"
                onClick={(e) => {
                  e.stopPropagation()
                  flyTo(r)
                }}
              >
                在地图查看
              </Text>
            </View>
          ))}
        </View>
      )}
      {searchFailed && (
        <View className="panel">
          <Text className="label">搜索没有成功</Text>
          <Text className="hint">关键词「{term.trim()}」已保留，可重试，或直接浏览下方列表。</Text>
          <Button className="btn-plain" onClick={rerunSearch}>
            重试搜索
          </Button>
        </View>
      )}
      {hits && hits.length === 0 && (
        <View className="panel">
          <Text className="label">没有匹配的已收录门店</Text>
          <Button className="btn-plain" onClick={() => Taro.navigateTo({ url: '/pages/submit/index' })}>
            去申请建店
          </Button>
        </View>
      )}
      {error && (
        <View className="panel">
          <Text className="label">列表数据加载失败</Text>
          <Text className="hint">{error} 列表保留上次结果，可重试或调整筛选。</Text>
          <Button className="btn-plain" onClick={() => void load()}>
            重试
          </Button>
        </View>
      )}
      <View className="list-head">
        <Text className="list-title">好店列表（前 {list.length} 家）</Text>
        {snapshotId && <Text className="list-hint">同一查询快照</Text>}
      </View>

      <ScrollView className="list" scrollY enhanced enableFlex>
        {list.map((r) => (
          <View className="card" key={r.id} onClick={() => openDetail(r.id)}>
            <View className="card-title">
              <Text className="card-name">
                {r.name}
                {r.branch ? `（${r.branch}）` : ''}
              </Text>
              {r.in_default_layer && <Text className="badge ok">好店</Text>}
            </View>
            <View className="card-row">
              <Text className="card-meta">
                {r.price.average === null ? '人均未知' : `人均 ¥${r.price.average}`}
                {' · '}
                {r.address}
              </Text>
            </View>
            {r.dish_highlights.length > 0 && (
              <View className="card-row">
                <Text className="card-dishes">推荐菜：{r.dish_highlights.slice(0, 3).join('、')}</Text>
              </View>
            )}
          </View>
        ))}
        {!loading && list.length === 0 && !error && (
          <View className="empty">
            <Text>当前视野内没有符合推荐资格的门店。</Text>
          </View>
        )}
        {list.some((r) => r.is_test_data) && (
          <View className="list-footer">
            <Text className="list-hint">演示版本：门店与票数均为合成测试数据</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
