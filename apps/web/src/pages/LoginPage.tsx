import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SEED_USERS } from '@qianwei/contracts';
import { useApi } from '../data/api';

/**
 * 登录页：手机验证码登录（真实路径）+ 演示邀请账号（仅非生产部署存在，production 由服务端拒绝）。
 */
export function LoginPage() {
  const { api, setUser, meta } = useApi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const isDemoDeploy = meta !== null && meta.env !== 'production';

  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendHint, setSendHint] = useState<string | null>(null);
  const [userId, setUserId] = useState('U01');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next') ?? '/map';

  const phoneOk = /^1\d{10}$/.test(phone.trim());

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.phoneCode(phone.trim());
      setCodeSent(true);
      setSendHint(`验证码已发送，${r.ttl_seconds} 秒内有效`);
    } catch (e) {
      setSendHint(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function phoneSignIn() {
    setBusy(true);
    setError(null);
    try {
      const u = await api.phoneLogin(phone.trim(), smsCode.trim());
      setUser(u);
      nav(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function demoSignIn() {
    setBusy(true);
    setError(null);
    try {
      const u = await api.login(userId, code.trim());
      setUser(u);
      nav(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <h1>登录</h1>
      <p className="hint">
        手机验证码登录：短时有效、单次使用，失败次数与发送频率都在服务端控制。
      </p>
      {error && <div className="alert bad">{error}</div>}

      <div className="panel">
        <h2>手机号登录</h2>
        <label className="field">
          <span className="label">手机号</span>
          <input
            value={phone}
            inputMode="numeric"
            maxLength={11}
            placeholder="11 位手机号"
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">验证码</span>
          <span className="btn-row">
            <input
              value={smsCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位验证码"
              onChange={(e) => setSmsCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && codeSent && smsCode.trim().length === 6) void phoneSignIn();
              }}
            />
            <button className="btn plain" type="button" disabled={busy || !phoneOk} onClick={() => void sendCode()}>
              {codeSent ? '重新发送' : '获取验证码'}
            </button>
          </span>
        </label>
        {sendHint && <p className="hint">{sendHint}</p>}
        <div className="btn-row">
          <button
            className="btn"
            type="button"
            disabled={busy || !codeSent || smsCode.trim().length !== 6}
            onClick={() => void phoneSignIn()}
          >
            {busy ? '登录中…' : '登录'}
          </button>
          <Link className="btn plain" to="/map">
            先随便逛逛
          </Link>
        </div>
        <p className="hint">登录状态只保存在当前浏览器 Cookie；退出即撤销本机会话。</p>
      </div>

      {isDemoDeploy && (
        <div className="panel">
          <h2>演示账号（仅演示部署存在）</h2>
          <p className="hint">
            当前部署使用预置的<strong>合成邀请账号</strong>，不发送真实短信；验证码固定为 888888。生产部署会拒绝该入口。
          </p>
          <div className="radio-row" role="radiogroup" aria-label="测试账号">
            {SEED_USERS.map((u) => (
              <label key={u.id}>
                <input type="radio" name="account" value={u.id} checked={userId === u.id} onChange={() => setUserId(u.id)} />
                {u.display_name}
                <small>
                  {u.id}
                  {u.roles.length > 1 ? ` · ${u.roles.filter((r) => r !== 'user').join('/')}` : ''}
                </small>
              </label>
            ))}
          </div>
          <p className="hint">
            审核员 M01 / 管理员 A01 用于查看内容后台；“测试食客06（已注销）”会拒绝登录，用来验证注销后的会话处置。
          </p>
          <label className="field">
            <span className="label">验证码（演示环境固定为 888888）</span>
            <input
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="888888"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void demoSignIn();
              }}
            />
          </label>
          <div className="btn-row">
            <button className="btn" type="button" disabled={busy} onClick={() => void demoSignIn()}>
              {busy ? '登录中…' : '演示账号登录'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
