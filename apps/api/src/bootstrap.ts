import { RuleViolation, Store } from '@qianwei/contracts';
import { parseDump, DocumentRepository } from './db/repository';
import { applyMigrations, assertWritable, openDatabase, resolveMigrationsDir, StartupError } from './db/sqlite';
import { createApp, type App } from './app';
import type { AppConfig } from './env';

/**
 * 启动装配：迁移 → 领域引擎 → 读回持久化状态 → HTTP 外壳。
 * NODE_ENV=production 时 Store 会拒绝装载测试种子（RuleViolation），这里统一包成启动错误。
 */

export class BootError extends Error {}

export interface Booted {
  app: App;
  repo: DocumentRepository;
  db: ReturnType<typeof openDatabase>;
  migrations: { applied: string[]; skipped: string[] };
  /** true = 状态从 SQLite 读回；false = 由测试种子初始化并落库。 */
  restored: boolean;
  close: () => void;
}

export function createStore(cfg: AppConfig): Store {
  const env = cfg.nodeEnv === 'production' ? 'production' : cfg.nodeEnv === 'test' ? 'test' : 'development';
  try {
    // production：空引擎启动（不装种子），随后从 SQLite 恢复真实核验数据；库为空即干净的上线初态
    return new Store({ env, seed: env !== 'production' });
  } catch (err) {
    if (err instanceof RuleViolation) {
      throw new BootError('NODE_ENV=production 下禁止装载合成测试种子：请先接入真实核验数据源，再以 production 启动');
    }
    throw new BootError('领域引擎初始化失败');
  }
}

export function boot(cfg: AppConfig): Booted {
  const db = openDatabase(cfg.sqlitePath);
  let migrations;
  let repo: DocumentRepository;
  try {
    migrations = applyMigrations(db, resolveMigrationsDir());
    repo = new DocumentRepository(db);
    const store = createStore(cfg);
    const persisted = repo.load();
    let restored = false;
    if (persisted) {
      store.loadState(JSON.stringify(persisted));
      restored = true;
    } else {
      repo.save(parseDump(store.dumpState()), { force: true });
    }
    const app = createApp({ config: cfg, store, repo, db, readiness: () => assertWritable(db) });
    return {
      app,
      repo,
      db,
      migrations,
      restored,
      close: () => {
        try {
          db.close();
        } catch (err) {
          if (!(err instanceof StartupError)) {
            process.stderr.write(`[api] 关闭数据库连接时出错：${err instanceof Error ? err.name : '未知'}\n`);
          }
        }
      },
    };
  } catch (err) {
    try {
      db.close();
    } catch {
      /* 已经关闭 */
    }
    throw err;
  }
}
