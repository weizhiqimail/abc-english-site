CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id VARCHAR(128),
  vercel_id VARCHAR(255),
  deployment_id VARCHAR(255),
  environment VARCHAR(32) NOT NULL,
  method VARCHAR(16),
  path TEXT,
  user_id INTEGER,
  error_name VARCHAR(120) NOT NULL,
  error_code VARCHAR(120),
  message TEXT NOT NULL,
  stack TEXT,
  fingerprint CHAR(64) NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs (created_at);

CREATE INDEX IF NOT EXISTS error_logs_fingerprint_created_at_idx ON error_logs (fingerprint, created_at);

CREATE INDEX IF NOT EXISTS error_logs_request_id_idx ON error_logs (request_id);
