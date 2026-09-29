/**
 * 登录页：手机验证码登录（真实路径）+ 演示邀请账号（仅非生产部署存在）。
 * 会话由后端下发的签名 Cookie 承载，本层只存取不解析。
 */
import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Button } from '@tarojs/components'
import { fetchMeta, login, phoneCode, phoneLogin, ApiError } from '../../api'
import './index.scss'

const ACCOUNTS = ['U01', 'U02', 'U03', 'U04', 'U05', 'E01', 'M01', 'A01']

export default function Login() {
  const [isDemoDeploy, setIsDemoDeploy] = useState(false)
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendHint, setSendHint] = useState<string | null>(null)
  const [userId, setUserId] = useState('U01')
  const [code, setCode] = useState('888888')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchMeta().then((m) => setIsDemoDeploy(m.env !== 'production')).catch(() => setIsDemoDeploy(true))
  }, [])

  function fail(e: unknown): void {
    setError(e instanceof ApiError ? e.message : '操作失败，请稍后重试')
  }

  function afterLogin(user: { display_name: string }): void {
    Taro.setStorageSync('qw.user', user)
    void Taro.showToast({ title: `已登录：${user.display_name}`, icon: 'none' })
    setTimeout(() => Taro.switchTab({ url: '/pages/index/index' }), 600)
  }

  async function doSendCode() {
    setSendBusy(true)
    setSendHint(null)
    try {
      const r = await phoneCode(phone.trim())
      setCodeSent(true)
      setSendHint(`验证码已发送，${r.ttl_seconds} 秒内有效`)
    } catch (e) {
      setSendHint(null)
      fail(e)
    } finally {
      setSendBusy(false)
    }
  }

  async function doPhoneLogin() {
    setBusy(true)
    setError(null)
    try {
      const user = await phoneLogin(phone.trim(), smsCode.trim())
      afterLogin(user)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function doDemoLogin() {
    setBusy(true)
    setError(null)
    try {
      const user = await login(userId, code.trim())
      afterLogin(user)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="page">
      <View className="head">
        <Text className="h1">登录</Text>
        <Text className="sub">手机验证码登录：短时有效、单次使用，失败次数在服务端限制。</Text>
      </View>

      <View className="panel">
        <Text className="label">手机号登录</Text>
        <View className="field">
          <Text className="label">手机号</Text>
          <Input type="number" maxlength={11} value={phone} onInput={(e) => setPhone(e.detail.value)} placeholder="11 位手机号" />
        </View>
        <View className="field">
          <Text className="label">验证码</Text>
          <View className="btn-row">
            <Input className="f-code" value={smsCode} onInput={(e) => setSmsCode(e.detail.value)} placeholder="6 位验证码" />
            <Button
              className="btn-plain"
              disabled={sendBusy || !/^1\d{10}$/.test(phone.trim())}
              onClick={() => void doSendCode()}
            >
              {codeSent ? '重新发送' : '获取验证码'}
            </Button>
          </View>
          {sendHint && <Text className="hint">{sendHint}</Text>}
        </View>
        {error && <Text className="err">{error}</Text>}
        <Button className="btn-primary" disabled={busy || !codeSent || smsCode.trim().length !== 6} onClick={() => void doPhoneLogin()}>
          {busy ? '登录中…' : '登录'}
        </Button>
      </View>

      {isDemoDeploy && (
        <View className="panel">
          <Text className="label">演示账号（仅演示部署存在）</Text>
          <Text className="hint">当前部署使用预置的合成邀请账号，验证码固定为 888888。</Text>
          <View className="chips">
            {ACCOUNTS.map((a) => (
              <Text key={a} className={userId === a ? 'chip active' : 'chip'} onClick={() => setUserId(a)}>
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
          <Button className="btn-primary" disabled={busy} onClick={() => void doDemoLogin()}>
            {busy ? '登录中…' : '演示账号登录'}
          </Button>
        </View>
      )}

      <Text className="hint">写投稿、收藏、举报需要登录；地图浏览不需要。</Text>
    </View>
  )
}
