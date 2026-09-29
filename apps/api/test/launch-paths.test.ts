/**
 * 上线路径测试：真实短信登录、内容审核接线、真实图片上传（EXIF 剥离）。
 * 这些是 production 与 demo 的分界能力——任何一项失效都意味着不可上线。
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, start, type Harness } from './helpers';
import { SmsChallengeStore, isCnPhone } from '../src/services/sms';
import { sniffImageType, stripJpegExif, stripPngExif } from '../src/services/storage';
import { WechatMsgSecCheck } from '../src/services/moderation';

const openers: Array<() => Promise<void>> = [];
async function withServer(overrides = {}): Promise<Harness> {
  const h = await start(overrides);
  openers.push(() => h.close());
  return h;
}

after(async () => {
  for (const close of openers) await close();
  openers.length = 0;
});

/** 测试桩：整体替换 app.services.sms 捕获验证码（handlers 动态读取 services.sms）。 */
async function captureCode(h: Harness, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const orig = h.booted.app.services.sms;
  h.booted.app.services.sms = {
    name: 'capture' as never,
    send: async (_phone: string, code: string) => {
      captured = code;
    },
  };
  try {
    await run();
  } finally {
    h.booted.app.services.sms = orig;
  }
  const m = /\d{6}/.exec(captured);
  if (!m) throw new Error(`短信桩未收到验证码：captured=${JSON.stringify(captured)}`);
  return m[0];
}

/** 构造带 APP1(Exif) 段的最小 JPEG（灰底不需要合法压缩流，只测段级处理）。 */
function jpegWithExif(): Buffer {
  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), Buffer.from('GPS(合成测试)'), Buffer.alloc(8, 0)]);
  const app1 = Buffer.alloc(4 + exifPayload.length);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(exifPayload.length + 2, 2);
  exifPayload.copy(app1, 4);
  const app0Jfif = Buffer.alloc(2 + 16);
  app0Jfif.writeUInt16BE(0xffe0, 0);
  app0Jfif.writeUInt16BE(16, 2);
  Buffer.from('JFIF\0', 'ascii').copy(app0Jfif, 4);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0Jfif, app1, Buffer.from([0xff, 0xda, 0x00, 0x02, 0xff, 0xd9])]);
}

function pngWithExif(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data: Buffer): Buffer => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    Buffer.from(type, 'ascii').copy(out, 4);
    data.copy(out, 8);
    return out;
  };
  return Buffer.concat([sig, chunk('eXIf', Buffer.from('GPS(合成测试)')), chunk('IHDR', Buffer.alloc(13)), chunk('IEND', Buffer.alloc(0))]);
}

describe('短信验证码登录', () => {
  test('Challenge 生命周期：过期/超次/单次使用', () => {
    const store = new SmsChallengeStore();
    store.save('13800001234', '123456', 1000);
    assert.equal(store.consume('13800001234', '000000', 1500), false, '错码不消耗');
    assert.equal(store.consume('13800001234', '123456', 2000), true, '正确码通过');
    assert.equal(store.consume('13800001234', '123456', 2500), false, '单次使用');

    const expired = new SmsChallengeStore();
    expired.save('13800001234', '123456', 1000);
    assert.equal(expired.consume('13800001234', '123456', 1000 + 5 * 60_000 + 1), false, '过期不可用');

    const attempts = new SmsChallengeStore();
    attempts.save('13800001234', '123456', 1000);
    for (let i = 0; i < 5; i++) assert.equal(attempts.consume('13800001234', '000000', 1500), false);
    assert.equal(attempts.consume('13800001234', '123456', 1600), false, '超过尝试上限后正确码也作废');
  });

  test('手机号校验', () => {
    assert.equal(isCnPhone('13800001234'), true);
    assert.equal(isCnPhone('23800001234'), false);
    assert.equal(isCnPhone('138000012'), false);
  });

  test('发送 → 登录 → 复用同一账号；/me 可读', async () => {
    const h = await withServer({ smsSendRateLimit: { max: 100, windowMs: 60_000 } });
    const c = new Client(h.base);
    const phone = '13800009999';
    const code = await captureCode(h, () => c.post('/auth/phone/code', { phone }));
    assert.match(code, /^\d{6}$/);

    const wrong = await c.req('POST', '/auth/phone/login', { body: { phone, code: '000000' } });
    assert.equal(wrong.status, 400);

    const r = await c.req<{ user: { id: string; is_test_data: boolean }; created: boolean }>('POST', '/auth/phone/login', {
      body: { phone, code },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data?.created, true);
    assert.equal(r.data?.user.is_test_data, true, '非生产环境的注册账号按合成数据标记');

    const again = await c.req<{ created: boolean }>('POST', '/auth/phone/login', { body: { phone, code } });
    assert.equal(again.status, 400, '验证码单次使用');

    const code2 = await captureCode(h, () => c.post('/auth/phone/code', { phone }));
    const again2 = await c.req<{ created: boolean }>('POST', '/auth/phone/login', { body: { phone, code: code2 } });
    assert.equal(again2.status, 200);
    assert.equal(again2.data?.created, false, '同手机号复用同一账号');

    const me = await c.get<{ id: string; phone_masked: string }>('/me');
    assert.equal(me.data?.id, r.data?.user.id);
    assert.equal(me.data?.phone_masked, '138****9999');
  });

  test('同手机号 1 分钟内第二条验证码被限流', async () => {
    const h = await withServer({ loginRateLimit: { max: 1000, windowMs: 60_000 } });
    const c = new Client(h.base);
    await c.post('/auth/phone/code', { phone: '13800007777' });
    const second = await c.req('POST', '/auth/phone/code', { body: { phone: '13800007777' } });
    assert.equal(second.status, 429);
  });

  test('production：/auth/phone/code 未配置短信供应商 → 503；演示登录 → 403', async () => {
    const h = await withServer({ nodeEnv: 'production', sessionSecret: 'x'.repeat(32), smsProvider: 'none' });
    const c = new Client(h.base);
    const send = await c.req('POST', '/auth/phone/code', { body: { phone: '13800006666' } });
    assert.equal(send.status, 503);
    const demo = await c.req('POST', '/auth/login', { body: { user_id: 'U01', code: '888888' } });
    assert.equal(demo.status, 403);
    const meta = await c.get<{ env: string; test_data_loaded: boolean }>('/meta');
    assert.equal(meta.data?.env, 'production');
    assert.equal(meta.data?.test_data_loaded, false);
  });
});

describe('内容审核接线', () => {
  test('msgSecCheck 适配器：87014 → 拒绝；pass → 通过；接口错误 → 不可用', async () => {
    const adapter = new WechatMsgSecCheck('appid', 'secret');
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('stable_token')) {
          return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), { status: 200 });
        }
        if (u.includes('msg_sec_check')) {
          return new Response(JSON.stringify({ errcode: 87014 }), { status: 200 });
        }
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      const risky = await adapter.checkText('加微信买粉丝', 'comment');
      assert.equal(risky.ok, false);
      assert.match(risky.message ?? '', /不允许/);

      globalThis.fetch = (async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('stable_token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), { status: 200 });
        return new Response(JSON.stringify({ errcode: 0, result: { suggest: 'pass', label: 100 } }), { status: 200 });
      }) as typeof fetch;
      const pass = await adapter.checkText('酸汤鱼很好吃', 'comment');
      assert.equal(pass.ok, true);

      globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
      const broken = await adapter.checkText('任意', 'comment');
      assert.equal(broken.ok, false);
      assert.equal(broken.message, 'CONTENT_CHECK_UNAVAILABLE');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('直通模式下举报正常提交；production 语义由 moderateText 按 env 决定', async () => {
    const h = await withServer();
    const c = new Client(h.base);
    await c.post('/auth/login', { user_id: 'U01', code: '888888' });
    const r = await c.req('POST', '/reports', {
      body: { restaurant_id: 'R01', kind: 'closed', detail: '实测：门头已换成别家。' },
      useCookie: true,
    });
    assert.equal(r.status, 201);
  });
});

