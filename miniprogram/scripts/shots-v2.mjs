/** 设计系统 v2 截图：首页/详情/我的/后台/投稿（DevTools 自动化，只读） */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shot = (n) => mp.screenshot({ path: path.join(root, '..', 'docs', 'render-check', n) })

// 首页
const index = await mp.reLaunch('/pages/index/index')
await index.waitFor(3500)
await shot('60-miniprogram-v2-index.png')
console.log('[v2-shots] index done')

// 详情 R01
const detail = await mp.reLaunch('/pages/detail/index?id=R01')
await detail.waitFor(3500)
await shot('61-miniprogram-v2-detail.png')
console.log('[v2-shots] detail done')

// 登录 A01 → 我的
const login = await mp.reLaunch('/pages/login/index')
await login.waitFor(2500)
const inputs = await login.$$('input')
await inputs[0].input('A01')
await inputs[1].input('888888')
await (await login.$('.btn-primary')).tap()
await login.waitFor(2500)
const me = await mp.switchTab('/pages/me/index')
await me.waitFor(2500)
await shot('62-miniprogram-v2-me.png')
console.log('[v2-shots] me done')

// 后台
const admin = await mp.navigateTo('/pages/admin/index')
await admin.waitFor(3500)
await shot('63-miniprogram-v2-admin.png')
console.log('[v2-shots] admin done')

// 投稿
const submit = await mp.reLaunch('/pages/submit/index')
await submit.waitFor(3000)
await shot('64-miniprogram-v2-submit.png')
console.log('[v2-shots] submit done')
process.exit(0)
