/**
 * 写路径 API 级验证（连本机 8787 全新库，替代被环境阻断的模拟器重启）。
 * 验证清单生命周期 + 后台处置 + 注销，路径/method/body 与 miniprogram/src/api.ts 完全一致。
 */
const BASE = 'http://127.0.0.1:8787/api/v1'

async function req(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = res.headers.get('set-cookie')
  const json = await res.json().catch(() => null)
  return { status: res.status, data: json?.data ?? null, error: json?.error ?? null, setCookie }
}

async function login(uid) {
  const r = await req('/auth/login', { method: 'POST', body: { user_id: uid, code: '888888' } })
  if (r.status !== 200) throw new Error(`login ${uid} failed: ${r.status} ${JSON.stringify(r.error)}`)
  const cookie = r.setCookie.split(';')[0]
  return { cookie, user: r.data.user }
}

const log = (...a) => console.log('[write-api]', ...a)

const TITLE = `写路径验证清单-${Date.now() % 100000}`

// 1) U01 新建清单
const u01 = await login('U01')
let r = await req('/collections', { method: 'POST', body: { title: TITLE, description: 'API 级验证' }, cookie: u01.cookie })
log('1 新建清单:', r.status, 'id=', r.data?.id, 'kind=', r.data?.kind, 'status=', r.data?.publication_status)
const cid = r.data.id

// 2) 加店 R01
r = await req(`/collections/${cid}/items/R01`, { method: 'PUT', body: { position: 0 }, cookie: u01.cookie })
log('2 加店 R01:', r.status, 'items=', r.data?.items?.length, 'version=', r.data?.version)

// 3) 发布申请
r = await req(`/collections/${cid}/publication-requests`, { method: 'POST', body: { share_item_ids: ['R01'] }, cookie: u01.cookie })
log('3 发布申请:', r.status, JSON.stringify(r.data))
const pubId = r.data?.id

// 4) A01 后台通过该发布申请
const a01 = await login('A01')
r = await req('/admin/queue', { cookie: a01.cookie })
const pubEntry = (r.data ?? []).find((e) => e.type === 'publication' && e.restaurant_name === TITLE)
log('4a 队列找到发布申请:', !!pubEntry, pubEntry ? `target=${pubEntry.id} v=${pubEntry.version}` : '')
if (!pubEntry) throw new Error('publication entry not in moderation queue')
r = await req(`/admin/moderation/${encodeURIComponent(pubEntry.id)}/actions`, { method: 'POST', body: { action: 'approve', expected_version: pubEntry.version }, cookie: a01.cookie })
log('4b 通过发布申请:', r.status, r.error ? JSON.stringify(r.error) : 'ok')

// 5) U01 确认已公开 + 令牌
r = await req('/collections', { cookie: u01.cookie })
const mine = (r.data ?? []).find((c) => c.id === cid)
log('5 已公开:', mine?.publication_status === 'PUBLISHED', 'active_token=', mine?.active_token)

// 6) U01 撤销分享
r = await req(`/collections/${cid}/unpublish`, { method: 'POST', cookie: u01.cookie })
log('6 撤销分享:', r.status, 'status=', r.data?.publication_status)

// 7) U01 删除清单
r = await req(`/collections/${cid}`, { method: 'DELETE', cookie: u01.cookie })
log('7 删除清单:', r.status)

// 8) U05 注销账号
const u05 = await login('U05')
r = await req('/me', { method: 'DELETE', cookie: u05.cookie })
log('8 注销 U05:', r.status, JSON.stringify(r.data))

console.log('[write-api] DONE')
process.exit(0)
