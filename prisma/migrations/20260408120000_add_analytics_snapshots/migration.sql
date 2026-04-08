-- analytics_snapshots is used as a lightweight server-side cache for analytics full payload.
-- It is not modeled in Prisma schema, so we create it via raw migration SQL.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  range_key TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

