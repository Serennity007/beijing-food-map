import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SEED_USERS } from '@qianwei/contracts';
import { useApi } from '../data/api';

/**
 * 内测邀请账号登录。正式环境使用短信验证码（服务端限频、短时单次），
 * 固定验证码只存在于 demo/内测配置，生产构建会拒绝该入口。
 */
export function LoginPage() {
  const { api, setUser } = useApi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [userId, setUserId] = useState('U01');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next') ?? '/map';

  async function signIn() {
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
      <h1>内测登录</h1>
      <p className="hint">
        演示版使用预置的<strong>合成邀请账号</strong>，不发送真实短信。正式环境改为服务端短信验证码：短时有效、单次使用、失败次数与费用上限都在服务端控制。
      </p>
      {error && <div className="alert bad">{error}</div>}

      <div className="panel">
        <h2>选择测试账号</h2>
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
              if (e.key === 'Enter') void signIn();
            }}
          />
        </label>
        <div className="btn-row">
          <button className="btn" type="button" disabled={busy} onClick={() => void signIn()}>
            {busy ? '登录中…' : '登录'}
          </button>
          <Link className="btn plain" to="/map">
            先随便逛逛
          </Link>
        </div>
        <p className="hint">登录状态只保存在当前浏览器；退出即撤销本机会话。</p>
      </div>
    </div>
  );
}
