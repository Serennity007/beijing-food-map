/**
 * 高德 POI → 未核验候选 暂存脚本（不写引擎、不写库、不上图层）。
 *
 * 用途：把「高德开放平台 Web 服务·搜索POI」的导出 JSON（或按模板手填的扫街榜记录）
 * 规范化成交接包 database/import/amap-candidates-<日期>.json，供人工核验后走
 * 「建店候选 → 地点核验」流程。坐标有效性（GCJ-02 + 北京范围）在这里先挡一道，
 * 但**通过校验 ≠ 核验通过**：在营状态、门牌、菜系、风险仍须人工确认。
 *
 * 用法：npx tsx scripts/import-amap-candidates.mts <输入.json> [--out 输出.json]
 * 输入兼容两种形状：
 *   A. 高德搜索POI响应：{ status: "1", pois: [{ name, address, location: "lng,lat", id, ... }] }
 *   B. 本仓库暂存格式：{ candidates: [{ name, address, lng, lat, poi_id, ... }] }
 *
 * 本脚本刻意保持零副作用：不调网络、不写 localStorage、不触碰 packages/contracts 的 Store。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { BEIJING_BOUNDS, isValidGcj02 } from '@qianwei/contracts';

interface StagedCandidate {
  name: string;
  area_hint: string | null;
  cuisine_guess: string | null;
  address: string | null;
  lng: number | null;
  lat: number | null;
  poi_id: string | null;
  provider: 'amap';
  verified: false;
  source: { site: string; retrieved_at: string; poi_id: string | null };
  reject_reason?: string;
}

function fail(msg: string): never {
  console.error(`[import-amap] ${msg}`);
  process.exit(1);
}

function inBeijing(lng: number, lat: number): boolean {
  return (
    lng >= BEIJING_BOUNDS.west &&
    lng <= BEIJING_BOUNDS.east &&
    lat >= BEIJING_BOUNDS.south &&
    lat <= BEIJING_BOUNDS.north
  );
}

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const today = new Date().toISOString().slice(0, 10);
const outPath = outIdx >= 0 ? args[outIdx + 1]! : `database/import/amap-candidates-${today}.json`;

if (!inputPath) fail('用法：npx tsx scripts/import-amap-candidates.mts <输入.json> [--out 输出.json]');

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch (e) {
  fail(`读不了 ${inputPath}：${(e as Error).message}`);
}

const o = raw as Record<string, unknown>;
const amapPois = Array.isArray(o.pois) ? (o.pois as Record<string, unknown>[]) : null;
const stagedList = Array.isArray(o.candidates) ? (o.candidates as Record<string, unknown>[]) : null;
const pois = amapPois ?? stagedList;
if (!pois) fail('输入既不是高德 POI 响应（缺 pois 数组），也不是暂存格式（缺 candidates 数组）');
const staged: StagedCandidate[] = [];
const rejected: Array<{ name: string; reason: string }> = [];
const seenPoi = new Set<string>();

for (const p of pois) {
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) {
    rejected.push({ name: '(无名条目)', reason: '缺店名' });
    continue;
  }
  const poiId = typeof p.id === 'string' ? p.id : typeof p.poi_id === 'string' ? p.poi_id : null;
  if (poiId && seenPoi.has(poiId)) {
    rejected.push({ name, reason: `poi_id 重复（${poiId}）` });
    continue;
  }
  if (poiId) seenPoi.add(poiId);

  // 高德的 location 是 "lng,lat" 字符串；暂存格式直接给数字
  let lng: number | null = null;
  let lat: number | null = null;
  if (typeof p.location === 'string' && p.location.includes(',')) {
    const [a, b] = p.location.split(',');
    lng = Number(a);
    lat = Number(b);
  } else if (typeof p.lng === 'number' && typeof p.lat === 'number') {
    lng = p.lng;
    lat = p.lat;
  }
  if (lng === null || lat === null || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    // 缺坐标不丢弃：暂存为 null，留给人工地理编码或实地选点
    rejected.push({ name, reason: '暂存待人工补坐标' });
    staged.push({ name, area_hint: null, cuisine_guess: null, address: typeof p.address === 'string' && p.address ? p.address : null, lng: null, lat: null, poi_id: poiId, provider: 'amap', verified: false, source: { site: '高德扫街榜人工记录 / POI 检索', retrieved_at: today, poi_id: poiId } });
    continue;
  }
  if (!isValidGcj02(lng, lat)) {
    rejected.push({ name, reason: `坐标 ${lng},${lat} 不是合法 GCJ-02` });
    continue;
  }
  if (!inBeijing(lng, lat)) {
    rejected.push({ name, reason: `坐标 ${lng},${lat} 在北京范围外` });
    continue;
  }
  staged.push({
    name,
    area_hint: null,
    cuisine_guess: null,
    address: typeof p.address === 'string' && p.address ? p.address : null,
    lng,
    lat,
    poi_id: poiId,
    provider: 'amap',
    verified: false,
    source: { site: '高德开放平台 搜索POI / 扫街榜人工记录', retrieved_at: today, poi_id: poiId },
  });
}

const output = {
  _meta: {
    title: '京城黔味地图 · 高德来源门店候选（未核验，暂存）',
    retrieved_at: today,
    retrieval_method: '高德开放平台 Web 服务·搜索POI 导出，或扫街榜人工记录（本文件由 scripts/import-amap-candidates.mts 规范化生成）',
    status: 'unverified_candidates',
    why_not_in_seed:
      'packages/contracts/src/seed.ts 的合同是「这里全是合成数据、is_test_data=true、production 拒绝装载」。真实商家进合成种子会让水印变成假标签。',
    why_not_loaded: [
      '缺人工核验：坐标通过校验只说明「格式与范围合法」，不说明「这家店真在这里、还在营业」。地点核验必须由人完成。',
      '缺在营确认：高德条目可能已闭店/搬迁，检索快照不等于当前事实。',
      '第三方数据许可未确认：高德开放平台条款对存储与展示有约定，确认前本文件只保留接入所需最少字段（店名/地址/坐标/poi_id），不搬运评分、评论、榜单文案或图片。',
      '菜系归属为空：AMap 类型码映射不到本仓库的四个菜系，需人工判断后补 cuisine_guess。',
    ],
    next_step:
      '人工逐条核验（门牌 + 坐标 + 是否在营业 + 菜系）→ 通过后走「建店候选 → 地点核验」流程入库；未核验前不得进任何公开图层。',
    field_contract: {
      name: '高德返回的原始店名，未做美化或补全',
      address: '高德返回的地址原文；null = 高德未给',
      lng_lat: 'GCJ-02（高德原生口径），已通过 isValidGcj02 与北京范围校验；null = 缺坐标，待人工补',
      poi_id: '高德 POI ID，供引擎候选去重（provider+poi_id）',
      cuisine_guess: 'null = 人工判断后填写（guizhou/sichuan/chongqing/yunnan/other）',
      verified: '一律 false，只有人能改成 true',
    },
  },
  candidates: staged,
};

writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`[import-amap] 暂存 ${staged.length} 条 → ${outPath}`);
for (const r of rejected) console.log(`[import-amap]   跳过：${r.name} —— ${r.reason}`);
console.log('[import-amap] 提醒：暂存 ≠ 核验。在营状态、门牌、菜系、风险仍需人工确认后才能走候选/核验流程。');
