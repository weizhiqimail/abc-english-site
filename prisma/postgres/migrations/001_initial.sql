CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "username" VARCHAR(80) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "nickname" VARCHAR(100) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'user',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "auth_tokens" (
  "id" SERIAL PRIMARY KEY,
  "token_hash" CHAR(64) NOT NULL UNIQUE,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens" ("user_id");

CREATE INDEX "auth_tokens_expires_at_idx" ON "auth_tokens" ("expires_at");

CREATE TABLE "collections" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  UNIQUE ("user_id", "name")
);

CREATE INDEX "collections_user_id_idx" ON "collections" ("user_id");

CREATE TABLE "favorites" (
  "id" SERIAL PRIMARY KEY,
  "collection_id" INTEGER NOT NULL REFERENCES "collections" ("id") ON DELETE CASCADE,
  "word_key" VARCHAR(100) NOT NULL,
  "record_id" VARCHAR(64) NOT NULL,
  "word_entry_id" VARCHAR(64),
  "translation_id" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("collection_id", "word_key")
);

CREATE INDEX "favorites_word_key_idx" ON "favorites" ("word_key");

CREATE TABLE "vocabulary_categories" (
  "record_id" VARCHAR(64) PRIMARY KEY,
  "subcategory_id" VARCHAR(64) NOT NULL,
  "level" VARCHAR(2) NOT NULL,
  "classification_index" INTEGER NOT NULL,
  "classification_key" VARCHAR(32) NOT NULL,
  "title" TEXT NOT NULL,
  "localized_title" TEXT,
  "description" TEXT,
  "localized_description" TEXT,
  "word_count" INTEGER NOT NULL,
  "estimated_learning_time_seconds" INTEGER
);

CREATE INDEX "vocabulary_categories_level_classification_idx" ON "vocabulary_categories" ("level", "classification_index");

CREATE TABLE "vocabulary_words" (
  "id" SERIAL PRIMARY KEY,
  "category_record_id" VARCHAR(64) NOT NULL REFERENCES "vocabulary_categories" ("record_id") ON DELETE CASCADE,
  "translation_id" VARCHAR(64) NOT NULL,
  "word_entry_id" VARCHAR(64),
  "position" INTEGER NOT NULL,
  "word" TEXT NOT NULL,
  "definition" TEXT,
  "localized_definition" TEXT,
  "localized_other_translations" TEXT,
  "part_of_speech_type" VARCHAR(80),
  "plural_form" TEXT,
  "composition" TEXT,
  "is_countable" BOOLEAN,
  "hypernyms" JSONB,
  "photo_original_title" TEXT,
  "photo_url" TEXT,
  "photo_thumbnail_url" TEXT,
  UNIQUE ("category_record_id", "position")
);

CREATE INDEX "vocabulary_words_category_translation_idx" ON "vocabulary_words" ("category_record_id", "translation_id");

CREATE INDEX "vocabulary_words_word_idx" ON "vocabulary_words" ("word");

CREATE INDEX "vocabulary_words_search_idx" ON "vocabulary_words" USING GIN (
  to_tsvector (
    'simple',
    COALESCE("word", '') || ' ' || COALESCE("definition", '') || ' ' || COALESCE("localized_definition", '') || ' ' || COALESCE("localized_other_translations", '')
  )
);

CREATE TABLE "vocabulary_examples" (
  "id" SERIAL PRIMARY KEY,
  "source_id" VARCHAR(64),
  "word_id" INTEGER NOT NULL REFERENCES "vocabulary_words" ("id") ON DELETE CASCADE,
  "position" INTEGER NOT NULL,
  "example" TEXT NOT NULL,
  "localized_example" TEXT
);

CREATE INDEX "vocabulary_examples_word_position_idx" ON "vocabulary_examples" ("word_id", "position");
