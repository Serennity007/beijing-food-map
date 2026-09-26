import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
// 投稿页
const submit = await mp.reLaunch('/pages/submit/index')
await submit.waitFor(2500)
await mp.screenshot({ path: path.join(root, 'scripts', 'shot-submit.png') })
// 我的页
const me = await mp.switchTab('/pages/me/index')
await me.waitFor(2000)
await mp.screenshot({ path: path.join(root, 'scripts', 'shot-me.png') })
// 首页(带 tabBar 图标)
const index = await mp.switchTab('/pages/index/index')
await index.waitFor(3500)
await mp.screenshot({ path: path.join(root, 'scripts', 'shot-index.png') })
console.log('[shots] saved submit/me/index')
process.exit(0)
