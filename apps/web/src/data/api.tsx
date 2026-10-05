import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiClient } from './client';
import { StaticClient } from './client';
import { Http } from './http';
import type { DeploymentMeta, SessionUser } from '@qianwei/contracts';

interface ApiState {
  api: ApiClient;
  user: SessionUser | null;
  ready: boolean;
  /** 部署自描述（获取失败为 null，水印走保守显示）。 */
  meta: DeploymentMeta | null;
  /** demo 数据水印：静态模式或后端 demo 模式都必须显示。 */
  demoBadge: string;
  /** 种子档案（同步可得，决定默认图层与页脚文案）。 */
  seedProfile: 'synthetic' | 'real';
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<ApiState | null>(null);

function makeClient(): ApiClient {
  const base = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (base) return new Http(base.replace(/\/api\/?$/, '') + '/api/v1');
  return new StaticClient();
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const api = useMemo(makeClient, []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<DeploymentMeta | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null);
    } finally {
      setReady(true)
    }
    // 部署自描述失败时按 null 处理：水印按保守（显示）策略走
    setMeta(await api.meta().catch(() => null));
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, [api]);

  // 演示水印跟着部署事实走：production 且未装载测试种子 = 干净上线态，不显示任何标记；
  // 合成档案（synthetic）按红线必须带「演示数据」水印，真实档案不显示任何阶段字样
  const showDemoBadge = meta === null || meta.env !== 'production' || meta.test_data_loaded;
  const demoBadge = !showDemoBadge
    ? ''
    : api.seedProfile === 'synthetic'
      ? api.mode === 'static'
        ? '演示数据 · 存在本机浏览器'
        : '演示数据 · 含合成测试内容'
      : '';

  const value: ApiState = {
    api,
    user,
    ready,
    meta,
    demoBadge,
    seedProfile: api.seedProfile,
    refresh,
    setUser,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApi(): ApiState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApi 必须在 ApiProvider 内使用');
  return v;
}
