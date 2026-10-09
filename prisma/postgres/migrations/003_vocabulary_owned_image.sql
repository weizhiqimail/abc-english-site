-- 保留原始图片字段，新增项目自有的七牛图片地址和处理状态。
ALTER TABLE vocabulary_words
ADD COLUMN IF NOT EXISTS owned_image_url TEXT,
ADD COLUMN IF NOT EXISTS owned_image_object_key TEXT,
ADD COLUMN IF NOT EXISTS owned_image_status VARCHAR(32) NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS owned_image_error TEXT;

CREATE INDEX IF NOT EXISTS vocabulary_words_owned_image_status_idx ON vocabulary_words (owned_image_status);
