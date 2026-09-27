/**
 * 完整对齐轮验证：法律页（隐私/条款）、me 页入口、地图搜索「在地图查看」、 polish 回归。
 * 只读为主（不写数据），连本机 8787 后端。
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const log = (...a) => console.log('[e2e-polish]', ...a)
const results = []
function check(label, ok) {
  results.push({ label, ok })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} - ${label}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
async function tapText(page, want) {
  for (const sel of ['text', 'button']) {
    const els = await page.$$(sel)
    for (const el of els) {
      try {
        if ((await el.text()).includes(want)) {
          await el.tap()
          return true
        }
      } catch {}
    }
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

// 1) 法律页 · 隐私
const privacy = await retry(() => mp.reLaunch('/pages/legal/index?kind=privacy'), 'reLaunch privacy')
await privacy.waitFor(2500)
check('隐私标题', await hasText(privacy, '隐私说明'))
check('收集什么区块', await hasText(privacy, '我们收集什么'))
check('删除与注销区块', await hasText(privacy, '删除与注销'))
await shot('55-miniprogram-ui-legal-privacy.png')

// 2) 法律页 · 条款（页内切换）
await retry(() => tapText(privacy, '切换到用户条款'), 'tap switch to terms')
await privacy.waitFor(1500)
check('条款标题', await hasText(privacy, '用户条款'))
check('推荐规则区块', await hasText(privacy, '推荐是怎么来的'))
check('免责声明', await hasText(privacy, '演示版免责声明'))
await shot('56-miniprogram-ui-legal-terms.png')

// 3) me 页：法律入口（后端切库后旧会话失效，先登录）
await loginAs('A01')
const me = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me')
await me.waitFor(2500)
check('me 页有 隐私说明 入口', await hasText(me, '隐私说明'))
check('me 页有 用户条款 入口', await hasText(me, '用户条款'))
await shot('57-miniprogram-ui-me-legal.png')

// 4) 地图页：搜索 → 在地图查看
const index = await retry(() => mp.switchTab('/pages/index/index'), 'switchTab index')
await index.waitFor(3000)
check('首页织带标题（好店列表）', await hasText(index, '好店列表'))
const inputs = await index.$$('input')
await inputs[0].input('酸汤')
await index.waitFor(2000)
check('搜索命中门店', await hasText(index, '测试·黔江酸汤粉'))
check('搜索结果带 在地图查看', await hasText(index, '在地图查看'))
await retry(() => tapText(index, '在地图查看'), 'tap 在地图查看')
await index.waitFor(1200)
check('查看地图后页面仍正常', (await mp.currentPage()).path === 'pages/index/index')
await shot('58-miniprogram-ui-index-flyto.png')

// 5) 回归：admin 编辑背书 tab 仍在
const admin = await retry(() => mp.navigateTo('/pages/admin/index'), 'navigateTo admin')
await admin.waitFor(3500)
check('admin 编辑背书 tab 存在', await hasText(admin, '编辑背书'))
check('admin 七分区（审计日志）存在', await hasText(admin, '审计日志'))
await shot('59-miniprogram-ui-admin-polish.png')

const failed = results.filter((r) => !r.ok)
console.log(`\n[e2e-polish] ${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log('[e2e-polish] FAILED:', failed.map((f) => f.label).join(' | '))
  process.exit(1)
}
console.log('[e2e-polish] DONE')
process.exit(0)
