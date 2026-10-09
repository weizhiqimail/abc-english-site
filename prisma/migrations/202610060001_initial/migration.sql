CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(80) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `nickname` VARCHAR(100) NOT NULL,
  `role` ENUM ('admin', 'user') NOT NULL DEFAULT 'user',
  `created_at` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME (3) NOT NULL,
  UNIQUE INDEX `users_username_key` (`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER
SET
  utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `auth_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `token_hash` CHAR(64) NOT NULL,
  `user_id` INTEGER NOT NULL,
  `expires_at` DATETIME (3) NOT NULL,
  `created_at` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `auth_tokens_token_hash_key` (`token_hash`),
  INDEX `auth_tokens_user_id_idx` (`user_id`),
  INDEX `auth_tokens_expires_at_idx` (`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER
SET
  utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `collections` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `user_id` INTEGER NOT NULL,
  `created_at` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME (3) NOT NULL,
  INDEX `collections_user_id_idx` (`user_id`),
  UNIQUE INDEX `collections_user_id_name_key` (`user_id`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER
SET
  utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `favorites` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `collection_id` INTEGER NOT NULL,
  `word_key` VARCHAR(100) NOT NULL,
  `record_id` VARCHAR(64) NOT NULL,
  `word_entry_id` VARCHAR(64) NULL,
  `translation_id` VARCHAR(64) NULL,
  `created_at` DATETIME (3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `favorites_collection_id_word_key_key` (`collection_id`, `word_key`),
  INDEX `favorites_word_key_idx` (`word_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER
SET
  utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `collections` ADD CONSTRAINT `collections_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `favorites` ADD CONSTRAINT `favorites_collection_id_fkey` FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
