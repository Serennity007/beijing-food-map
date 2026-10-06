#!/usr/bin/env node
/**
 * 一键发布网页到 GitHub Pages（GitHub Pages 手工通道）。
 *
 * 用法：node scripts/deploy-pages.mjs
 * 可选：apps/web/.env.local 里配 VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE，
 *       存在时构建会注入高德 JSAPI 凭据；该文件被 .gitignore 忽略，Key 永不进仓库。
 *
 * 全程用 Node 的 execFileSync/fs，不经 Git Bash —— 天然没有 MSYS 路径转换问题
 * （runbook 记载的 /Program/Git 前缀坑只在 bash 传环境变量时发生）。
 * 部署提交会先在本地仓库打 branch `pages-deploy-last` 再推送，推送失败也不丢。
 */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '..');
const WEB = join(ROOT, 'apps', 'web');
const DIST = join(WEB, 'dist');
const WORKTREE = join(ROOT, '..', 'gh-pages-deploy');
const BASE = '/beijing-food-map/';
const ENV_LOCAL = join(WEB, '.env.local');

function git(...args) {
  const opts = args.length && typeof args.at(-1) === 'object' ? args.pop() : {};
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return {};
  const out = {};
  for (const line of readFileSync(ENV_LOCAL, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1].startsWith('VITE_')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---------- 1) 构建 ----------
const envLocal = loadEnvLocal();
const hasKey = Boolean(envLocal.VITE_AMAP_KEY);
let exitCode = 0;
console.log(`[1/4] 构建（VITE_BASE=${BASE}${hasKey ? '，含高德 JSAPI 凭据' : '，无高德 Key → 开源底图'}）…`);
execSync('npm run build', {
  cwd: WEB,
  stdio: 'inherit',
  env: { ...process.env, ...envLocal, VITE_BASE: BASE, MSYS_NO_PATHCONV: '1' },
});

// ---------- 2) 构建产物自检 ----------
console.log('[2/4] 校验产物…');
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const entry = indexHtml.match(/src="([^"]*index-[^"]*\.js)"/)?.[1];
if (!entry || !entry.startsWith(BASE)) {
  console.error(`[失败] 资源前缀不对：${entry}（期望以 ${BASE} 开头）`);
  process.exit(1);
}
if (indexHtml.includes('/Program/Git/')) {
  console.error('[失败] 产物混入了 MSYS 路径转换痕迹，检查构建环境');
  process.exit(1);
}
console.log(`      入口 ${entry} ✓`);

// ---------- 3) 组装 gh-pages worktree ----------
console.log('[3/4] 组装 gh-pages…');
execFileSync('git', ['worktree', 'add', '--detach', WORKTREE, 'origin/gh-pages'], { cwd: ROOT, stdio: 'pipe' });
try {
  for (const name of readdirSync(WORKTREE)) {
    if (name !== '.git') rmSync(join(WORKTREE, name), { recursive: true, force: true });
  }
  cpSync(DIST, WORKTREE, { recursive: true });
  writeFileSync(join(WORKTREE, '.nojekyll'), '');
  const notFound = join(WORKTREE, '404.html');
  if (existsSync(notFound)) {
    writeFileSync(notFound, readFileSync(notFound, 'utf8').replaceAll('__BASE__', BASE));
  }
  execFileSync('git', ['add', '-A'], { cwd: WORKTREE });
  const sha = git('rev-parse', '--short', 'HEAD');
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: WORKTREE, encoding: 'utf8' });
  if (!status.trim()) {
    console.log('      产物与线上一致，无需发布');
  } else {
    execFileSync('git', ['commit', '-m', `Pages: build (main ${sha}, AMap key ${hasKey ? 'injected' : 'absent'})`], {
      cwd: WORKTREE, stdio: 'pipe',
    });
    // 部署提交先落本地分支，推送失败也不丢
    execFileSync('git', ['branch', '-f', 'pages-deploy-last', 'HEAD'], { cwd: WORKTREE, stdio: 'pipe' });

    // ---------- 4) 推送 ----------
    console.log('[4/4] 推送 gh-pages…');
    try {
      execFileSync('git', ['push', 'origin', 'HEAD:gh-pages'], { cwd: WORKTREE, stdio: 'inherit' });
    } catch {
      console.error(`\n[推送失败] 部署提交已保存在本地分支 pages-deploy-last，恢复推送：`);
      console.error(`  git push origin pages-deploy-last:gh-pages`);
      exitCode = 1;
    }
    if (exitCode === 0) {
      console.log(`\n完成。等 Pages 构建后（gh api repos/:owner/beijing-food-map/pages/builds/latest）访问：`);
      console.log(`  https://serennity007.github.io/beijing-food-map/`);
      if (hasKey) console.log('记得在线上验证高德底图。');
    }
  }
} finally {
  try {
    execFileSync('git', ['worktree', 'remove', '--force', WORKTREE], { cwd: ROOT, stdio: 'pipe' });
  } catch {
    console.warn(`[提示] 临时 worktree 未清理：${WORKTREE}`);
  }
}
process.exit(exitCode);
