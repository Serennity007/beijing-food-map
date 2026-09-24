/**
 * 一键演示：把构建产物起在一个本地端口，浏览器打开就能看，不需要记命令。
 *
 *   node scripts/serve-demo.mjs              # 静态模式：数据在浏览器 localStorage，不需要后端
 *   node scripts/serve-demo.mjs --api        # 后端模式：顺带拉起演示后端并代理 /api（写独立 SQLite 文件）
 *   node scripts/serve-demo.mjs --no-open    # 只起服务，不自动开浏览器
 *   node scripts/serve-demo.mjs --skip-build # 复用上一次构建
 *
 * 只用 node 内置模块：拿到这台机器上的任何一台，装了 Node ≥ 22.5 就能跑，不额外引入 serve/http-server。
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps', 'web', 'dist');
const API = { host: '127.0.0.1', port: 8787, base: '/api/v1' };

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const val = (flag, fallback) => {
  const hit = argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
};

const wantApi = has('--api');
const autoOpen = !has('--no-open');
const skipBuild = has('--skip-build');
const wantedPort = Number(val('--port', '4173'));

/**
 * 两种模式共用同一份 apps/web/dist，而前端用哪个数据实现在**构建时**就定死了。
 * 所以端口被占（说明另一个演示实例还活着）且模式不同时要提前说清楚：
 * 这次构建会改掉那个实例正在服务的东西。真要同时演示两种模式，请开两份仓库副本。
 */
