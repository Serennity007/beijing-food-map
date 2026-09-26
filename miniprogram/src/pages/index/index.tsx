/**
 * 小程序首页（M1 只读）：腾讯原生 <map> + 门店列表。
 * 数据走后端 HTTP（本机 8787 或部署后端），业务规则全部来自共享的 @qianwei/contracts，
 * 小程序端不重算任何资格与计票。
 */
import { useCallback, useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Map, View, Text, ScrollView } from '@tarojs/components'
import { BEIJING_BOUNDS, BEIJING_CENTER } from '@qianwei/contracts'
import { fetchMap, fetchList, type MapQuery, type MapEntity, type Restaurant } from '../../api'
import markerRestaurant from '../../assets/marker-restaurant.png'
import markerCluster from '../../assets/marker-cluster.png'
import './index.scss'

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
  const [markers, setMarkers] = useState<Taro.maps.Marker[]>([])
  const [models, setModels] = useState<Record<number, MarkerModel>>({})
  const [region, setRegion] = useState({ ...BEIJING_CENTER, zoom: 11 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const map = await fetchMap(QUERY)
      const nextModels: Record<number, MarkerModel> = {}
      const nextMarkers: Taro.maps.Marker[] = map.items.map((entity, i) => {
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
      const page = await fetchList(QUERY, map.snapshot_id)
      setList(page.items)
    } catch (e) {
      setError((e as Error).message || '数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onMarkerTap = useCallback(
    (e) => {
      const markerId = (e as { detail?: { markerId?: number } }).detail?.markerId
      if (markerId === undefined) return
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
      <View className="map-wrap">
        <Map
          className="the-map"
          latitude={region.lat}
          longitude={region.lng}
          zoom={region.zoom}
          markers={markers}
          onMarkerTap={onMarkerTap}
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
        <View className="list-footer">
          <Text className="list-hint">演示版本：门店与票数均为合成测试数据</Text>
        </View>
      </ScrollView>
    </View>
  )
}
