/**
 * 小程序 UI 写路径端到端（DevTools 自动化 + 本机 8787 后端 + 全新 SQLite）。
 * 覆盖上一轮只验到 API 级的三条链路（交接 2026-09-27 §4.2）：
 *   1) 清单管理：新建清单 → 搜索加店 → 提交发布 → A01 后台通过 → 已公开+令牌 → 撤销分享 → 删除清单
 *   2) 后台处置：待审队列「通过」一条发布申请（moderation API 的 UI 路径）
 *   3) 投稿撤回：详情页「撤回」→ showModal 确认 → 反馈撤回
 *   4) 账号注销：me 页「注销账号」→ showModal 确认 → 会话清除（放最后，U05 专用）
 * showModal 用 mockWxMethod 全局自动确认；只连真后端，不 mock 任何业务接口。
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const log = (...a) => console.log('[e2e-write-ui]', ...a)
const results = []
function check(label, ok) {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${label}`)
}
mp.on('console', (msg) => {
  if (msg.type === 'error') {
    const parts = (msg.args ?? []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a).slice(0, 160)))
    console.log('[console.error]', parts.join(' ').slice(0, 200))
  }
})
mp.on('exception', (exc) => console.log('[exception]', (exc.message ?? '').slice(0, 200)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
/** 找到文本含 want 的 .card，点它内部文本含 btnText 的按钮 */
async function tapBtnInCard(page, want, btnText) {
  const cards = await page.$$('.card')
  for (const c of cards) {
    try {
      if (!(await c.text()).includes(want)) continue
      const btns = await c.$$('button')
      for (const b of btns) {
        if ((await b.text()).includes(btnText)) {
          await b.tap()
          return true
        }
      }
    } catch {}
  }
  return false
}
async function shot(mp, name) {
  await mp.screenshot({ path: path.join(root, '..', 'docs', 'render-check', name) })
}
async function loginAs(mp, uid) {
  const login = await retry(() => mp.reLaunch('/pages/login/index'), `reLaunch login ${uid}`)
  await login.waitFor(2500)
  await retry(async () => {
    const inputs = await login.$$('input')
    await inputs[0].input(uid)
    await inputs[1].input('888888')
    await (await login.$('.btn-primary')).tap()
  }, `login ${uid}`)
  await login.waitFor(2500)
  log('logged in as', uid, '→', (await mp.currentPage()).path)
}

// showModal 全局自动确认（撤销分享/删除清单/撤回反馈/注销的确认弹窗）
await mp.mockWxMethod('showModal', { confirm: true, cancel: false })

const TITLE = '测试·UI写路径验证清单'

// ===== 1) U01：新建清单 =====
await loginAs(mp, 'U01')
const me0 = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me U01')
await me0.waitFor(2500)
check('me 页有 新建清单', await hasText(me0, '新建清单'))
check('me 页有 注销账号', await hasText(me0, '注销账号'))
await retry(() => tapBtn(me0, '新建清单'), 'tap 新建清单')
await me0.waitFor(800)
const meInputs = await me0.$$('input')
await meInputs[0].input(TITLE)
await retry(() => tapBtn(me0, '创建'), 'tap 创建')
await me0.waitFor(2000)
check('新建清单成功提示', await hasText(me0, '已创建，点它进入编辑与发布'))

// ===== 2) U01：进入清单编辑 → 搜索加店 =====
await retry(async () => {
  const rows = await me0.$$('.row')
  for (const r of rows) {
    if ((await r.text()).includes(TITLE)) {
      await r.tap()
      return true
    }
  }
  throw new Error('new collection row not found')
}, 'tap new collection row')
await sleep(2500)
const ce = await mp.currentPage()
check('进入 collection-edit', ce.path === 'pages/collection-edit/index')
const ceInputs = await ce.$$('input')
await ceInputs[0].input('酸汤粉')
await sleep(1500)
check('搜索命中平台收录门店', await hasText(ce, '测试·黔江酸汤粉'))
await retry(() => tapBtn(ce, '加入清单'), 'tap 加入清单')
await ce.waitFor(2000)
check('加店成功提示', await hasText(ce, '已加入清单末尾。'))
await shot(mp, '45-miniprogram-ui-collection-items.png')

