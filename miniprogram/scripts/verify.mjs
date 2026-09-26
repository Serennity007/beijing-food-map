/**
 * DevTools 自动化验证（M1）：
 * 通过微信开发者工具的自动化接口启动模拟器，检查首页地图/列表真实数据，并截图。
 * 前置：开发者工具已安装；「设置-安全-服务端口」开启；首次使用需在工具里扫码登录。
 * 运行：node scripts/verify.mjs
 */
import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CLI = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'

// Node 20+ spawn .bat 会 EINVAL（与 handover 里 npm.cmd 同款坑），因此
// DevTools 的自动化端口由外部 shell 先启动：cli.bat auto --project ... --auto-port 9420
// 这里只连接。
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })

try {
  const page = await mp.reLaunch('/pages/index/index')
  await page.waitFor(6000)

  // 函数组件的 React 状态不在 page.data() 里，用渲染元素做验证
  const cards = await page.$$('.card')
  const pill = await page.$('.pill')
  const pillText = pill ? await pill.text() : null
  const mapEl = await page.$('.the-map')
  console.log('[verify] index: pill =', JSON.stringify(pillText), '| cards =', cards.length, '| map =', !!mapEl)

  await mp.screenshot({ path: path.join(root, 'scripts', 'devtools-index.png') })

  // 进入详情页（用列表第一家的卡片）
  const firstCard = cards[0]
  if (firstCard) {
    await firstCard.tap()
    await page.waitFor(4000)
    const cur = await mp.currentPage()
    console.log('[verify] navigated to =', cur?.path)
    const h1 = await page.$('.h1')
    const price = await page.$('.price')
    console.log('[verify] detail: h1 =', JSON.stringify(h1 ? await h1.text() : null), '| price =', JSON.stringify(price ? await price.text() : null))
    await mp.screenshot({ path: path.join(root, 'scripts', 'devtools-detail.png') })
  }
  console.log('[verify] DONE')
} finally {
  await mp.close()
}
