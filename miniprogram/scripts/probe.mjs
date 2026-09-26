import automator from 'miniprogram-automator'
// 连接轮询：端口起来就连，连上后依次试 systemInfo / pageStack
for (let i = 0; i < 30; i++) {
  try {
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' })
    console.log('[probe] connected on attempt', i + 1)
    const sys = await Promise.race([
      mp.systemInfo(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('systemInfo timeout')), 20000)),
    ])
    console.log('[probe] SDK =', sys.SDKVersion, '| platform =', sys.platform)
    const stack = await Promise.race([
      mp.pageStack(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('pageStack timeout')), 20000)),
    ])
    console.log('[probe] pageStack =', stack.map((p) => p.path).join(' > '))
    console.log('[probe] DONE')
    process.exit(0)
  } catch (e) {
    console.log(`[probe] attempt ${i + 1}: ${e.message.slice(0, 60)}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
}
console.log('[probe] GIVE UP after 30 attempts')
process.exit(1)
