/**
 * 小程序端 API 层：与 Web 端 Http 客户端同一套后端契约、同一解包口径。
 * 会话：后端下发 HMAC 签名 Cookie，wx.request 不自动管理，
 * 这里手工维护一个最小 Cookie Jar（存 storage，每请求带回）。
 * 只搬运数据，不重算任何业务规则。
 */
import Taro from '@tarojs/taro'

/** 后端基准地址。发布前换成已备案的 HTTPS 域名。 */
export const BASE = 'http://127.0.0.1:8787/api/v1'

const COOKIE_KEY = 'qw.cookie'

export class ApiError extends Error {
  code: string
  fields: Record<string, string>
  constructor(code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.code = code
    this.fields = fields
  }
}

function loadCookie(): string {
  return (Taro.getStorageSync(COOKIE_KEY) as string) || ''
}

function saveCookieFrom(header: Record<string, unknown> | undefined): void {
  if (!header) return
  const raw = (header['Set-Cookie'] ?? header['set-cookie']) as string | string[] | undefined
  if (!raw) return
  const first = Array.isArray(raw) ? raw[0] : raw
  const pair = first.split(';')[0]?.trim()
  if (pair) Taro.setStorageSync(COOKIE_KEY, pair)
}

export function clearSession(): void {
  Taro.removeStorageSync(COOKIE_KEY)
}

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

export interface SessionUser {
  id: string
  display_name: string
  roles: string[]
  phone_masked: string
  is_test_data: true
  account_status: 'active' | 'deleting'
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
  my_current_feedback: {
    attitude: string
    visited_date: string
    content_status: string
    pending_revision: number | null
    approved_revision: number | null
    reason: string
    disclosure: string
  } | null
  updated_at: string
  rule_version: string
}

export interface RestaurantCandidate {
  id: string
  revision: number
  name: string
  branch: string | null
  address: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reject_reason: string | null
  restaurant_id: string | null
  duplicates: Array<{ kind: string; matched_id: string; name: string; reason: string; distance_m: number | null }>
}

export interface Submission {
  id: string
  version: number
  status: string
  restaurant_id: string
  restaurant_name: string
}

export interface ReportTicket {
  id: string
  status: string
  kind: string
  result_note: string | null
}

export interface Collection {
  id: string
  title: string
  description: string | null
  system_kind: string | null
  items: Array<{ restaurant_id: string; restaurant_name?: string }>
}

interface Envelope<T> {
  data?: T
  error?: { code: string; message: string; fieldErrors?: Record<string, string> }
}

async function req<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', body?: unknown, idempotencyKey?: string): Promise<T> {
  const header: Record<string, string> = { 'content-type': 'application/json' }
  const cookie = loadCookie()
  if (cookie) header.Cookie = cookie
  if (idempotencyKey) header['idempotency-key'] = idempotencyKey
  const r = await Taro.request({
    url: `${BASE}${path}`,
    method,
    data: body,
    header,
  })
  saveCookieFrom(r.header as Record<string, unknown>)
  const json = (
    typeof r.data === 'string'
      ? (JSON.parse(r.data) as Envelope<T> | null)
      : (r.data as Envelope<T> | null)
  )
  if (r.statusCode >= 400 || json?.error) {
    throw new ApiError(
      json?.error?.code ?? 'PROVIDER_UNAVAILABLE',
      json?.error?.message ?? `请求失败（${r.statusCode}）`,
      json?.error?.fieldErrors ?? {},
    )
  }
  return (json?.data ?? null) as T
}

function qskv(params: Record<string, string | number>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) p.set(k, String(v))
  return `/map/items?${p.toString()}`
}

// ---------------- 地图与门店（匿名可读） ----------------

export function fetchMap(q: MapQuery): Promise<MapItemsResponse> {
  return req(qskv({ west: q.west, south: q.south, east: q.east, north: q.north, zoom: Math.floor(q.zoom), view: q.view, layer: q.layer }))
}

