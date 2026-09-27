import path from 'node:path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport = {
    projectName: 'qianwei-miniprogram',
    date: '2026-9-26',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: 'webpack5',
    // 契约包经 esbuild 预打包为 src/vendor/contracts.js（prebuild 脚本），
    // 把与 Web 端相同的导入名映射到打包产物。
    // alias 是 Taro 顶层配置项（webpack5-runner 只读 config.alias），放在 mini 里不生效
    alias: {
      '@qianwei/contracts': path.resolve(process.cwd(), 'src/vendor/contracts.js'),
    },
    mini: {},
    h5: {},
  }
  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
