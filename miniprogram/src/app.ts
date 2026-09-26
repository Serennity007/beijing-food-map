import { Component, PropsWithChildren } from 'react'

export default class App extends Component<PropsWithChildren> {
  render() {
    return this.props.children
  }
}