// ===== 3) U01：提交发布申请 =====
await retry(() => tapBtn(ce, '提交发布'), 'tap 提交发布')
await ce.waitFor(2500)
const pubNotice = (await text(ce, '.alert.ok')) ?? ''
const pubId = (pubNotice.match(/PUB\w+/) ?? [])[0]
check('发布申请受理提示（编号 PUB…）', Boolean(pubId))
log('pubId =', pubId)
await shot(mp, '46-miniprogram-ui-publish-pending.png')

// ===== 4) A01：后台待审队列通过该发布申请 =====
await loginAs(mp, 'A01')
const admin = await retry(() => mp.navigateTo('/pages/admin/index'), 'navigateTo admin')
await admin.waitFor(3500)
check('后台待审队列出现该发布申请', await hasText(admin, pubId))
await retry(() => tapBtnInCard(admin, pubId, '通过'), `tap 通过 ${pubId}`)
await admin.waitFor(2500)
check('后台处置成功提示', await hasText(admin, `已处置 ${pubId}`))
await shot(mp, '47-miniprogram-ui-admin-approved.png')

// ===== 5) U01：清单已公开（令牌）→ 撤销分享 → 删除清单 =====
await loginAs(mp, 'U01')
const me1 = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me U01 again')
await me1.waitFor(2500)
await retry(async () => {
  const rows = await me1.$$('.row')
  for (const r of rows) {
    if ((await r.text()).includes(TITLE)) {
      await r.tap()
      return true
    }
  }
  throw new Error('collection row not found after approve')
}, 'reopen collection row')
await sleep(2500)
const ce2 = await mp.currentPage()
check('清单徽标已公开', await hasText(ce2, '已公开'))
check('展示生效令牌', await hasText(ce2, '已公开，生效令牌 tok-'))
await shot(mp, '48-miniprogram-ui-published.png')
await retry(() => tapBtn(ce2, '撤销分享'), 'tap 撤销分享')
await ce2.waitFor(2500)
check('撤销分享成功提示', await hasText(ce2, '已撤销公开，旧链接永久失效。'))
await retry(() => tapBtn(ce2, '删除清单'), 'tap 删除清单')
await ce2.waitFor(2500)
const me2 = await retry(() => mp.reLaunch('/pages/me/index'), 'relaunch me after delete')
await me2.waitFor(2500)
check('清单已从列表消失', !(await hasText(me2, TITLE)))

// ===== 6) U01：详情撤回我的反馈 =====
const detail = await retry(() => mp.reLaunch('/pages/detail/index?id=R01'), 'reLaunch detail R01')
await detail.waitFor(3500)
check('详情显示我的反馈区', await hasText(detail, '已有一条我的反馈'))
await retry(() => tapBtn(detail, '撤回'), 'tap 撤回')
await detail.waitFor(2500)
check('撤回成功提示（票数重算）', await hasText(detail, '已撤回，本店票数已重算'))
const detail2 = await retry(() => mp.reLaunch('/pages/detail/index?id=R01'), 'reLaunch detail R01 again')
await detail2.waitFor(3500)
check('重进详情后反馈区消失', !(await hasText(detail2, '已有一条我的反馈')))
await shot(mp, '49-miniprogram-ui-feedback-withdrawn.png')

// ===== 7) U05：注销账号（放最后）=====
await loginAs(mp, 'U05')
const me3 = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me U05')
await me3.waitFor(2500)
await retry(() => tapBtn(me3, '注销账号'), 'tap 注销账号')
await me3.waitFor(3000)
check('注销后回到未登录态（出现 内测登录）', await hasText(me3, '内测登录'))
check('注销后清单/投稿区消失', !(await hasText(me3, '我的清单')))
await shot(mp, '50-miniprogram-ui-account-deleted.png')

const failed = results.filter((r) => !r.ok)
console.log(`\n[e2e-write-ui] ${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log('[e2e-write-ui] FAILED:', failed.map((f) => f.label).join(' | '))
  process.exit(1)
}
console.log('[e2e-write-ui] DONE')
process.exit(0)
