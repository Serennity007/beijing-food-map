import automator from 'miniprogram-automator'
const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
const page = await mp.reLaunch('/pages/login/index')
await page.waitFor(2500)
for (const sel of ['input', '.f-code', 'taro-input-core', '.btn-primary', 'button', '.chip', 'text']) {
  try {
    const els = await page.$$(sel)
    console.log('[probe-sel]', sel, '->', els.length)
    if (sel === 'input' && els.length) console.log('[probe-sel] input0 class =', await els[0].className ?? '(n/a)')
  } catch (e) {
    console.log('[probe-sel]', sel, 'ERR', String(e.message).slice(0, 50))
  }
}
process.exit(0)
