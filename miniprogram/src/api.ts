/**
 * 小程序端 API 层：与 Web 端 Http 客户端同一套后端契约、同一解包口径。
 * 会话：后端下发 HMAC 签名 Cookie，wx.request 不自动管理，
 * 这里手工维护一个最小 Cookie Jar（存 storage，每请求带回）。
 * 只搬运数据，不重算任何业务规则。DTO 类型从 @qianwei/contracts 直连源码（构建时经 vendor 产物），避免两份漂移。
 */
import Taro from '@tarojs/taro'
import type {
  AuditRec,
  BusinessStatus,
  CandidateFacts,
  CandidateStatus,
  Collection,
  DiningLog,
  DiningLogPage,
  ModerationQueueEntry,
  PlaceVerificationStatus,
  ReportQueueEntry,
  ReportStatus,
  ReportTicket,
  Restaurant,
  RestaurantCandidate,
  RestaurantDetail,
  RiskStatus,
  SessionUser,
  SharedCollectionSnapshot,
  Submission,
  DeploymentMeta,
} from '@qianwei/contracts'

export type {
  AuditRec,
  BusinessStatus,
  CandidateFacts,
  CandidateStatus,
  Collection,
  DiningLog,
  DiningLogPage,
  ModerationQueueEntry,
  PlaceVerificationStatus,
  ReportQueueEntry,
  ReportStatus,
  ReportTicket,
  Restaurant,
  RestaurantCandidate,
  RestaurantDetail,
  RiskStatus,
  SessionUser,
  SharedCollectionSnapshot,
  Submission,
}

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
  if (!first) return
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

/** 部署自描述（进程内缓存一次）：演示水印与"真实上传/演示上传"按钮的显隐依据。 */
let metaCache: DeploymentMeta | null = null
export async function fetchMeta(): Promise<DeploymentMeta> {
  if (metaCache) return metaCache
  metaCache = await req<DeploymentMeta>('/meta')
  return metaCache
}

// ---------------- 会话 ----------------

export function login(userId: string, code: string): Promise<SessionUser> {
  return req('/auth/login', 'POST', { user_id: userId, code })
}

/** 发送手机验证码（真实登录路径；供应商由后端 SMS_PROVIDER 决定）。 */
export function phoneCode(phone: string): Promise<{ ok: true; ttl_seconds: number }> {
  return req('/auth/phone/code', 'POST', { phone })
}

export function phoneLogin(phone: string, code: string): Promise<SessionUser> {
  return req('/auth/phone/login', 'POST', { phone, code })
}

export function logout(): Promise<unknown> {
  return req('/auth/logout', 'POST')
}

export function me(): Promise<SessionUser | null> {
  return req('/me')
}

/** 账号注销：立即撤销本机会话与本人分享、隐藏 UGC、退出计票；返回清除任务编号。 */
export function deleteAccount(): Promise<{ deletion_job_id: string }> {
  return req('/me', 'DELETE')
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

/** 撤回我在这家店的全部反馈：立即停止公开与计票，不可逆。 */
export function withdrawFeedback(restaurantId: string): Promise<{ ok: true }> {
  return req(`/restaurants/${encodeURIComponent(restaurantId)}/my-feedback`, 'DELETE')
}

export function uploadTestPhoto(restaurantId: string | null): Promise<{ id: string }> {
  return req('/uploads/test-photo', 'POST', { restaurant_id: restaurantId })
}

/**
 * 真实图片上传：选一张图（Taro.chooseMedia）→ 读字节 → POST 原始字节到 /media/uploads。
 * 服务端做魔数校验 + EXIF 剥离（含 GPS），登记为待审核图片。
 */
export async function uploadPhoto(filePath: string): Promise<{ id: string }> {
  const meta = await fetchMeta()
  const fsm = Taro.getFileSystemManager()
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    fsm.readFile({
      filePath,
      success: (r) => resolve(r.data as ArrayBuffer),
      fail: (e) => reject(new Error(e.errMsg ?? '读取图片失败')),
    })
  })
  const r = await Taro.request({
    url: `${BASE}/media/uploads`,
    method: 'POST',
    data,
    header: { 'content-type': 'image/jpeg', Cookie: loadCookie() },
    timeout: 30000,
  })
  saveCookieFrom(r.header as Record<string, unknown>)
  const json = (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Envelope<{ id: string }>
  if (r.statusCode >= 400 || json?.error) {
    throw new ApiError(json?.error?.code ?? 'PROVIDER_UNAVAILABLE', json?.error?.message ?? '图片上传失败', json?.error?.fieldErrors ?? {})
  }
  return (json?.data ?? null) as { id: string }
}

