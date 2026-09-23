import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// 没有配置密钥的本地演示只在本次进程内有效；重启须重新登录。
const ephemeralSecret = randomBytes(32).toString('hex');
export function signSession(id: string, secret: string | undefined, ttl: number, now = Date.now()): string {
  const payload = `${id}.${Math.floor(now / 1000) + ttl}`;
  return `${payload}.${createHmac('sha256', secret || ephemeralSecret).update(payload).digest('base64url')}`;
}
export function verifySession(token: string | null, secret: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 256) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, expiry, signature] = parts as [string, string, string];
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(id) || !/^\d{1,12}$/.test(expiry) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const expected = createHmac('sha256', secret || ephemeralSecret).update(`${id}.${expiry}`).digest('base64url');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return Number(expiry) > Math.floor(now / 1000) ? id : null;
}
