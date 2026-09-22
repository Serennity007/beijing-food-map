/// <reference types="vite/client" />

/**
 * 构建期注入的环境变量（见 .env.example）。
 * demo 只读这几个键，任何一项缺失都不该让页面抛异常。
 */
interface ImportMetaEnv {
  readonly VITE_BASE?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_MAP_STYLE?: string;
  readonly VITE_MAP_FALLBACK_STYLE?: string;
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
