import automator from 'miniprogram-automator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const page = await mp.currentPage()
console.log('[shot] current =', page?.path)
const inputs = await page.$$('input')
console.log('[shot] inputs =', inputs.length)
for (const i of inputs) console.log('[shot] input value =', JSON.stringify(await i.input?.valueOf?.() ?? '(n/a)'))
const cards = await page.$$('.card')
console.log('[shot] cards =', cards.length)
await mp.screenshot({ path: path.join(root, 'scripts', 'submit-now.png') })
console.log('[shot] saved')
process.exit(0)
