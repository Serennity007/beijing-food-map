export default {
  mini: {},
  h5: {
    /**
     * WebpackChain 插件配置（h5 专用）
     */
    webpackChain(chain) {},
    /**
     * 如果 h5 端编译后体积过大，可以使用 webpack-bundle-analyzer 插件对打包体积进行分析。
     */
    // webpackAnalyzer(){},
  },
}
