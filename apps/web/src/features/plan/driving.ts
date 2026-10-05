import { load as loadAmapJsApi } from '@amap/amap-jsapi-loader';
import { readEnv } from '../map/adapters.util';

/**
 * 行程规划的驾车估算（高德 JSAPI Driving 插件）。
 *
 * 合规口径与底图一致：路线距离/时长只在页面上**当场展示**，不写入数据库、不进快照
 * （高德条款禁止把检索结果存储建库——能读取不等于允许永久保存）。列表数据全部来自
 * 本应用自有坐标；高德只回答"这两点之间驾车多远多久"。
 *
 * 任何一步不可用（无 Key / SDK 加载失败 / 服务异常）都返回 null，页面降级为直线距离，绝不阻塞编辑。
 */

export interface DriveLegEstimate {
  meters: number;
  seconds: number;
}

interface DrivingRoute {
  distance: number | string;
  time: number | string;
}

interface DrivingResult {
  routes?: DrivingRoute[];
}

interface DrivingPlugin {
  search(
    origin: unknown,
    destination: unknown,
    callback: (status: string, result: DrivingResult) => void,
  ): void;
}

interface AMapNamespace {
  LngLat: new (lng: number, lat: number) => unknown;
  Driving: new (opts: Record<string, unknown>) => DrivingPlugin;
}

let cached: Promise<AMapNamespace | null> | null = null;

function loadAmap(): Promise<AMapNamespace | null> {
  if (!cached) {
    cached = (async () => {
      const key = readEnv('VITE_AMAP_KEY');
      if (!key) return null;
      const securityCode = readEnv('VITE_AMAP_SECURITY_CODE');
      if (securityCode) {
        const w = globalThis as { _AMapSecurityConfig?: { securityJsCode?: string } };
        w._AMapSecurityConfig = { ...(w._AMapSecurityConfig ?? {}), securityJsCode: securityCode };
      }
      try {
        return (await loadAmapJsApi({ key, version: '2.0', plugins: ['AMap.Driving'] })) as AMapNamespace;
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

function searchLeg(NS: AMapNamespace, driving: DrivingPlugin, from: { lng: number; lat: number }, to: { lng: number; lat: number }): Promise<DriveLegEstimate | null> {
  return new Promise((resolve) => {
    try {
      driving.search(new NS.LngLat(from.lng, from.lat), new NS.LngLat(to.lng, to.lat), (status, result) => {
        const route = status === 'complete' ? result?.routes?.[0] : undefined;
        const meters = Number(route?.distance);
        const seconds = Number(route?.time);
        if (!Number.isFinite(meters) || meters <= 0 || !Number.isFinite(seconds)) {
          resolve(null);
          return;
        }
        resolve({ meters, seconds });
      });
    } catch {
      resolve(null);
    }
  });
}

/** 依次估算相邻两站间的驾车距离与时长；任一段失败整批降级为 null（页面回退直线距离）。 */
export async function estimateDriveLegs(points: Array<{ lng: number; lat: number }>): Promise<DriveLegEstimate[] | null> {
  if (points.length < 2) return [];
  const NS = await loadAmap();
  if (!NS) return null;
  let driving: DrivingPlugin;
  try {
    driving = new NS.Driving({ policy: 0 });
  } catch {
    return null;
  }
  const legs: DriveLegEstimate[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const leg = await searchLeg(NS, driving, points[i]!, points[i + 1]!);
    if (!leg) return null;
    legs.push(leg);
  }
  return legs;
}
