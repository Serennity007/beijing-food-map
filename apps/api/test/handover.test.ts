import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { Client, makeConfig, start } from './helpers';
import { parseDump } from '../src/db/repository';
import { signSession } from '../src/http/session';
import { boot } from '../src/bootstrap';
import { API_BASE_PATH } from '../src/env';

test('举报 HTTP 角色边界与门店摘要', async () => {
  const h = await start();
  try {
    const c = new Client(h.base);
    assert.equal((await c.get('/admin/reports')).status, 401);
    await c.login('U02');
    assert.equal((await c.get('/admin/reports')).status, 403);
    await c.login('M01');
    const reports = await c.get<Array<{ restaurant_name: string }>>('/admin/reports');
    assert.equal(reports.status, 200);
    assert.ok(reports.data?.length);
    assert.ok(reports.data?.every(r => r.restaurant_name));
  } finally { await h.close(); }
});

test('签名 Cookie 经真实 HTTP 校验到期、篡改、Secure 与退出撤销', async () => {
  const secret = 'test-only-session-secret-32-characters';
  const h = await start({ sessionSecret: secret, sessionTtlSeconds: 60, secureCookie: true });
  try {
    const c = new Client(h.base);
    const login = await c.login('U02');
    assert.match(login.headers.get('set-cookie') ?? '', /Secure; Max-Age=60/);
    const cookie = c.cookie!;
    assert.equal((await c.get('/me')).status, 200);
    const sid = [...h.booted.app.store.sessions].find(([, s]) => s.user_id === 'U02')![0];
    c.cookie = `qw_session=${signSession(sid, secret, 60, Date.now() - 61_000)}`;
    assert.equal((await c.get('/me/reports')).status, 401);
    c.cookie = cookie.slice(0, -1) + (cookie.endsWith('A') ? 'B' : 'A');
    assert.equal((await c.get('/me/reports')).status, 401);
    c.cookie = cookie;
    await c.req('POST', '/auth/logout');
    c.cookie = cookie;
    assert.equal((await c.get('/me/reports')).status, 401);
  } finally { await h.close(); }
});

test('事务启动失败后相同数据仍会重试落库', async () => {
  const h = await start();
  try {
    const { app, repo, db } = h.booted;
    const sid = app.store.login('U02', '888888').session_id;
    app.store.deleteAccount(sid);
    const state = parseDump(app.store.dumpState());
    db.exec('BEGIN IMMEDIATE');
    try { assert.throws(() => repo.save(state)); }
    finally { db.exec('ROLLBACK'); }
    assert.ok(repo.save(state).includes('user'));
    assert.equal(repo.load()?.users.find(u => u.id === 'U02')?.status, 'deleting');
  } finally { await h.close(); }
});

test('后台自动执行注销并将结果持久化', async () => {
  const h = await start();
  try {
    const c = new Client(h.base);
    await c.login('U02');
    const response = await c.req<{ deletion_job_id: string }>('DELETE', '/me');
    assert.equal(response.status, 200);
    assert.ok(response.data?.deletion_job_id);
    assert.equal((await c.get('/me/reports')).status, 401);
    for (let attempt = 0; attempt < 30; attempt++) {
      if (h.booted.repo.load()?.users.find(u => u.id === 'U02')?.status === 'deleted') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const saved = h.booted.repo.load()!;
    assert.equal(saved.users.find(u => u.id === 'U02')?.status, 'deleted');
    assert.equal(saved.visits.some(v => v.user_id === 'U02'), false);
    assert.equal(saved.media.some(m => m.owner_user_id === 'U02'), false);
  } finally { await h.close(); }
});

test('重启后继续完成注销：本人快照失效且其他账号数据不受影响', async () => {
  const { cfg, dir } = makeConfig();
  const first = boot(cfg);
  const store = first.app.store;
  const u02 = store.login('U02', '888888').session_id;
  const mod = store.login('M01', '888888').session_id;
  const col = store.createCollection('U02', '测试·待清除清单', null);
  store.updateCollectionItem(col.id, 'R01', { note: '测试笔记（合成）', note_shareable: true }, 'U02');
  const pub = store.requestPublication(col.id, 'U02', ['R01']);
  store.moderate({ target: pub.id, action: 'approve', expected_version: pub.generation }, mod);
  const token = store.publications.get(pub.id)?.token;
  assert.ok(token);
  store.deleteAccount(u02);
  await first.app.close(); // 让 deleting 状态留在库里，模拟进程在清除前退出
  first.repo.save(parseDump(store.dumpState()), { force: true });
  assert.equal(first.repo.load()?.users.find((u) => u.id === 'U02')?.status, 'deleting');
  first.close();

  const second = boot(cfg);
  try {
    const port = await second.app.listen(); // 启动即续跑未完成的清除任务
    const saved = second.repo.load()!;
    assert.equal(saved.users.find((u) => u.id === 'U02')?.status, 'deleted');
    assert.equal(saved.collections.some((c) => c.owner_user_id === 'U02'), false);
    assert.equal(saved.publications.some((p) => p.token === token), false);
    assert.ok(saved.visits.some((v) => v.user_id === 'U01'));
    const c = new Client(`http://127.0.0.1:${port}${API_BASE_PATH}`);
    assert.equal((await c.get(`/shared-collections/${token}`)).status, 404);
    assert.equal((await c.get('/shared-collections/demo-token-1')).status, 200);
  } finally {
    await second.app.close();
    second.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows 上文件句柄可能还没释放 */
    }
  }
});
