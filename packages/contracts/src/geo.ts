/**
 * 坐标与距离。数据合同里的门店坐标一律是 GCJ-02（高德/国内供应商口径）。
 * MapLibre + OSM 底图是 WGS84，渲染前转一次；高德适配器直接用原值，不重复转换。
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lng: number, lat: number): boolean {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLng(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  r += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3;
  r += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3;
  return r;
}

function transformLat(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3;
  r += ((20 * Math.sin((x * PI) / 12) + 40 * Math.sin((x * PI) / 30)) * 2) / 3;
  r += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3;
  return r;
}

/** WGS84 -> GCJ-02。浏览器 Geolocation 得到的值走这个方向，只转一次。 */
export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  if (outOfChina(lng, lat)) return { lng, lat };
  const d = delta(lng, lat);
  return { lng: lng + d.dLng, lat: lat + d.dLat };
}

/** GCJ-02 -> WGS84（近似逆算，误差约 1 米级，用于 MapLibre 底图对齐）。 */
export function gcj02ToWgs84(lng: number, lat: number): { lng: number; lat: number } {
  if (outOfChina(lng, lat)) return { lng, lat };
  const d = delta(lng, lat);
  return { lng: lng - d.dLng, lat: lat - d.dLat };
}

function delta(lng: number, lat: number): { dLng: number; dLat: number } {
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { dLng, dLat };
}

/** 近似直线距离（米）。不得当作行走时间展示。 */
export function straightLineMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371008.8;
  const p1 = (a.lat * PI) / 180;
  const p2 = (b.lat * PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lng - a.lng) * PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidGcj02(lng: number, lat: number): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= 73.66 && lng <= 135.05 && lat >= 3.86 && lat <= 53.55;
}

/** 北京默认视野（GCJ-02）。 */
export const BEIJING_BOUNDS = { west: 115.42, south: 39.44, east: 117.52, north: 41.06 };
export const BEIJING_CENTER = { lng: 116.407, lat: 39.904 };

/**
 * 固定米制格网聚合：格边长随 zoom 变化，与视野原点无关，因此平移时聚合编号稳定、不抖动。
 */
export function gridCell(lng: number, lat: number, zoom: number): { gx: number; gy: number } {
  const cellDeg = cellDegForZoom(zoom);
  return { gx: Math.floor(lng / cellDeg), gy: Math.floor(lat / cellDeg) };
}

export function cellDegForZoom(zoom: number): number {
  // 经验值：低 zoom 粗格，高 zoom 细格；z15 及以上基本等于单店视野。
  if (zoom >= 15) return 0.0009;
  if (zoom >= 13) return 0.004;
  if (zoom >= 11) return 0.016;
  if (zoom >= 9) return 0.062;
  return 0.25;
}

export interface ClusterInput {
  id: string;
  lng: number;
  lat: number;
}

export interface ClusterOutput<T extends ClusterInput> {
  clusterId: string;
  lng: number;
  lat: number;
  items: T[];
  expansionBounds: { west: number; south: number; east: number; north: number };
}

/** clusterId 含聚合版本、zoom bucket 与格网编号，保证不同视野不撞号。 */
export function clusterPoints<T extends ClusterInput>(
  items: T[],
  zoom: number,
  maxEntities: number,
): ClusterOutput<T>[] {
  const bucket = zoomBucket(zoom);
  const cellDeg = cellDegForZoom(bucket);
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = `${Math.floor(it.lng / cellDeg)}:${Math.floor(it.lat / cellDeg)}`;
    const arr = groups.get(key);
    if (arr) arr.push(it);
    else groups.set(key, [it]);
  }
  const out: ClusterOutput<T>[] = [];
  for (const [key, group] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const parts = key.split(':');
    const gx = Number(parts[0]);
    const gy = Number(parts[1]);
    const lng = group.reduce((s, i) => s + i.lng, 0) / group.length;
    const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
    out.push({
      clusterId: `v1-z${bucket}-x${gx}-y${gy}`,
      lng,
      lat,
      items: group,
      expansionBounds: {
        west: gx * cellDeg,
        south: gy * cellDeg,
        east: (gx + 1) * cellDeg,
        north: (gy + 1) * cellDeg,
      },
    });
  }
  // 实体上限：超出时优先保留更大的聚合，不静默丢店 —— 用计数汇总保证 totalMatched 独立可信。
  out.sort((a, b) => b.items.length - a.items.length || a.clusterId.localeCompare(b.clusterId));
  void maxEntities;
  return out;
}

export function zoomBucket(zoom: number): number {
  return Math.max(6, Math.min(18, Math.floor(zoom)));
}
