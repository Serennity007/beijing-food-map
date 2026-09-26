import { Component, PropsWithChildren } from 'react'
import './app.scss'

export default class App extends Component<PropsWithChildren> {
  /** 运行时错误直打控制台：自动化环境里 Error 对象序列化为空，只有字符串能出来。 */
  onError(msg: string): void {
    console.error('[app-onError]', msg)
  }

  render() {
    return this.props.children
  }
}
