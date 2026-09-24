import type { DatabaseSync } from 'node:sqlite';
import { stableHash } from '@qianwei/contracts';

/**
 * documents 表 = Store 的落库形态。
 * Store.dumpState() 给出规范化 JSON，这里按记录拆行写入；读回时重组 JSON 交给 loadState()。
 * 只有一张业务表（documents）+ 迁移追踪表，避免和"引擎在内存里算派生字段"打架。
 */

export const ENTITY_KINDS = [
  'restaurant',
  'candidate',
  'user',
  'visit',
  'media',
  'collection',
  'publication',
  'report',
  'audit',
  'idempotency',
  'session',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];
export type DocKind = EntityKind | 'meta';
export const ALL_KINDS: DocKind[] = [...ENTITY_KINDS, 'meta'];

export type JsonRecord = Record<string, unknown>;

/** 与 Store.dumpState() 的 JSON 一一对应。 */
export interface DumpedState {
  schema: number;
  results_version: number;
  seq: number;
  last_computed_day: string | null;
  restaurants: JsonRecord[];
  candidates: JsonRecord[];
  users: JsonRecord[];
  visits: JsonRecord[];
  media: JsonRecord[];
  collections: JsonRecord[];
  publications: JsonRecord[];
  reports: JsonRecord[];
  audit: JsonRecord[];
  idempotency: JsonRecord[];
  sessions: Array<[string, JsonRecord]>;
}

interface Row {
  kind: DocKind;
  id: string;
  owner_user_id: string | null;
  restaurant_id: string | null;
  body: string;
  updated_at: string;
}

function str(rec: JsonRecord, key: string): string {
  const v = rec[key];
  return typeof v === 'string' ? v : '';
}

