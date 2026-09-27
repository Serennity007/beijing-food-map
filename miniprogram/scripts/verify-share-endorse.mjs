/**
 * 分享只读页 + 编辑背书 tab 的端到端验证（DevTools 自动化 + 本机 8787 + 全新 SQLite）。
 * 数据准备走真实 HTTP（登录/建清单/加店/发布/A01 通过），UI 断言走模拟器：
 *   1) pages/share：有效 token 渲染快照全要素；无效 token 显示「链接无效或已撤销」
 *   2) collection-edit 的「预览公开页」入口跳转 share 页
 *   3) admin 编辑背书 tab：检索 R05（E01 的 ACTIVE 背书）→ 显示背书要素 → 核验 → 撤销（理由必填）
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://127.0.0.1:8787/api/v1'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const log = (...a) => console.log('[e2e-share-endorse]', ...a)
const results = []
function check(label, ok) {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${label}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(path, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const setCookie = r.headers.get('set-cookie')
  const json = await r.json()
  if (!r.ok || json.error) throw new Error(`${path} → ${r.status} ${JSON.stringify(json.error ?? {})} `)
  return { data: json.data, cookie: setCookie ? setCookie.split(';')[0] : undefined }
}
async function login(uid) {
  return (await api('/auth/login', { method: 'POST', body: { user_id: uid, code: '888888' } })).cookie
}

// ===== 数据准备（HTTP）=====
const u01 = await login('U01')
const col = (
  await api('/collections', { method: 'POST', body: { title: '测试·分享快照验证', description: '分享页端到端验证用清单' }, cookie: u01 })
).data
log('collection =', col.id)
await api(`/collections/${col.id}/items/R01`, { method: 'PUT', body: { note: '分享页验证笔记：酸汤锅底两人份。', note_shareable: true }, cookie: u01 })
const pub = (
  await api(`/collections/${col.id}/publication-requests`, { method: 'POST', body: { share_item_ids: ['R01'] }, cookie: u01 })
).data
log('publication =', pub.id, pub.status)
const a01 = await login('A01')
const queue = (await api('/admin/queue', { cookie: a01 })).data
const entry = queue.find((e) => e.id === pub.id)
if (!entry) throw new Error(`publication ${pub.id} not in queue`)
await api(`/admin/moderation/${pub.id}/actions`, { method: 'POST', body: { action: 'approve', expected_version: entry.version }, cookie: a01 })
const cols = (await api('/collections', { cookie: u01 })).data
const published = cols.find((c) => c.id === col.id)
const token = published?.active_token
if (!token) throw new Error('active_token missing after approve')
log('active_token =', token)

// ===== UI 断言 =====
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
mp.on('console', (msg) => {
  if (msg.type === 'error') {
    const parts = (msg.args ?? []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a).slice(0, 160)))
    console.log('[console.error]', parts.join(' ').slice(0, 200))
  }
})
async function text(page, sel) {
  const el = await page.$(sel)
  return el ? await el.text() : null
}
async function hasText(page, want) {
  for (const sel of ['text', 'button']) {
    const els = await page.$$(sel)
    for (const el of els) {
      try {
        if ((await el.text()).includes(want)) return true
      } catch {}
    }
  }
  return false
}
async function tapBtn(page, want) {
  const els = await page.$$('button')
  for (const el of els) {
    try {
      if ((await el.text()).includes(want)) {
        await el.tap()
        return true
      }
    } catch {}
  }
  return false
}
async function shot(name) {
  await mp.screenshot({ path: path.join(root, '..', 'docs', 'render-check', name) })
}
async function retry(fn, label, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      log(`retry ${i + 1}/${tries} (${label}): ${String(e.message).slice(0, 60)}`)
      await sleep(3200)
    }
  }
  throw last
}
async function loginAs(uid) {
  const login = await retry(() => mp.reLaunch('/pages/login/index'), `reLaunch login ${uid}`)
  await login.waitFor(2500)
  await retry(async () => {
    const inputs = await login.$$('input')
    await inputs[0].input(uid)
    await inputs[1].input('888888')
    await (await login.$('.btn-primary')).tap()
  }, `login ${uid}`)
  await login.waitFor(2500)
  log('logged in as', uid)
}

// 1) 有效 token → 快照渲染
const share = await retry(() => mp.reLaunch(`/pages/share/index?token=${encodeURIComponent(token)}`), 'reLaunch share')
await share.waitFor(3500)
check('分享页标题', await hasText(share, '测试·分享快照验证'))
check('分享页门店条目', await hasText(share, '测试·黔江酸汤粉'))
check('分享页快照笔记', await hasText(share, '分享页验证笔记'))
check('分享页不可变快照提示', await hasText(share, '不可变快照'))
check('分享页作者信息', await hasText(share, '作者 测试食客01'))
await shot('51-miniprogram-ui-share-snapshot.png')

// 2) 无效 token → 撤销/无效提示
const bad = await mp.navigateTo('/pages/share/index?token=tok-not-exist')
await bad.waitFor(3000)
check('无效 token 提示', await hasText(bad, '链接无效或已撤销'))
await bad.waitFor(500)

// 3) collection-edit 的「预览公开页」入口
await loginAs('U01')
const me = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me')
await me.waitFor(2500)
await retry(async () => {
  const rows = await me.$$('.row')
  for (const r of rows) {
    if ((await r.text()).includes('测试·分享快照验证')) {
      await r.tap()
      return true
    }
  }
  throw new Error('collection row not found')
}, 'open collection row')
await sleep(2500)
const ce = await mp.currentPage()
check('清单编辑页显示 预览公开页 按钮', await hasText(ce, '预览公开页'))
await retry(() => tapBtn(ce, '预览公开页'), 'tap 预览公开页')
await sleep(2500)
const share2 = await mp.currentPage()
check('入口跳转到分享页且渲染快照', share2.path === 'pages/share/index' && (await hasText(share2, '测试·分享快照验证')))
await shot('52-miniprogram-ui-share-entry.png')

// 4) admin 编辑背书 tab：R05（E01 的 ACTIVE 背书）→ 展示 → 核验 → 撤销
await loginAs('A01')
const admin = await retry(() => mp.navigateTo('/pages/admin/index'), 'navigateTo admin')
await admin.waitFor(3500)
await retry(async () => {
  const chips = await admin.$$('.chip')
  for (const c of chips) {
    if ((await c.text()).includes('编辑背书')) {
      await c.tap()
      return true
    }
  }
  throw new Error('endorsement chip not found')
}, 'tap 编辑背书 tab')
await admin.waitFor(1200)
check('背书规则提示（180 天窗口 / 作者本人 FORBIDDEN）', await hasText(admin, '重新核验不会把到期日往后推'))
const admInputs = await admin.$$('input')
await admInputs[0].input('蜀香')
await sleep(1500)
check('检索到 R05 蜀香居', await hasText(admin, '测试·蜀香居'))
await retry(async () => {
  const cards = await admin.$$('.card')
  for (const c of cards) {
    if ((await c.text()).includes('测试·蜀香居')) {
      const btns = await c.$$('button')
      for (const b of btns) {
        if ((await b.text()).includes('载入该门店')) {
          await b.tap()
          return true
        }
      }
    }
  }
  throw new Error('R05 card not found')
}, 'load R05')
await admin.waitFor(3000)
check('背书状态徽标 背书有效', await hasText(admin, '背书有效'))
check('背书作者（显示名）', await hasText(admin, '作者 测试编辑01'))
check('有效期展示', await hasText(admin, '有效期至'))
await shot('53-miniprogram-ui-endorsement.png')
await retry(async () => {
  const btns = await admin.$$('button')
  for (const b of btns) {
    if ((await b.text()) === '核验') {
      await b.tap()
      return true
    }
  }
  throw new Error('核验 button not found')
}, 'tap 核验')
await admin.waitFor(3000)
check('核验成功提示', await hasText(admin, '背书已核验，当前状态 背书有效'))
// 撤销必填理由：先填 textarea 再点撤销
const reasonAreas = await admin.$$('textarea')
await reasonAreas[0].input('验证用撤销理由：复核发现信息与门店不一致')
await retry(() => tapBtn(admin, '撤销'), 'tap 撤销')
await admin.waitFor(3000)
check('撤销成功提示（票数重算）', await hasText(admin, '背书已撤销'))
check('撤销后状态徽标变为 背书已撤销', await hasText(admin, '背书已撤销'))
await shot('54-miniprogram-ui-endorsement-revoked.png')

const failed = results.filter((r) => !r.ok)
console.log(`\n[e2e-share-endorse] ${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log('[e2e-share-endorse] FAILED:', failed.map((f) => f.label).join(' | '))
  process.exit(1)
}
console.log('[e2e-share-endorse] DONE')
process.exit(0)
