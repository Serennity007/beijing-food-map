import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * 统一开发入口：`node scripts/dev.mjs`（或 `... web` / `... api`）。
 * 输出加前缀，任一子进程退出即整体退出，避免留下端口占用的孤儿进程。
 */

/**
 * Windows 上 `npm` 是 npm.cmd，直接 spawn .cmd 会 EINVAL（Node 的 .bat/.cmd 安全修复），
 * 而 shell:true 会让 kill() 只打到 shell 包装层、留活 vite/tsx。
 * 优先用随 node 一起安装的 npm JS 入口，两边行为就一致了。
 */
function npmInvocation() {
  const cli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return existsSync(cli) ? { cmd: process.execPath, pre: [cli] } : { cmd: 'npm', pre: [] };
}

const npm = npmInvocation();
const requested = process.argv.slice(2).filter((a) => a === 'web' || a === 'api');
const targets = requested.length > 0 ? requested : ['api', 'web'];

const children = [];
let exiting = false;

function prefix(name, chunk) {
  return chunk
    .toString()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => `[${name}] ${line}`)
    .join('\n');
}

for (const target of targets) {
  const child = spawn(npm.cmd, [...npm.pre, 'run', 'dev', '-w', `@qianwei/${target}`], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  });
  children.push(child);
  child.stdout.on('data', (c) => process.stdout.write(`${prefix(target, c)}\n`));
  child.stderr.on('data', (c) => process.stderr.write(`${prefix(target, c)}\n`));
  child.on('exit', (code) => {
    if (exiting) return;
    console.log(`[${target}] 退出（code ${code}）`);
    if (target === 'api' && code !== 0 && code !== null) {
      console.log('提示：后端不可用时仍可只用静态演示模式运行前端：npm run dev:web（数据存在浏览器 localStorage）。');
      const others = children.filter((c) => c !== child && c.exitCode === null);
      if (others.length > 0) return;
    }
    shutdown(code ?? 1);
  });
}

function shutdown(code) {
  if (exiting) return;
  exiting = true;
  for (const c of children) {
    if (c.exitCode === null) c.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 200).unref();
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
