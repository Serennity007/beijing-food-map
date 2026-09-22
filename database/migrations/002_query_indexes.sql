-- 002_query_indexes.sql — 演示"多迁移按版本顺序应用"
-- 支撑"按门店取全部内容 / 按归属者取清单"两类查询。

CREATE INDEX IF NOT EXISTS idx_documents_kind_updated ON documents (kind, updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_owner_kind ON documents (owner_user_id, kind);
