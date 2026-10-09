-- 音标、音频与任务信息保持独立，避免污染原有词汇表。
CREATE TABLE IF NOT EXISTS vocabulary_pronunciations (
  id SERIAL PRIMARY KEY,
  normalized_word TEXT NOT NULL,
  locale VARCHAR(16) NOT NULL,
  ipa TEXT NOT NULL,
  alphabet VARCHAR(16) NOT NULL DEFAULT 'IPA',
  part_of_speech VARCHAR(80),
  variant_label VARCHAR(32) NOT NULL DEFAULT 'primary',
  source_provider VARCHAR(80) NOT NULL,
  source_entry_id VARCHAR(255),
  source_version VARCHAR(80),
  source_license TEXT,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'imported',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  UNIQUE (normalized_word, locale, ipa, part_of_speech)
);

CREATE INDEX IF NOT EXISTS vocabulary_pronunciations_word_locale_idx ON vocabulary_pronunciations (normalized_word, locale);

CREATE TABLE IF NOT EXISTS vocabulary_word_pronunciations (
  word_id INTEGER NOT NULL REFERENCES vocabulary_words (id) ON DELETE CASCADE,
  pronunciation_id INTEGER NOT NULL REFERENCES vocabulary_pronunciations (id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (word_id, pronunciation_id)
);

CREATE INDEX IF NOT EXISTS vocabulary_word_pronunciations_pronunciation_idx ON vocabulary_word_pronunciations (pronunciation_id);

CREATE TABLE IF NOT EXISTS vocabulary_pronunciation_audio (
  id SERIAL PRIMARY KEY,
  pronunciation_id INTEGER NOT NULL REFERENCES vocabulary_pronunciations (id) ON DELETE CASCADE,
  provider VARCHAR(80) NOT NULL,
  voice_name VARCHAR(120) NOT NULL,
  voice_locale VARCHAR(16) NOT NULL,
  audio_encoding VARCHAR(24) NOT NULL,
  speaking_rate NUMERIC(4, 2) NOT NULL DEFAULT 1,
  pitch NUMERIC(4, 2) NOT NULL DEFAULT 0,
  request_fingerprint CHAR(64) NOT NULL,
  bucket VARCHAR(120),
  object_key TEXT,
  public_url TEXT,
  qiniu_hash VARCHAR(128),
  byte_size INTEGER,
  duration_ms INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_code VARCHAR(80),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  UNIQUE (pronunciation_id, request_fingerprint)
);

CREATE INDEX IF NOT EXISTS vocabulary_pronunciation_audio_status_idx ON vocabulary_pronunciation_audio (status);

CREATE TABLE IF NOT EXISTS media_generation_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  batch_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_generation_jobs_idempotency_idx ON media_generation_jobs (
  job_type,
  target_type,
  target_id,
  COALESCE(batch_id, '')
);

CREATE INDEX IF NOT EXISTS media_generation_jobs_queue_idx ON media_generation_jobs (status, next_attempt_at);
