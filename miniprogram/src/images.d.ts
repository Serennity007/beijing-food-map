/** 静态图片资源以 URL 字符串参与构建（Taro/webpack 处理），给 tsc 一个模块声明 */
declare module '*.png' {
  const src: string
  export default src
}
