-- 001_init.sql — 京城黔味地图 demo 的初始模式
-- 领域状态由 @qianwei/contracts 的 Store 计算，落库时按"记录"拆成 documents 行：
-- 一个门店/用户/实吃/清单/发布/举报/审计/幂等键/会话各一行，body 是规范化 JSON。
-- 这样重启后可以逐条读回并重建 Store，而不是一整块 state 直写。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  kind          TEXT NOT NULL,
  id            TEXT NOT NULL,
  owner_user_id TEXT,
  restaurant_id TEXT,
  body          TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents (kind);
CREATE INDEX IF NOT EXISTS idx_documents_restaurant ON documents (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_user_id);

-- 就绪探针写这张表验证"文件真的可写"；不存任何业务数据。
CREATE TABLE IF NOT EXISTS write_probe (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL
);