function optStr(rec: JsonRecord, key: string): string | null {
  const v = rec[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function requiredId(kind: DocKind, rec: JsonRecord, fallback: string): string {
  const id = str(rec, 'id') || fallback;
  if (!id) throw new Error(`documents:${kind} 记录缺少 id`);
  return id;
}

function rowsFor(kind: DocKind, state: DumpedState, at: string): Row[] {
  const out: Row[] = [];
  const push = (id: string, rec: JsonRecord, owner: string | null, rid: string | null, updatedAt: string) => {
    out.push({ kind, id, owner_user_id: owner, restaurant_id: rid, body: JSON.stringify(rec), updated_at: updatedAt || at });
  };
  switch (kind) {
    case 'restaurant':
      for (const r of state.restaurants) push(requiredId('restaurant', r, str(r, 'id')), r, null, str(r, 'id'), str(r, 'updated_at'));
      break;
    case 'user':
      for (const u of state.users) push(requiredId('user', u, str(u, 'id')), u, str(u, 'id'), null, at);
      break;
    case 'candidate':
      for (const c of state.candidates) {
        push(requiredId('candidate', c, str(c, 'id')), c, optStr(c, 'submitted_by'), optStr(c, 'restaurant_id'), str(c, 'updated_at'));
      }
      break;
    case 'visit':
      for (const v of state.visits) {
        const revisions = Array.isArray(v['revisions']) ? (v['revisions'] as JsonRecord[]) : [];
        const last = revisions[revisions.length - 1];
        push(
          requiredId('visit', v, str(v, 'id')),
          v,
          optStr(v, 'user_id'),
          optStr(v, 'restaurant_id'),
          last ? str(last, 'decided_at') || str(last, 'submitted_at') : at,
        );
      }
      break;
    case 'media':
      for (const m of state.media) push(requiredId('media', m, str(m, 'id')), m, optStr(m, 'owner_user_id'), optStr(m, 'restaurant_id'), at);
      break;
    case 'collection':
      for (const c of state.collections) push(requiredId('collection', c, str(c, 'id')), c, optStr(c, 'owner_user_id'), null, str(c, 'updated_at'));
      break;
    case 'publication': {
      const ownerByCollection = new Map<string, string>();
      for (const c of state.collections) ownerByCollection.set(str(c, 'id'), str(c, 'owner_user_id'));
      for (const p of state.publications) {
        const cid = str(p, 'collection_id');
        const rid = Array.isArray(p['items']) ? optStr((p['items'] as JsonRecord[])[0] ?? {}, 'restaurant_id') : null;
        push(requiredId('publication', p, str(p, 'id')), p, ownerByCollection.get(cid) ?? null, rid, str(p, 'created_at'));
      }
      break;
    }
    case 'report':
      for (const r of state.reports) push(requiredId('report', r, str(r, 'id')), r, optStr(r, 'reporter_id'), optStr(r, 'restaurant_id'), str(r, 'created_at'));
      break;
    case 'audit':
      for (const a of state.audit) push(requiredId('audit', a, str(a, 'id')), a, optStr(a, 'actor_id'), null, str(a, 'at'));
      break;
    case 'idempotency':
      for (const i of state.idempotency) {
        const id = `${str(i, 'user_id')}:${str(i, 'route')}:${str(i, 'key')}`;
        push(requiredId('idempotency', i, id), i, optStr(i, 'user_id'), null, str(i, 'created_at'));
      }
      break;
    case 'session':
      for (const [sid, s] of state.sessions) push(sid, s, optStr(s, 'user_id'), null, str(s, 'created_at'));
      break;
    case 'meta': {
      const body: JsonRecord = {
        schema: state.schema,
        results_version: state.results_version,
        seq: state.seq,
        last_computed_day: state.last_computed_day,
      };
      push('state', body, null, null, at);
      break;
    }
  }
  return out;
}

function emptyState(): DumpedState {
  return {
    schema: 1,
    results_version: 1,
    seq: 1,
    last_computed_day: null,
    restaurants: [],
    candidates: [],
    users: [],
    visits: [],
    media: [],
    collections: [],
    publications: [],
    reports: [],
    audit: [],
    idempotency: [],
    sessions: [],
  };
}

export function parseDump(json: string): DumpedState {
  const raw = JSON.parse(json) as Partial<DumpedState>;
  return {
    schema: typeof raw.schema === 'number' ? raw.schema : 1,
    results_version: typeof raw.results_version === 'number' ? raw.results_version : 1,
    seq: typeof raw.seq === 'number' ? raw.seq : 1,
    last_computed_day: typeof raw.last_computed_day === 'string' ? raw.last_computed_day : null,
    restaurants: raw.restaurants ?? [],
    candidates: raw.candidates ?? [],
    users: raw.users ?? [],
    visits: raw.visits ?? [],
    media: raw.media ?? [],
    collections: raw.collections ?? [],
    publications: raw.publications ?? [],
    reports: raw.reports ?? [],
    audit: raw.audit ?? [],
    idempotency: raw.idempotency ?? [],
    sessions: raw.sessions ?? [],
  };
}

export class DocumentRepository {
  private signatures = new Map<DocKind, string>();

  constructor(
    private readonly db: DatabaseSync,
    private readonly stamp: () => string = () => new Date().toISOString(),
  ) {}

  private allRows(): Row[] {
    return this.db
      .prepare('SELECT kind, id, owner_user_id, restaurant_id, body, updated_at FROM documents ORDER BY kind, id')
      .all()
      .map((r) => ({
        kind: String(r['kind'] ?? '') as DocKind,
        id: String(r['id'] ?? ''),
        owner_user_id: r['owner_user_id'] == null ? null : String(r['owner_user_id']),
        restaurant_id: r['restaurant_id'] == null ? null : String(r['restaurant_id']),
        body: String(r['body'] ?? ''),
        updated_at: String(r['updated_at'] ?? ''),
      }));
  }

  /** 空库（或只有探针行）返回 null，让上层用测试种子初始化。 */
  load(): DumpedState | null {
    const state = emptyState();
    let meta: JsonRecord | null = null;
    let seen = 0;
    for (const row of this.allRows()) {
      let rec: JsonRecord;
      try {
        rec = JSON.parse(row.body) as JsonRecord;
      } catch {
        continue; // 坏行不参与重组，避免整库读不回来
      }
      switch (row.kind) {
        case 'restaurant':
          state.restaurants.push(rec);
          seen += 1;
          break;
        case 'user':
          state.users.push(rec);
          seen += 1;
          break;
        case 'candidate':
          state.candidates.push(rec);
          seen += 1;
          break;
        case 'visit':
          state.visits.push(rec);
          seen += 1;
          break;
        case 'media':
          state.media.push(rec);
          seen += 1;
          break;
        case 'collection':
          state.collections.push(rec);
          seen += 1;
          break;
        case 'publication':
          state.publications.push(rec);
          seen += 1;
          break;
        case 'report':
          state.reports.push(rec);
          seen += 1;
          break;
        case 'audit':
          state.audit.push(rec);
          seen += 1;
          break;
        case 'idempotency':
          state.idempotency.push(rec);
          seen += 1;
          break;
        case 'session':
          state.sessions.push([row.id, rec]);
          seen += 1;
          break;
        case 'meta':
          meta = rec;
          break;
      }
    }
    if (seen === 0) return null;
    if (meta) {
      if (typeof meta['results_version'] === 'number') state.results_version = meta['results_version'];
      if (typeof meta['seq'] === 'number') state.seq = meta['seq'];
      if (typeof meta['last_computed_day'] === 'string') state.last_computed_day = meta['last_computed_day'];
      if (typeof meta['schema'] === 'number') state.schema = meta['schema'];
    }
    return state;
  }

  countByKind(): Partial<Record<DocKind, number>> {
    const rows = this.db.prepare('SELECT kind, COUNT(*) AS n FROM documents GROUP BY kind').all();
    const out: Partial<Record<DocKind, number>> = {};
    for (const r of rows) out[String(r['kind']) as DocKind] = Number(r['n'] ?? 0);
    return out;
  }

  /**
   * 写穿：只重写内容变了的 kind，但一个事务内完成"删旧插新"。
   * 签名只在同进程内有意义（跨进程首次保存 force=true），不影响正确性。
   */
  save(state: DumpedState, opts: { force?: boolean } = {}): DocKind[] {
    const groups = ALL_KINDS.map((kind) => ({ kind, rows: rowsFor(kind, state, this.stamp()) }));
    const changed = groups.map((g) => ({
      ...g,
      sig: stableHash(g.rows.map((r) => `${r.id}\u0000${r.body}`).join('\u0001')),
    })).filter((g) => opts.force || this.signatures.get(g.kind) !== g.sig);
    if (changed.length === 0) return [];
    const del = this.db.prepare('DELETE FROM documents WHERE kind = ?');
    const ins = this.db.prepare(
      'INSERT INTO documents (kind, id, owner_user_id, restaurant_id, body, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const g of changed) {
        del.run(g.kind);
        for (const r of g.rows) ins.run(r.kind, r.id, r.owner_user_id, r.restaurant_id, r.body, r.updated_at);
      }
      this.db.exec('COMMIT;');
      // BEGIN 失败也不能提前缓存签名，否则重试会误以为已经写入。
      for (const g of changed) this.signatures.set(g.kind, g.sig);
    } catch (err) {
      this.db.exec('ROLLBACK;');
      for (const g of changed) this.signatures.delete(g.kind);
      throw err;
    }
    return changed.map((g) => g.kind);
  }
}
