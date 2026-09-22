import { BootError, boot } from './bootstrap';
import { ConfigError, readConfig } from './env';
import { StartupError } from './db/sqlite';
import { API_BASE_PATH } from './env';
import type { AddressInfo } from 'node:net';

/**
 * 进程入口。任何启动失败都：
 * - 只输出固定的原因文案（不含环境变量值、不含堆栈）
 * - 退出码 1
 */

function fatal(reason: string): never {
  process.stderr.write(`[api] 启动失败：${reason}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const cfgResult = safe(() => readConfig());
  if (!cfgResult.ok) fatal(cfgResult.error);

  const cfg = cfgResult.value;
  const bootedResult = safe(() => boot(cfg));
  if (!bootedResult.ok) fatal(bootedResult.error);
  const booted = bootedResult.value;

  const portResult = await booted.app.listen().then(
    (port) => ({ ok: true as const, value: port }),
    () => ({ ok: false as const, error: '端口不可用或无监听权限' }),
  );
  if (!portResult.ok) {
    booted.close();
    fatal(portResult.error);
  }

  const address = booted.app.server.address() as AddressInfo | null;
  const shownPort = address?.port ?? cfg.port;
  process.stdout.write(
    `[api] 已监听 http://${cfg.host}:${shownPort}${API_BASE_PATH} · ` +
      `迁移 应用 ${booted.migrations.applied.length} 跳过 ${booted.migrations.skipped.length} · ` +
      `状态 ${booted.restored ? '已从 SQLite 读回' : '由合成测试种子初始化并落库'}\n`,
  );

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) return;
    closing = true;
    process.stderr.write(`[api] 收到 ${signal}，关闭监听\n`);
    void booted.app.close().finally(() => booted.close());
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function safe<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (err) {
    if (err instanceof ConfigError || err instanceof StartupError || err instanceof BootError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? `初始化异常（${err.name}）` : '初始化异常' };
  }
}

void main();
