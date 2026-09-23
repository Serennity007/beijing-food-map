import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { signSession, verifySession } from '../src/http/session';
import { readConfig } from '../src/env';
import { readSessionCookie, sessionCookie } from '../src/http/responses';

test('签名令牌拒绝篡改、过期、旧裸会话和不同密钥', () => {
  const secret = 'a'.repeat(32);
  const token = signSession('sess-S01', secret, 60, 100000);
  assert.equal(verifySession(token, secret, 159999), 'sess-S01');
  assert.equal(verifySession(token, secret, 160000), null);
  assert.equal(verifySession(token.replace('S01', 'S02'), secret, 100000), null);
  assert.equal(verifySession(token, 'b'.repeat(32), 100000), null);
  // 未签名的裸 session id 一律不认：改了签名方案就不能被旧格式绕过
  assert.equal(verifySession('sess-S01', secret, 100000), null);
  assert.equal(readSessionCookie({ headers: { cookie: 'qw_session=%invalid' } } as IncomingMessage), null);
});

test('Secure 可独立开启，生产要求密钥及 Secure，有效期受限', () => {
  assert.equal(readConfig({ NODE_ENV: 'development', COOKIE_SECURE: 'true' }).secureCookie, true);
  assert.throws(() => readConfig({ NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(32), COOKIE_SECURE: 'false' }));
  assert.throws(() => readConfig({ SESSION_TTL_SECONDS: '0' }));
  assert.match(sessionCookie('token', { secure: true, ttl: 60 }), /Secure; Max-Age=60/);
});
