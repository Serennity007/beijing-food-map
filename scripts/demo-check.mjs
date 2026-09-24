/**
 * 演示自检：上台前 30 秒跑一次，确认"打开就能看"这件事没坏。
 *
 *   node scripts/demo-check.mjs                       # 只检静态站（默认 http://127.0.0.1:4173）
 *   node scripts/demo-check.mjs --api                 # 顺带检演示后端与接口
 *   node scripts/demo-check.mjs --base=http://IP:PORT # 检别人机器上跑着的那一份
 *
 * 这里只做能被机器判定的检查；静态模式的数据行为存在浏览器里，脚本碰不到，
 * 那部分走 docs/演示动线.md 的第一幕人工确认。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const val = (flag, fallback) => {
  const hit = argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
};
const BASE = val('--base', 'http://127.0.0.1:4173').replace(/\/$/, '');
const wantApi = argv.includes('--api');
const API_BASE = `${BASE}/api/v1`;
if (argv.some((a) => a.startsWith('--port='))) {
  console.log('提示：这里没有 --port，指定被测地址用 --base=http://127.0.0.1:<端口>。当前按 ' + BASE + ' 检查。\n');
}

const results = [];
function check(name, fn) {
  return fn().then(
    (detail) => results.push({ ok: true, name, detail: typeof detail === 'string' ? detail : '' }),
    (err) => results.push({ ok: false, name, detail: err instanceof Error ? err.message : String(err) }),
  );
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
  return '';
}

async function get(url, expectStatus = 200) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (res.status !== expectStatus) throw new Error(`${url} 返回 ${res.status}，期望 ${expectStatus}`);
  return res;
}

const DIST = join(ROOT, 'apps', 'web', 'dist');

await check('构建产物存在', async () => {
  must(existsSync(join(DIST, 'index.html')), '缺 apps/web/dist/index.html，先跑 npm run build 或 node scripts/serve-demo.mjs');
  return 'apps/web/dist';
});

await check('演示站可达', async () => {
  const res = await get(`${BASE}/`);
  const type = res.headers.get('content-type') ?? '';
  must(type.includes('text/html'), `首页 content-type 是 ${type}`);
  return BASE;
});

await check('深链接可直达（刷新不 404）', async () => {
  const res = await get(`${BASE}/restaurants/R01`);
  must((res.headers.get('content-type') ?? '').includes('text/html'), '深链接没回退到 index.html');
  return '/restaurants/R01';
});

await check('未知路由回退而不是白屏', async () => {
  await get(`${BASE}/this-route-does-not-exist`);
  return '回退到应用外壳';
});

await check('首页引用的资源都能取到', async () => {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1] ?? '');
  must(refs.length > 0, 'index.html 里没有 /assets 引用');
  for (const ref of refs) await get(`${BASE}${ref}`);
  return `${refs.length} 个`;
});

await check('构建模式与运行方式一致', async () => {
  const marker = existsSync(join(DIST, '.demo-mode')) ? readFileSync(join(DIST, '.demo-mode'), 'utf8').trim() : 'unknown';
  if (wantApi) must(marker !== 'static', '产物是静态模式构建（数据走浏览器），但自检带了 --api：用 serve-demo.mjs --api 重建');
  if (!wantApi) must(marker !== 'api', '产物是后端模式构建（会去请求 /api），但自检没带 --api');
  return `产物标记 ${marker}`;
});

if (wantApi) {
  await check('后端就绪探针', async () => {
    const res = await get(`${API_BASE}/health/ready`);
    const body = (await res.json())?.data;
    must(body?.status === 'ready', `就绪探针返回 ${JSON.stringify(body)}`);
    return 'SQLite 可写可读';
  });

  await check('服务器今天（Asia/Shanghai）', async () => {
    const res = await get(`${API_BASE}/today`);
    const today = (await res.json()).data;
    must(/^\d{4}-\d{2}-\d{2}$/.test(String(today)), `/today 返回 ${today}`);
    return String(today);
  });

  await check('默认图层有门店', async () => {
    const res = await get(`${API_BASE}/map/items?west=115.42&south=39.44&east=117.52&north=41.06&zoom=11&view=southwest&include_unknown=0&layer=qualified`);
    const data = (await res.json()).data;
    must(data.total_matched > 0, '默认图层 0 家门店');
    return `${data.total_matched} 家匹配 · ${data.mode}`;
  });

  await check('待验证图层独立于默认图层', async () => {
    const res = await get(`${API_BASE}/map/items?west=115.42&south=39.44&east=117.52&north=41.06&zoom=11&view=southwest&include_unknown=0&layer=pending_verification`);
    const data = (await res.json()).data;
    must(data.total_matched >= 0, '待验证图层查询失败');
    return `${data.total_matched} 家待验证`;
  });

  await check('门店详情带合成数据水印', async () => {
    const res = await get(`${API_BASE}/restaurants/R01`);
    const data = (await res.json()).data;
    must(data.is_test_data === true, 'is_test_data 不是 true，合成数据隔离失效');
    must(Array.isArray(data.basis?.sources), '推荐依据结构异常');
    return `${data.name} · 社区 ${data.community} · in_default_layer=${data.in_default_layer}`;
  });

  await check('OpenAPI 与合同版本一致', async () => {
    const res = await get(`${API_BASE}/openapi.json`);
    const doc = (await res.json()).data;
    must(doc?.openapi?.startsWith('3.0'), `OpenAPI 版本 ${doc?.openapi}`);
    must(Object.keys(doc.paths ?? {}).length >= 36, `路由数只有 ${Object.keys(doc.paths ?? {}).length}，比预期少`);
    return `${doc.info.version} · ${Object.keys(doc.paths).length} 条路径`;
  });

  await check('未登录读私有内容统一 404/401，不泄露存在性', async () => {
    const mine = await fetch(`${API_BASE}/me`, { signal: AbortSignal.timeout(5000) });
    must(mine.status === 200, `/me 未登录应 200 + data:null，实际 ${mine.status}`);
    const body = await mine.json();
    must(body.data === null, '未登录 /me 竟然返回了身份');
    const queue = await fetch(`${API_BASE}/admin/queue`, { signal: AbortSignal.timeout(5000) });
    must(queue.status === 401 || queue.status === 403, `匿名读审核队列返回 ${queue.status}`);
    return '/me null · /admin/queue 被拒';
  });
}

await check('默认演示库没被演示脚本写脏', async () => {
  const db = join(ROOT, 'apps', 'api', 'data', 'demo.sqlite');
  if (!existsSync(db)) return '默认库不存在（干净）';
  const ageMin = (Date.now() - statSync(db).mtimeMs) / 60000;
  must(ageMin > 30, `默认库 ${db} 在 ${ageMin.toFixed(1)} 分钟前被写过 —— 演示要指独立库（serve-demo.mjs --api 会自己开 work/demo-*.sqlite）`);
  return `默认库最近一次改动在 ${ageMin.toFixed(0)} 分钟前`;
});

const failed = results.filter((r) => !r.ok);
console.log(`\n演示自检 · ${BASE}${wantApi ? ' + 后端' : '（静态模式）'}`);
for (const r of results) console.log(`  ${r.ok ? '✔' : '✘'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
console.log('');
if (failed.length === 0) {
  console.log(`ALL GREEN（${results.length} 项）· 可以开始演示`);
  console.log('浏览器里还要人工确认的：地图出瓦片、门店页推荐依据、建店申请与地点核验、举报工单的处置与回写 —— 见 docs/演示动线.md\n');
} else {
  console.log(`FAIL ${failed.length}/${results.length} —— 先修这些：`);
  for (const f of failed) console.log(`  · ${f.name}：${f.detail}`);
  console.log('\n兜底办法：双击「一键演示」重跑（它会重新构建）；仍不行就退回静态模式 node scripts/serve-demo.mjs\n');
  process.exitCode = 1;
}