// ---------------- 建店候选 ----------------

export function createCandidate(input: CandidateFacts, idempotencyKey: string): Promise<RestaurantCandidate> {
  return req('/restaurant-candidates', 'POST', input, idempotencyKey)
}

export function myCandidates(): Promise<RestaurantCandidate[]> {
  return req('/me/restaurant-candidates')
}

// ---------------- 举报 ----------------

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

export function createCollection(title: string, description: string | null): Promise<Collection> {
  return req('/collections', 'POST', { title, description })
}

export function updateCollectionItem(
  collectionId: string,
  restaurantId: string,
  patch: { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number },
): Promise<Collection> {
  return req(
    `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(restaurantId)}`,
    patch.remove ? 'DELETE' : 'PUT',
    patch.remove ? undefined : patch,
  )
}

export function deleteCollection(collectionId: string): Promise<{ ok: true }> {
  return req(`/collections/${encodeURIComponent(collectionId)}`, 'DELETE')
}

export function requestPublication(collectionId: string, shareItemIds: string[]): Promise<{ id: string; status: string; generation: number }> {
  return req(`/collections/${encodeURIComponent(collectionId)}/publication-requests`, 'POST', { share_item_ids: shareItemIds })
}

export function unpublish(collectionId: string): Promise<Collection> {
  return req(`/collections/${encodeURIComponent(collectionId)}/unpublish`, 'POST')
}

// ---------------- 公开分享快照（匿名可读，与 Web /s/:token 同一接口） ----------------

export function sharedSnapshot(token: string): Promise<SharedCollectionSnapshot> {
  return req(`/shared-collections/${encodeURIComponent(token)}`)
}

/** 已通过审核的图片公开 URL（未过审的图片不出现在快照里） */
export function mediaUrl(id: string): string {
  return `${BASE}/media/${encodeURIComponent(id)}`
}

// ---------------- 编辑背书（moderator / admin） ----------------

export function editorialEndorsement(input: { restaurant_id: string; action: 'verify' | 'revoke'; reason?: string }): Promise<Restaurant> {
  return req(`/admin/editorial-endorsements/${input.action}`, 'POST', input)
}

// ---------------- 后台审核（moderator / admin，否则 403） ----------------

export function moderationQueue(): Promise<ModerationQueueEntry[]> {
  return req('/admin/queue')
}

export function moderate(input: { target: string; action: 'approve' | 'reject' | 'hide'; reason?: string; expected_version: number }): Promise<{ ok: true }> {
  return req(`/admin/moderation/${encodeURIComponent(input.target)}/actions`, 'POST', {
    action: input.action,
    reason: input.reason,
    expected_version: input.expected_version,
  })
}

export function candidateQueue(status?: CandidateStatus | null): Promise<RestaurantCandidate[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return req(`/admin/candidates${qs}`)
}

export function decideCandidate(input: { id: string; action: 'verify' | 'reject' | 'merge'; reason?: string; target_restaurant_id?: string; expected_version: number }): Promise<RestaurantCandidate> {
  return req(`/admin/candidates/${encodeURIComponent(input.id)}/actions`, 'POST', {
    action: input.action,
    reason: input.reason,
    target_restaurant_id: input.target_restaurant_id,
    expected_version: input.expected_version,
  })
}

export function reportQueue(status?: ReportStatus | null): Promise<ReportQueueEntry[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return req(`/admin/reports${qs}`)
}

export function decideReport(input: { id: string; action: 'start' | 'resolve' | 'dismiss'; reason?: string; expected_version: number }): Promise<ReportQueueEntry> {
  return req(`/admin/reports/${encodeURIComponent(input.id)}/actions`, 'POST', {
    action: input.action,
    reason: input.reason,
    expected_version: input.expected_version,
  })
}

export function patchRestaurantStatus(input: { id: string; place_status?: PlaceVerificationStatus; business_status?: BusinessStatus; risk_status?: RiskStatus; reason?: string }): Promise<Restaurant> {
  return req(`/admin/restaurants/${encodeURIComponent(input.id)}/status`, 'PATCH', input)
}

export function mergeRestaurants(input: { source_id: string; target_id: string; reason: string; expected_version: number }): Promise<{ canonical: string }> {
  return req(`/admin/restaurants/${encodeURIComponent(input.source_id)}/merge`, 'POST', input)
}

export function auditLog(): Promise<AuditRec[]> {
  return req('/admin/audit-log')
}
