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

  const data = await page.data()
  console.log('[verify] totalMatched =', data.totalMatched)
  console.log('[verify] list =', (data.list ?? []).map((r) => `${r.id} ${r.name}`).join(' ; '))
  console.log('[verify] markers =', (data.markers ?? []).length, 'error =', data.error)

  const sys = await mp.systemInfo()
  console.log('[verify] SDKVersion =', sys.SDKVersion, 'platform =', sys.platform)

  await mp.screenshot({ path: path.join(root, 'scripts', 'devtools-index.png') })

  // 进入详情页
  const first = (data.list ?? [])[0]
  if (first) {
    const detail = await mp.reLaunch('/pages/detail/index?id=' + first.id)
    await detail.waitFor(4000)
    const dd = await detail.data()
    console.log('[verify] detail =', dd.d ? `${dd.d.name} | ${dd.d.address?.slice(0, 24)} | in_default_layer=${dd.d.in_default_layer}` : `error=${dd.error}`)
    await mp.screenshot({ path: path.join(root, 'scripts', 'devtools-detail.png') })
  }
  console.log('[verify] DONE')
} finally {
  await mp.close()
}
