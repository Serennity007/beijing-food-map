/** demo 图片：明确标注测试的合成占位图，不使用任何第三方照片。 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PALETTE = [
  ['#2f6f5e', '#e9dcc3'],
  ['#7a3b2e', '#f2e2d5'],
  ['#3d4f6b', '#e4e8ef'],
  ['#6b4f2a', '#f3ead9'],
  ['#4a3b5c', '#ece6f2'],
];

export function testPhotoDataUri(label: string, subtitle = '测试图片 · 非真实门店'): string {
  const [bg, fg] = PALETTE[Math.abs(hash(label)) % PALETTE.length]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
<rect width="640" height="420" fill="${bg}"/>
<circle cx="320" cy="180" r="96" fill="${fg}" opacity="0.9"/>
<path d="M200 330 h240" stroke="${fg}" stroke-width="10" stroke-linecap="round" opacity="0.85"/>
<text x="32" y="52" font-family="system-ui,sans-serif" font-size="30" fill="${fg}">${esc(label)}</text>
<text x="32" y="392" font-family="system-ui,sans-serif" font-size="22" fill="${fg}" opacity="0.9">${esc(subtitle)}</text>
</svg>`;
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) | 0;
  return h;
}

function toBase64(s: string): string {
  if (typeof btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return Buffer.from(s, 'utf8').toString('base64');
}
