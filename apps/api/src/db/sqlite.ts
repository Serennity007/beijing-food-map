import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/** 只依赖 Node 内建 node:sqlite；无原生编译依赖，免费层镜像即可跑。 */

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export class StartupError extends Error {}

function here(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * 迁移目录定位：优先相对本文件（打包/容器内都成立），再回退到 cwd。
 * 找不到就明确报错，绝不"静默无迁移"启动。
 */
export function resolveMigrationsDir(explicit?: string): string {
  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  const fromModule = isAbsolute(explicit ?? '') ? [] : [
    resolve(here(), '../../../database/migrations'),
    resolve(here(), '../../../../database/migrations'),
  ];
  candidates.push(...fromModule, resolve(process.cwd(), 'database/migrations'), resolve(process.cwd(), '../../database/migrations'));
  for (const c of candidates) {
    if (existsSync(c) && readdirSync(c).some((f) => f.endsWith('.sql'))) return c;
  }
  throw new StartupError('未找到数据库迁移目录 database/migrations');
}

export function readMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d[\dA-Za-z_.-]*\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => ({ version: f.replace(/\.sql$/, ''), name: f, sql: readFileSync(join(dir, f), 'utf8') }));
}

export function openDatabase(sqlitePath: string): DatabaseSync {
  const abs = resolve(sqlitePath);
  const parent = dirname(abs);
  if (!existsSync(parent)) {
    try {
      mkdirSync(parent, { recursive: true });
    } catch {
      throw new StartupError('SQLite 目录不可创建，检查 SQLITE_PATH 指向的位置');
    }
  }
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(abs);
  } catch {
    throw new StartupError('SQLite 文件无法打开，检查 SQLITE_PATH 指向的位置');
  }
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = FULL;');
  return db;
}

/** 已应用版本记在 schema_migrations；未应用的按文件名顺序在事务内执行。 */
export function applyMigrations(db: DatabaseSync, dir: string): MigrationResult {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);
  const done = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => String(r['version'] ?? '')),
  );
  const insert = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const m of readMigrations(dir)) {
    if (done.has(m.version)) {
      skipped.push(m.version);
      continue;
    }
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(m.sql);
      insert.run(m.version, m.name, new Date().toISOString());
      db.exec('COMMIT;');
      applied.push(m.version);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw new StartupError(`迁移 ${m.name} 应用失败：${err instanceof Error ? err.name : '未知错误'}`);
    }
  }
  return { applied, skipped };
}

/** 就绪检查：真的往 write_probe 写一行再删掉，证明文件可写。 */
export function assertWritable(db: DatabaseSync): boolean {
  try {
    const now = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE;');
    db.prepare('INSERT OR REPLACE INTO write_probe (id, at) VALUES (1, ?)').run(now);
    const back = db.prepare('SELECT at FROM write_probe WHERE id = 1').get();
    db.exec('DELETE FROM write_probe WHERE id = 1;');
    db.exec('COMMIT;');
    return String(back?.['at'] ?? '') === now;
  } catch {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* 事务已不在，忽略 */
    }
    return false;
  }
}
