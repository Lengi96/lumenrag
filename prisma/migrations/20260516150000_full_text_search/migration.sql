CREATE INDEX IF NOT EXISTS "Chunk_content_fts_idx"
ON "Chunk"
USING GIN (to_tsvector('simple', content));
