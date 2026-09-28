/**
 * 把 docs/render-check 里适合当作品集的一批图挑出来，按端分目录拷走。
 *
 *   node scripts/collect-portfolio-shots.mjs [输出目录]
 *
 * 默认输出到仓库的上一级（桌面那层）的「作品截图」。逻辑放在这里而不是 .bat 里：
 * cmd 对含中文路径的 for/pause 组合不可靠，而 Node 在 Windows 上处理这些没问题。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'docs', 'render-check');
const OUT = resolve(process.argv[2] ?? join(ROOT, '..', '作品截图'));

const WEB = [
  '9-map-390-firstscreen.png',
  '14-map-390-filter-panel.png',
  '16-map-1440-desktop.png',
  '17-detail-pending-390.png',
  '19-detail-quick-1440.png',
  '20-restyle-map-390.png',
  '22-restyle-map-1440.png',
  '23-restyle-admin-1440.png',
  '24-picker-in-form-390.png',
  '25-guizhou-elements-390.png',
  '26-qian-dictionary-390.png',
  '27-premium-detail-390.png',
  '28-premium-map-390.png',
  '29-premium-detail-1440.png',
  '30-live-pages-390.png',
  '65-web-v2-map-390.png',
  '66-web-v2-detail-390.png',
];

const MP = [
  '60-miniprogram-v2-index.png',
  '61-miniprogram-v2-detail.png',
  '62-miniprogram-v2-me.png',
  '63-miniprogram-v2-admin.png',
  '64-miniprogram-v2-submit.png',
  '41-miniprogram-admin-reports.png',
  '38-miniprogram-collection-edit.png',
  '44-miniprogram-revise-submitted.png',
  '48-miniprogram-ui-published.png',
];

if (!existsSync(SRC)) {
  console.error(`找不到渲染证据目录：${SRC}`);
  process.exit(1);
}

const have = new Set(readdirSync(SRC));
let copied = 0;
const missing = [];

for (const [sub, list] of [['网页', WEB], ['小程序', MP]]) {
  const dir = join(OUT, sub);
  mkdirSync(dir, { recursive: true });
  for (const name of list) {
    if (!have.has(name)) {
      missing.push(name);
      continue;
    }
    copyFileSync(join(SRC, name), join(dir, name));
    copied += 1;
  }
}

const manifest = [
  '# 作品图集',
  '',
  `生成：${new Date().toLocaleString('zh-CN')} · 来源 \`docs/render-check\` · 共 ${copied} 张`,
  '',
  '## 网页（17 张）',
  '',
  ...WEB.filter((n) => have.has(n)).map((n) => `- 网页/${n}`),
  '',
  '## 小程序（9 张）',
  '',
  ...MP.filter((n) => have.has(n)).map((n) => `- 小程序/${n}`),
  '',
  '线上站点：<https://serennity007.github.io/beijing-food-map/>（静态模式，数据在浏览器内）',
  '',
  '> 这些图是演示版实拍：门店、图片、实吃记录与票数全部为合成测试数据，店名前缀「测试·」，',
  '> 不代表任何真实餐馆。对外说明时不要讲成已上线运营的产品。',
  '',
];
writeFileSync(join(OUT, '图集清单.md'), manifest.join('\n'));

console.log(`拷到 ${copied} 张 → ${OUT}`);
if (missing.length) {
  console.log(`\n清单里有 ${missing.length} 张在当前仓库找不到（可能文件名变了）：`);
  for (const m of missing) console.log('  - ' + m);
}
