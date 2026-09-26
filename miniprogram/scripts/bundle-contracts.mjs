/**
 * 把共享契约包 @qianwei/contracts（packages/contracts/src，纯 TS 源码）预打包成
 * 单个 CJS 文件供小程序使用。Taro 的 babel 规则不覆盖符号链接到 node_modules 之外的
 * 真实路径，预打包是最稳的接入方式；构建 weapp 前自动执行（prebuild 脚本）。
 */
import { build } from 'esbuild'

await build({
  entryPoints: ['../packages/contracts/src/index.ts'],
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: ['es2018'],
  outfile: 'src/vendor/contracts.js',
  sourcemap: false,
  logLevel: 'info',
})
