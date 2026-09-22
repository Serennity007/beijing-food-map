import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ApiClient } from './client';
import { StaticClient } from './client';
import { Http } from './http';
import type { SessionUser } from '@qianwei/contracts';

interface ApiState {
  api: ApiClient;
  user: SessionUser | null;
  ready: boolean;
  /** demo 数据水印：静态模式或后端 demo 模式都必须显示。 */
  demoBadge: string;
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

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, [api]);

  const value: ApiState = {
    api,
    user,
    ready,
    demoBadge: api.mode === 'static' ? '演示数据 · 存在本机浏览器' : '演示后端 · 合成测试数据',
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