describe('真实图片上传', () => {
  test('魔数不符 → 400；合法 JPEG → 201 且 EXIF 已剥离；未过审他人不可见', async () => {
    const h = await withServer();
    const owner = new Client(h.base);
    await owner.post('/auth/login', { user_id: 'U01', code: '888888' });

    // PNG 字节声明成 JPEG → 拒
    const bad = await fetch(`${h.base}/media/uploads`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', cookie: owner.cookie ?? '' },
      body: pngWithExif(),
    });
    assert.equal(bad.status, 400);

    // 合法 JPEG → 201
    const jpeg = jpegWithExif();
    const up = await fetch(`${h.base}/media/uploads`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', cookie: owner.cookie ?? '' },
      body: jpeg,
    });
    assert.equal(up.status, 201);
    const asset = (await up.json()) as { data: { id: string; content_type: string; review_status: string } };
    assert.equal(asset.data.content_type, 'image/jpeg');
    assert.equal(asset.data.review_status, 'PENDING');
    const id = asset.data.id;

    // 字节已剥离 APP1（含 Exif）
    const back = await fetch(`${h.base}/media/${id}`, { headers: { cookie: owner.cookie ?? '' } });
    assert.equal(back.status, 200);
    const bytes = Buffer.from(await back.arrayBuffer());
    assert.equal(sniffImageType(bytes), 'image/jpeg');
    assert.equal(bytes.includes(Buffer.from('Exif\0\0', 'ascii')), false, 'APP1/Exif 段已被移除');
    assert.equal(bytes.includes(Buffer.from('JFIF', 'ascii')), true, '非 APP1 段保留');

    // 未过审：其他账号 404
    const other = new Client(h.base);
    await other.post('/auth/login', { user_id: 'U02', code: '888888' });
    const forbidden = await fetch(`${h.base}/media/${id}`, { headers: { cookie: other.cookie ?? '' } });
    assert.equal(forbidden.status, 404);

    // 未登录 404（不泄露存在性）
    const anon = await fetch(`${h.base}/media/${id}`);
    assert.equal(anon.status, 404);
  });

  test('PNG eXIf 块被移除', () => {
    const cleaned = stripPngExif(pngWithExif());
    const idx = cleaned.indexOf(Buffer.from('GPS(合成测试)'));
    assert.equal(idx, -1);
    assert.equal(sniffImageType(cleaned), 'image/png');
  });

  test('JPEG 无 APP1 时原样返回', () => {
    const src = jpegWithExif();
    const noExif = Buffer.concat([src.subarray(0, 2 + 2 + 16), src.subarray(src.length - 6)]);
    assert.equal(stripJpegExif(noExif).equals(noExif), true);
  });
});
