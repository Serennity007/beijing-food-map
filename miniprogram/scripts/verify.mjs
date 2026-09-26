/**
 * 小程序端到端验证（开发模式，连本机 8787 后端）：
 * 登录 U01 → 我的页 → 投稿页（搜索选店→演示图→推荐提交，走引擎完整校验）→ 首页 → 详情收藏。
 * 运行前置：cli.bat auto 已挂起（自动化端口 9420）、本机后端存活。
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const shot = (n) => path.join(root, 'scripts', n)
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const log = (...a) => console.log('[e2e]', ...a)
mp.on('console', (msg) => {
  if (msg.type === 'error' || msg.type === 'warn') {
    const parts = (msg.args ?? []).map((a) => {
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a).slice(0, 180)
      } catch {
        return String(a)
      }
    })
    console.log('[console.' + msg.type + ']', parts.join(' ').slice(0, 240))
  }
})
mp.on('exception', (exc) => console.log('[exception]', (exc.message ?? '').slice(0, 200)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RETRY_DELAY = 3000

/** 页面方法在模拟器编译/挂载窗口期会抛协议错误：统一重试。 */
async function retry(fn, label, tries = 4) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      log(`retry ${i + 1}/${tries} (${label}): ${String(e.message).slice(0, 60)}`)
      await sleep(RETRY_DELAY)
    }
  }
  throw last
}

async function text(page, sel) {
  const el = await page.$(sel)
  return el ? await el.text() : null
}
async function tapByTextProbeGet(page, sel, want) {
  const els = await page.$$(sel)
  for (const el of els) {
    if ((await el.text()).includes(want)) return el
  }
  return null
}
async function tapByTextProbe(page, want) {
  const els = await page.$$('button')
  for (const el of els) {
    if ((await el.text()).includes(want)) return true
  }
  return false
}
async function tapByText(page, sel, want) {
  const els = await page.$$(sel)
  for (const el of els) {
    if ((await el.text()).includes(want)) {
      await el.tap()
      return true
    }
  }
  return false
}

// 1) 登录
const login = await retry(() => mp.reLaunch('/pages/login/index'), 'reLaunch login')
await login.waitFor(2500)
await retry(async () => {
  const inputs = await login.$$('input')
  await inputs[1].input('888888')
  await (await login.$('.btn-primary')).tap()
}, 'login submit')
await login.waitFor(2500)
log('logged in, current =', (await mp.currentPage()).path)

// 2) 我的页
const me = await retry(() => mp.switchTab('/pages/me/index'), 'switchTab me')
await me.waitFor(2500)
const sub = await text(me, '.sub')
log('me sub =', JSON.stringify(sub?.slice(0, 30)))

// 3) 投稿页：搜索→选店→演示图→菜品→理由→披露→提交
const submit = await retry(() => mp.switchTab('/pages/submit/index'), 'switchTab submit')
await submit.waitFor(2500)
await retry(async () => {
  await (await submit.$$('input'))[0].input('酸汤')
}, 'store search input')
await submit.waitFor(1500)
// 点选第一家命中门店：点击后轮询『清除选择』按钮出现，确认选择生效
await retry(async () => {
  await (await submit.$$('input'))[0].input('酸汤')
}, 'store search input', 6)
await submit.waitFor(2500)
let pickedOk = false
for (let i = 0; i < 5 && !pickedOk; i++) {
  const hitCards = await submit.$$('.card')
  log(`pick attempt ${i + 1}: hitCards =`, hitCards.length)
  if (!hitCards.length) {
    await sleep(2000)
    continue
  }
  // 优先点卡片内的『选为投稿对象』按钮（Button 合成 tap 可靠；View 整卡 tap 在自动化下不稳定）
  await retry(() => tapByText(submit, '.dish-chip', '选为投稿对象'), 'pick chip tap')
  await submit.waitFor(1200)
  const pickedCard = await submit.$('.card.picked')
  const clearBtn = await tapByTextProbe(submit, '清除选择')
  pickedOk = !!pickedCard || clearBtn
  log(`  picked-card probe = ${!!pickedCard}, clear-btn = ${clearBtn}`)
  if (!pickedOk) await sleep(1500)
}
if (!pickedOk) throw new Error('store pick did not take effect')
log('store picked')
await retry(async () => {
  const inputs = await submit.$$('input')
  if (!inputs[1]) throw new Error(`dish input not ready (inputs=${inputs.length})`)
  await inputs[1].input('酸汤鱼')
}, 'dish input', 8)
await retry(async () => {
  await (await submit.$$('textarea'))[0].input('自动化验证：酸汤发酵感明显，米粉软硬适中；这条用于演示小程序投稿全链路，共二十字以上。')
}, 'reason input')
await retry(() => tapByText(submit, '.chip', '无关联'), 'disclosure chip')
const okPhoto = await retry(() => tapByText(submit, 'button', '添加一张演示图片'), 'photo button')
log('photo tapped =', okPhoto)
await submit.waitFor(2000)
// 提交（页面上最后一个 btn-primary = 提交到审核）
await retry(async () => {
  const primaryBtns = await submit.$$('.btn-primary')
  await primaryBtns[primaryBtns.length - 1].tap()
}, 'feedback submit')
await submit.waitFor(3000)
const receipt = await text(submit, '.alert.ok')
const bad = await text(submit, '.alert.bad')
log('receipt =', JSON.stringify(receipt?.slice(0, 90)))
log('bad =', JSON.stringify(bad?.slice(0, 140)))
await mp.screenshot({ path: shot('devtools-submit.png') })

// 4) 首页 + 详情收藏
const index = await retry(() => mp.switchTab('/pages/index/index'), 'switchTab index')
await index.waitFor(4000)
const cards = await index.$$('.card')
const idxPill = await text(index, '.pill')
log('index cards =', cards.length, '| pill =', JSON.stringify(idxPill))
const detail = await retry(() => mp.reLaunch('/pages/detail/index?id=R01'), 'reLaunch detail')
await detail.waitFor(4000)
const favChips = await detail.$$('.chip')
for (const c of favChips) {
  if ((await c.text()).includes('想吃')) {
    await retry(() => c.tap(), 'fav tap')
    break
  }
}
await detail.waitFor(1500)
const notice = await text(detail, '.alert.ok')
log('fav notice =', JSON.stringify(notice))
await mp.screenshot({ path: shot('devtools-detail-fav.png') })

console.log('[e2e] DONE')
process.exit(0)
