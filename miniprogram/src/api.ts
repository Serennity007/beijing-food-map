/**
 * 小程序端 API 层（M1 只读）：只搬运后端返回的数据，不重算任何业务规则。
 * 后端地址：开发阶段连本机 8787（开发者工具需勾选「不校验合法域名」，已在 project.config.json 关 urlCheck）；
 * 后端部署到公网后，把 BASE 换成 HTTPS 域名即可，页面代码不变。
 */
import Taro from '@tarojs/taro'

/** 后端基准地址。发布前换成已备案的 HTTPS 域名。 */
export const BASE = 'http://127.0.0.1:8787/api/v1'

export interface MapQuery {
  west: number
  south: number
  east: number
  north: number
  zoom: number
  view: string
  layer: string
}

export interface MapClusterItem {
  kind: 'cluster'
  id: string
  count: number
  longitude: number
  latitude: number
  expansion_bounds: { west: number; south: number; east: number; north: number }
}

export interface MapRestaurantItem {
  kind: 'restaurant'
  id: string
  name: string
  branch: string | null
  cuisines: string[]
  longitude: number
  latitude: number
  pending_verification: boolean
}

export type MapEntity = MapClusterItem | MapRestaurantItem

export interface MapItemsResponse {
  items: MapEntity[]
  total_matched: number
  mode: 'clusters' | 'restaurants'
  snapshot_id: string
  complete: boolean
}

export interface PageResponse<T> {
  items: T[]
  next_cursor: string | null
}

export interface Restaurant {
  id: string
  name: string
  branch: string | null
  cuisines: string[]
  dish_highlights: string[]
  price: { average: number | null; report_count: number }
  address: string
  place_status: string
  in_default_layer: boolean
  basis: {
    community: string
    tally: { recommend: number; neutral: number; not_recommend: number; total: number }
    editorial: string
    sources: string[]
  }
  lng: number
  lat: number
  is_test_data: boolean
}

export interface RestaurantDetail extends Restaurant {
  verification_note: string
  business_status: string
  business_status_note: string
  floor_info: string | null
  taste_tags: string[]
  ineligibility_reasons: string[]
  place_verified_at: string | null
  updated_at: string
  rule_version: string
}

async function req<T>(path: string): Promise<T> {
  const r = await Taro.request({ url: `${BASE}${path}`, method: 'GET' })
  // 后端响应是 { data: T, error?: { code, message } } 信封（与 Web 端 Http 客户端同一解包口径）
  const json = (
    typeof r.data === 'string'
      ? (JSON.parse(r.data) as { data?: T; error?: { code: string; message: string } } | null)
      : (r.data as { data?: T; error?: { code: string; message: string } } | null)
  )
  if (r.statusCode >= 400 || json?.error) {
    throw new Error(json?.error?.message ?? `请求失败（${r.statusCode}）`)
  }
  return (json?.data ?? null) as T
}

/** 生成 /map/items 的查询串。 */
export function mapItemsPath(q: MapQuery): string {
  const p = new URLSearchParams()
  p.set('west', String(q.west))
  p.set('south', String(q.south))
  p.set('east', String(q.east))
  p.set('north', String(q.north))
  p.set('zoom', String(Math.floor(q.zoom)))
  p.set('view', q.view)
  p.set('layer', q.layer)
  return `/map/items?${p.toString()}`
}

export function fetchMap(q: MapQuery): Promise<MapItemsResponse> {
  return req<MapItemsResponse>(mapItemsPath(q))
}

export function fetchListPath(q: MapQuery, snapshot: string): string {
  const p = new URLSearchParams()
  p.set('west', String(q.west))
  p.set('south', String(q.south))
  p.set('east', String(q.east))
  p.set('north', String(q.north))
  p.set('zoom', String(Math.floor(q.zoom)))
  p.set('view', q.view)
  p.set('layer', q.layer)
  p.set('snapshot', snapshot)
  p.set('limit', '20')
  return `/restaurants?${p.toString()}`
}

export function fetchList(q: MapQuery, snapshot: string): Promise<PageResponse<Restaurant>> {
  return req<PageResponse<Restaurant>>(fetchListPath(q, snapshot))
}

export function fetchDetail(id: string): Promise<RestaurantDetail> {
  return req<RestaurantDetail>(`/restaurants/${encodeURIComponent(id)}`)
}
