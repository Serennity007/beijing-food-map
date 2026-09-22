import { spawn } from 'node:child_process';

/**
 * 统一开发入口：`node scripts/dev.mjs`（或 `... web` / `... api`）。
 * 输出加前缀，任一子进程退出即整体退出，避免留下端口占用的孤儿进程。
 */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
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
  const child = spawn(NPM, ['run', 'dev', '-w', `@qianwei/${target}`], {
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