function warnIfClobberingOtherMode() {
  const markerFile = join(DIST, '.demo-mode');
  if (!existsSync(markerFile)) return;
  const current = readFileSync(markerFile, 'utf8').trim();
  const next = wantApi ? 'api' : 'static';
  if (current === next) return;
  console.log(`[demo] 注意：现有产物是「${current}」模式，本次要构建「${next}」模式，会覆盖同一份 apps/web/dist。`);
  console.log('       若先前那个演示窗口还开着，它服务的已经是新产物了。同时演示两种模式请开两份仓库副本。');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Windows 上 spawn('npm.cmd') 会 EINVAL（Node 对 .bat/.cmd 的安全修复），改用 npm 自带的 JS 入口。 */
function npmInvocation() {
  const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return existsSync(cli) ? { cmd: process.execPath, pre: [cli] } : { cmd: 'npm', pre: [] };
}

const npm = npmInvocation();
const children = [];

function build() {
  if (skipBuild && existsSync(join(DIST, 'index.html'))) {
    console.log('[demo] 复用上一次构建（--skip-build）');
    return true;
  }
  const env = { ...process.env };
  // 前端用哪个数据实现在构建时就定死了：留空 = 浏览器内引擎，非空 = 真实 fetch。
  if (wantApi) env.VITE_API_BASE = '/api';
  else delete env.VITE_API_BASE;
  console.log(`[demo] npm run build（${wantApi ? '后端模式' : '静态模式'}）…`);
  const r = spawnSync(npm.cmd, [...npm.pre, 'run', 'build'], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('[demo] 构建失败，先修构建再起演示。');
    return false;
  }
  writeFileSync(join(DIST, '.demo-mode'), wantApi ? 'api' : 'static');
  return true;
}

async function probeApi() {
  try {
    const res = await fetch(`http://${API.host}:${API.port}${API.base}/health/ready`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** 后端没起就拉一个，并且只写独立 SQLite 文件 —— 演示跑完不会脏掉默认库。 */
async function ensureApi() {
  if (await probeApi()) {
    console.log(`[demo] 复用已在 ${API.host}:${API.port} 监听的后端（它连着哪个库由那个进程决定）`);
    return true;
  }
  mkdirSync(join(ROOT, 'work'), { recursive: true });
  // 文件名用上海时间：界面里的"提交时间"已经是上海日历日，UTC 命名的话
  // 凌晨那场演示会出现"截图写 09-25、库文件写 09-24"的对不上。
  const dayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const pick = (t) => dayParts.find((p) => p.type === t)?.value ?? '00';
  const db = join(ROOT, 'work', `demo-${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}${pick('second')}.sqlite`);
  // 用 start 而不是 dev：dev 是 tsx watch，演示途中改一下源码就会重启后端，
  // 新进程若抢不到 8787 会静默留下一个"还在监听但会话已丢"的后端，内存态会话与队列全断。
  const child = spawn(npm.cmd, [...npm.pre, 'run', 'start', '-w', '@qianwei/api'], {
    cwd: ROOT,
    env: { ...process.env, SQLITE_PATH: db, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.on('data', (c) => process.stdout.write(`[api] ${c}`));
  child.stderr.on('data', (c) => process.stderr.write(`[api] ${c}`));
  for (let i = 0; i < 30; i += 1) {
    if (await probeApi()) {
      console.log(`[demo] 后端就绪，演示库：${db}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('[demo] 后端 30 秒内没起来：改用静态模式重跑（去掉 --api），数据走浏览器 localStorage。');
  return false;
}

function contentType(path) {
  return MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * 演示服务必须自己压缩：真实 Pages/CDN 会给 gzip，而这里不发就变成
 * 未压缩的 1 MB 底图 SDK + 438 KB 应用代码原样过线 —— 手机上看就是"地图卡/白屏久"。
 * 只压文本类；瓦片与图片由上游给，不在此列。
 */
const COMPRESSIBLE = /\.(js|mjs|css|json|map|html|svg)(\?.*)?$/i;

function gzipResponse(req, res, file, status = 200) {
  const accept = req.headers['accept-encoding'] ?? '';
  const raw = readFileSync(file);
  const headers = { 'content-type': contentType(file), 'cache-control': 'no-cache' };
  if (COMPRESSIBLE.test(file) && /\bgzip\b/.test(accept)) {
    const body = gzipSync(raw);
    headers['content-encoding'] = 'gzip';
    headers['vary'] = 'accept-encoding';
    res.writeHead(status, headers);
    res.end(body);
    return;
  }
  res.writeHead(status, headers);
  res.end(raw);
}

function sendFile(req, res, file, status = 200) {
  gzipResponse(req, res, file, status);
}

/** 静态资源 → dist；未知路径回 index.html（本地演示不需要 Pages 那套 404.html 回退）。 */
function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://local');
  const clean = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const abs = resolve(DIST, clean === '' ? 'index.html' : clean);
  if (abs !== DIST && !abs.startsWith(DIST + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('403 越界路径');
    return;
  }
  if (existsSync(abs) && statSync(abs).isFile()) {
    sendFile(req, res, abs);
    return;
  }
  const index = join(DIST, 'index.html');
  if (existsSync(index)) sendFile(req, res, index);
  else {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 找不到构建产物，先跑 npm run build');
  }
}

function proxyApi(req, res) {
  const p = httpRequest(
    {
      host: API.host,
      port: API.port,
      method: req.method,
      path: req.url,
      // 保留访客的 Host（不改成 127.0.0.1:8787）：后端拿 Origin 的 host 与 Host 头比对来判同源，
      // 改掉就会把"浏览器↔演示服务"这条真实同源链路误判成跨站，写操作全 403。
      // 跨站页面伪造不了 Host，所以这不放松 CSRF 判断。
      headers: { ...req.headers },
    },
    (up) => {
      const headers = { ...up.headers };
      // 逐跳头不回传：长度或分块编码由本响应重新决定
      delete headers['transfer-encoding'];
      res.writeHead(up.statusCode ?? 502, headers);
      up.pipe(res);
    },
  );
  p.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: '演示后端未响应' }, meta: { requestId: 'demo' } }));
  });
  req.pipe(p);
}

function listen(server, port, triesLeft) {
  return new Promise((settled) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && triesLeft > 0) {
        console.log(`[demo] ${port} 被占用，换 ${port + 1}`);
        settled(listen(server, port + 1, triesLeft - 1));
      } else {
        settled(Promise.reject(err));
      }
    });
    server.listen(port, '0.0.0.0', () => settled(port));
  });
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    // 169.254/16 是拿不到 DHCP 时的链路本地地址，手机连不上，列出来只会误导
    .filter((i) => !i.address.startsWith('169.254.'))
    .map((i) => i.address);
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const c = spawn(cmd, args, { stdio: 'ignore', detached: true });
  c.on('error', () => undefined);
  c.unref();
}

if (!existsSync(join(ROOT, 'package.json'))) {
  console.error('[demo] 找不到 package.json，请在仓库根目录跑这个脚本。');
  process.exit(1);
}

warnIfClobberingOtherMode();
if (!build()) process.exit(1);if (wantApi && !(await ensureApi())) process.exit(1);

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0] ?? '/';
  if (wantApi && path.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }
  serveStatic(req, res);
});

const port = await listen(server, wantedPort, 5);
const local = `http://127.0.0.1:${port}/`;
const mode = wantApi ? '后端模式（真实 HTTP + SQLite，写独立演示库）' : '静态模式（浏览器内引擎 + localStorage）';

console.log('\n京城黔味地图 · 演示版');
console.log(`  本机    ${local}`);
for (const ip of lanAddresses()) console.log(`  手机同 Wi-Fi  http://${ip}:${port}/`);
console.log(`  模式    ${mode}`);
console.log('  账号    U01…U05 食客 · E01 编辑 · M01 审核员 · A01 管理员，验证码 888888');
console.log('  停止    Ctrl+C\n');

if (autoOpen) openBrowser(local);

function shutdown(code) {
  server.close();
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 200).unref();
}
process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
