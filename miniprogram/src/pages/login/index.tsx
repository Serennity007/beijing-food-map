/**
 * 内测登录：与 Web 端同一组演示账号与固定码（仅非生产环境存在）。
 * 会话由后端下发的签名 Cookie 承载，本层只存取不解析。
 */
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import { login, ApiError } from '../../api'
import './index.scss'

const ACCOUNTS = ['U01', 'U02', 'U03', 'U04', 'U05', 'E01', 'M01', 'A01']

export default function Login() {
  const [userId, setUserId] = useState('U01')
  const [code, setCode] = useState('888888')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doLogin() {
    setBusy(true)
    setError(null)
    try {
      const user = await login(userId, code.trim())
      Taro.setStorageSync('qw.user', user)
      await Taro.showToast({ title: `已登录：${user.display_name}`, icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 600)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">登录</Text>
        <Text className="sub">当前部署使用预置的合成邀请账号，不发送真实短信。验证码固定为 888888，只在演示环境有效。</Text>
      </View>

      <View className="panel">
        <Text className="label">选择账号</Text>
        <View className="chips">
          {ACCOUNTS.map((a) => (
            <Text
              key={a}
              className={userId === a ? 'chip active' : 'chip'}
              onClick={() => setUserId(a)}
            >
              {a}
            </Text>
          ))}
        </View>
        <View className="field">
          <Text className="label">账号 ID</Text>
          <Input value={userId} onInput={(e) => setUserId(e.detail.value)} />
        </View>
        <View className="field">
          <Text className="label">验证码</Text>
          <Input className="f-code" value={code} onInput={(e) => setCode(e.detail.value)} />
        </View>
        {error && <Text className="err">{error}</Text>}
        <Button className="btn-primary" disabled={busy} onClick={() => void doLogin()}>
          {busy ? '登录中…' : '登录'}
        </Button>
      </View>

      <Text className="hint">
        写投稿、收藏、举报需要登录；地图浏览不需要。生产环境将替换为服务端短信验证码（短时、单次）。
      </Text>
    </View>
  )
}
