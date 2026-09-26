/**
 * 小程序新功能端到端验证（开发模式，连本机 8787 后端）：
 * A01（admin）→ 后台页（待审队列/地点核验/举报复核/门店状态/合并/审计）
 * U01 → 我的页（内容后台入口/新建清单/注销）→ 清单编辑 COL0001 → 详情 R01 修订入口 → 修订页。
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const log = (...a) => console.log('[e2e-new]', ...a)
mp.on('console', (msg) => {
  if (msg.type === 'error' || msg.type === 'warn') {
    const parts = (msg.args ?? []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a).slice(0, 160)))
    console.log('[console.' + msg.type + ']', parts.join(' ').slice(0, 240))
  }
})
mp.on('exception', (exc) => console.log('[exception]', (exc.message ?? '').slice(0, 200)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RETRY = 3200

async function retry(fn, label, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      log(`retry ${i + 1}/${tries} (${label}): ${String(e.message).slice(0, 60)}`)
      await sleep(RETRY)
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
async function loginAs(page, uid) {
  const login = await retry(() => mp.reLaunch('/pages/login/index'), 'reLaunch login')
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

// 1) A01 → 后台页
await loginAs(mp, 'A01')
const admin = await retry(() => mp.navigateTo('/pages/admin/index'), 'navigateTo admin')
await admin.waitFor(3500)
log('admin head =', JSON.stringify((await text(admin, '.h1'))?.slice(0, 20)))
log('has 待审队列 =', await hasText(admin, '待审队列'))
log('has 合并 tab =', await hasText(admin, '合并'))
log('has 审计日志 tab =', await hasText(admin, '审计日志'))
const adminShot = path.join(root, '..', 'docs', 'render-check', '37-miniprogram-admin.png')
await mp.screenshot({ path: adminShot })

// 2) A01 → 我的页（内容后台入口）
const meA = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me')
await meA.waitFor(2500)
log('meA has 内容后台 =', await hasText(meA, '内容后台'))
log('meA has 注销账号 =', await hasText(meA, '注销账号'))

// 3) U01 → 我的页 → 清单编辑
await loginAs(mp, 'U01')
const me = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me U01')
await me.waitFor(2500)
log('me has 新建清单 =', await hasText(me, '新建清单'))
// 点第一个清单行（含标题文本）
await retry(async () => {
  const rows = await me.$$('.row')
  for (const r of rows) {
    const t = await r.text()
    if (t.includes('测试·我的贵州踩点图')) {
      await r.tap()
      return true
    }
  }
  throw new Error('collection row not found')
}, 'tap collection row')
await me.waitFor(2500)
const ce = await mp.currentPage()
log('collection-edit path =', ce.path)
log('ce title =', JSON.stringify((await text(ce, '.h1'))?.slice(0, 20)))
log('ce has 提交发布 =', await hasText(ce, '提交发布'))
log('ce has 删除清单 =', await hasText(ce, '删除清单'))
log('ce has 撤销分享 =', await hasText(ce, '撤销分享'))
const ceShot = path.join(root, '..', 'docs', 'render-check', '38-miniprogram-collection-edit.png')
await mp.screenshot({ path: ceShot })

// 4) U01 → 详情 R01 → 修订页
const detail = await retry(() => mp.reLaunch('/pages/detail/index?id=R01'), 'reLaunch detail')
await detail.waitFor(3500)
log('detail has 已有一条我的反馈 =', await hasText(detail, '已有一条我的反馈'))
log('detail has 修改这条 =', await hasText(detail, '修改这条'))
log('detail has 撤回 =', await hasText(detail, '撤回'))
await retry(() => tapBtn(detail, '修改这条'), 'tap 修改这条')
await detail.waitFor(2500)
const rev = await mp.currentPage()
log('revise path =', rev.path)
log('revise title =', JSON.stringify((await text(rev, '.h1'))?.slice(0, 20)))
log('revise has 提交新版本 =', await hasText(rev, '提交新版本到审核'))
const revShot = path.join(root, '..', 'docs', 'render-check', '39-miniprogram-revise.png')
await mp.screenshot({ path: revShot })

console.log('[e2e-new] DONE')
process.exit(0)
