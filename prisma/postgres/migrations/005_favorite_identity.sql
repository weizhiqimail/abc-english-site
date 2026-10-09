-- 收藏的是“某分类下的词卡”，同一 word_key 在不同分类可能对应不同词义。
-- 部署包含新 Prisma Client 的应用前，应先通过 DATABASE_URL_UNPOOLED 执行本迁移。
BEGIN;

ALTER TABLE "favorites"
DROP CONSTRAINT "favorites_collection_id_word_key_key";

ALTER TABLE "favorites"
ADD CONSTRAINT "favorites_collection_id_record_id_word_key_key"
UNIQUE ("collection_id", "record_id", "word_key");

COMMIT;
