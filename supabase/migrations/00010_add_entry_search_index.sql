-- pg_trgm 拡張によるエントリ全文検索（日本語トライグラム対応）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ILIKE '%keyword%' を高速化する GIN インデックス
CREATE INDEX idx_entries_content_trgm ON public.entries USING gin (content gin_trgm_ops);
