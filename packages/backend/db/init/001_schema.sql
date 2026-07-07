-- Coverage Copilot schema (build-spec §5)
-- Runs once, on first container start, via Postgres's docker-entrypoint-initdb.d.
-- NOTE: plain init scripts are fine for a from-scratch demo DB. Production needs
-- a real migration tool (node-pg-migrate / Prisma Migrate) for repeatable,
-- versioned schema changes across environments.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE businesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  industry    TEXT NOT NULL,
  naics_code  TEXT,
  profile     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE policies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  storage_url  TEXT NOT NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_policies_business_id ON policies(business_id);

-- Dimension matches the embedding model chosen in Milestone 2 (e.g. 1536 for
-- OpenAI text-embedding-3-small or Voyage). Revisit if that choice changes.
CREATE TABLE policy_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  chunk_text  TEXT NOT NULL,
  embedding   VECTOR(1536) NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_policy_chunks_policy_id ON policy_chunks(policy_id);

-- HNSW over ivfflat: no training step needed on an empty/small table, and
-- Milestone 3's retrieval queries can rely on it immediately.
CREATE INDEX idx_policy_chunks_embedding ON policy_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE risk_reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'PENDING',
  temporal_workflow_id TEXT,
  result               JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_reviews_business_id ON risk_reviews(business_id);

CREATE TABLE coverage_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  question     TEXT NOT NULL,
  answer       TEXT NOT NULL,
  citations    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coverage_answers_business_id ON coverage_answers(business_id);
