import { parseDump, DocumentRepository } from './db/repository';
import { applyMigrations, openDatabase, resolveMigrationsDir } from './db/sqlite';
import { createStore } from './bootstrap';
import { ConfigError, readConfig } from './env';
import { StartupError } from './db/sqlite';
import type { DocKind } from './db/repository';

/**
 * npm run seed:test —— 把 @qianwei/contracts 的合成演示数据写进 SQLite。
 * NODE_ENV=production 直接拒绝：真实环境不允许出现测试门店/测试票。
 */

function refuse(message: string): never {
  process.stderr.write(`[seed:test] 拒绝执行：${message}\n`);
  process.exit(1);
}

function main(): void {
  let cfg;
  try {
    cfg = readConfig();
  } catch (err) {
    if (err instanceof ConfigError || err instanceof StartupError) refuse(err.message);
    refuse('配置读取失败');
  }
  if (cfg.nodeEnv === 'production') {
    refuse(
      '该脚本装载的是合成演示数据（测试门店、测试反馈、测试账号）。' +
        'NODE_ENV=production 时领域引擎 Store 也会拒绝装载测试种子；' +
        '要部署真实数据请先接入经人工核验的数据源，并移除 production 下的测试种子装载。',
    );
  }

  const db = openDatabase(cfg.sqlitePath);
  try {
    const migrations = applyMigrations(db, resolveMigrationsDir());
    const repo = new DocumentRepository(db);
    // 重置成基线：seed:test 的语义就是"把演示库恢复到可比对的初始状态"
    db.exec('BEGIN IMMEDIATE;');
    db.exec('DELETE FROM documents;');
    db.exec('COMMIT;');
    const store = createStore(cfg);
    const changed = repo.save(parseDump(store.dumpState()), { force: true });
    const counts = repo.countByKind();
    const summary = (Object.keys(counts) as DocKind[])
      .map((k) => `${k}=${counts[k] ?? 0}`)
      .join(' ');
    process.stdout.write(
      `[seed:test] 环境 ${cfg.nodeEnv} · 迁移 应用 ${migrations.applied.length} 跳过 ${migrations.skipped.length} · ` +
        `写入 ${changed.length} 类记录 · ${summary}\n` +
        `[seed:test] 今天的计票基准日（Asia/Shanghai）：${store.today()}\n`,
    );
  } catch (err) {
    refuse(err instanceof StartupError ? err.message : '种子写入失败');
  } finally {
    db.close();
  }
}

main();