export function fetchList(q: MapQuery, snapshot: string): Promise<PageResponse<Restaurant>> {
  return req(
    `/restaurants?${new URLSearchParams({
      west: String(q.west),
      south: String(q.south),
      east: String(q.east),
      north: String(q.north),
      zoom: String(Math.floor(q.zoom)),
      view: q.view,
      layer: q.layer,
      snapshot,
      limit: '20',
    }).toString()}`,
  )
}

export function searchStores(term: string): Promise<{ own: Restaurant[]; provider_candidates: unknown[] }> {
  return req(`/restaurants/search?q=${encodeURIComponent(term)}`)
}

export function fetchDetail(id: string): Promise<RestaurantDetail> {
  return req(`/restaurants/${encodeURIComponent(id)}`)
}

export function today(): Promise<string> {
  return req('/today')
}

// ---------------- 会话 ----------------

export function login(userId: string, code: string): Promise<SessionUser> {
  return req('/auth/login', 'POST', { user_id: userId, code })
}

export function logout(): Promise<unknown> {
  return req('/auth/logout', 'POST')
}

export function me(): Promise<SessionUser | null> {
  return req('/me')
}

// ---------------- 投稿 ----------------

export interface SubmitInput {
  restaurant_id: string
  visited_date: string
  attitude: string
  dish_names: string[]
  reason: string
  media_ids: string[]
  disclosure: string | null
}

export function submitFeedback(input: SubmitInput, idempotencyKey: string): Promise<Submission> {
  return req('/submissions', 'POST', input, idempotencyKey)
}

export function mySubmissions(): Promise<Submission[]> {
  return req('/me/submissions')
}

export function uploadTestPhoto(restaurantId: string | null): Promise<{ id: string }> {
  return req('/uploads/test-photo', 'POST', { restaurant_id: restaurantId })
}

// ---------------- 建店候选 ----------------

export interface CandidateCreateInput {
  name: string
  branch: string | null
  address: string
  floor_info: string | null
  cuisines: string[]
  lng: number
  lat: number
  source: string
  provider: string | null
  poi_id: string | null
  evidence_note: string
}

export function createCandidate(input: CandidateCreateInput, idempotencyKey: string): Promise<RestaurantCandidate> {
  return req('/restaurant-candidates', 'POST', input, idempotencyKey)
}

export function myCandidates(): Promise<RestaurantCandidate[]> {
  return req('/me/restaurant-candidates')
}

// ---------------- 举报 ----------------

export interface DiningLog {
  id: string
  restaurant_id: string
  restaurant_name: string
  visited_date: string
  amount_fen: number | null
  note: string | null
  created_at: string
}

export interface DiningLogPage {
  logs: DiningLog[]
  stats: { month: string; count: number; total_fen: number }
}

export function createDiningLog(input: { restaurant_id: string; visited_date: string; amount_yuan?: number | null; note?: string | null }): Promise<DiningLog> {
  return req('/me/dining-logs', 'POST', input)
}

export function myDiningLogs(): Promise<DiningLogPage> {
  return req('/me/dining-logs')
}

export function deleteDiningLog(id: string): Promise<{ ok: true }> {
  return req(`/me/dining-logs/${encodeURIComponent(id)}`, 'DELETE')
}


export function createReport(input: { restaurant_id: string; kind: string; detail: string; feedback_target?: string | null }): Promise<ReportTicket> {
  return req('/reports', 'POST', input)
}

export function myReports(): Promise<ReportTicket[]> {
  return req('/me/reports')
}

// ---------------- 清单收藏 ----------------

export function collections(): Promise<Collection[]> {
  return req('/collections')
}

export function toggleSystemItem(restaurantId: string, kind: string, on: boolean): Promise<Collection[]> {
  return req(`/restaurants/${encodeURIComponent(restaurantId)}/collection-item`, 'PUT', { kind, on })
}
