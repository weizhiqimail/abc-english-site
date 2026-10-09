const crypto = require("node:crypto");
const { Readable } = require("node:stream");

const extensionByMime = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

function buildImageObjectKey(wordId, digest, extension) {
  return `abc-english/vocabulary/images/v1/${wordId}/${digest}.${extension}`;
}

function assertAllowedUrl(rawUrl, allowedHosts) {
  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    !allowedHosts.includes(url.hostname.toLowerCase())
  ) {
    throw new Error(`不允许下载该图片地址：${url.hostname}`);
  }
  return url;
}

/** 手动检查每一次跳转，避免远程图片迁移成为 SSRF 入口。 */
async function downloadImage(rawUrl, options) {
  let url = assertAllowedUrl(rawUrl, options.allowedHosts);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: { "user-agent": "abc-english-lexicon-hub/1.0" },
    });
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      url = assertAllowedUrl(
        new URL(response.headers.get("location"), url),
        options.allowedHosts,
      );
      continue;
    }
    if (!response.ok)
      throw new Error(`下载原图失败（HTTP ${response.status}）`);
    const mimeType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();
    if (!extensionByMime.has(mimeType))
      throw new Error(`不支持的图片类型：${mimeType || "unknown"}`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > options.maxBytes)
      throw new Error(`图片超过 ${options.maxBytes} 字节限制`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > options.maxBytes)
      throw new Error(`图片超过 ${options.maxBytes} 字节限制`);
    return {
      buffer,
      mimeType,
      extension: extensionByMime.get(mimeType),
      finalUrl: url.toString(),
    };
  }
  throw new Error("图片重定向次数过多");
}

function createImageMigrationService({
  repository,
  getStorage,
  config,
  logger,
}) {
  const log = logger.child({ component: "image-migration" });
  async function migrateOne(wordId, options = {}) {
    const startedAt = Date.now();
    log.info("image.migration.started", { wordId });
    const word = await repository.getWord(wordId);
    if (!word) throw new Error("词汇不存在");
    if (
      !options.force &&
      word.ownedImageStatus === "published" &&
      word.ownedImageUrl
    ) {
      log.info("image.migration.skipped", {
        wordId,
        reason: "already-published",
        ownedImageUrl: word.ownedImageUrl,
      });
      return { wordId: word.id, status: "skipped", url: word.ownedImageUrl };
    }
    const sourceUrl = word.photoUrl || word.photoThumbnailUrl;
    if (!sourceUrl) {
      log.info("image.migration.skipped", {
        wordId,
        reason: "no-source-image",
      });
      return { wordId: word.id, status: "skipped", reason: "no-source-image" };
    }
    await repository.markImageProcessing(word.id);
    try {
      log.info("image.download.started", {
        wordId,
        sourceUrl,
        allowedHosts: config.imageAllowedHosts,
        maxBytes: config.imageMaxBytes,
      });
      const image = await downloadImage(sourceUrl, {
        allowedHosts: config.imageAllowedHosts,
        maxBytes: config.imageMaxBytes,
      });
      log.info("image.download.completed", {
        wordId,
        sourceUrl,
        finalUrl: image.finalUrl,
        mimeType: image.mimeType,
        byteSize: image.buffer.length,
      });
      const digest = crypto
        .createHash("sha256")
        .update(image.buffer)
        .digest("hex");
      // wordId 目录保留业务定位能力，也允许以后为同一个词汇增加多张图片。
      // 内容哈希作为文件名，图片变化时会生成新 URL，避免 CDN 继续命中旧内容。
      const objectKey = buildImageObjectKey(word.id, digest, image.extension);
      log.info("qiniu.image-upload.started", {
        wordId,
        objectKey,
        mimeType: image.mimeType,
        byteSize: image.buffer.length,
        overwrite: true,
      });
      const storage = getStorage();
      const publicBaseUrl = await storage.resolvePublicBaseUrl();
      log.info("qiniu.public-domain.resolved", {
        wordId,
        publicBaseUrl,
        source: process.env.QINIU_PUBLIC_BASE_URL
          ? "QINIU_PUBLIC_BASE_URL"
          : "qiniu-bucket-domain-api",
      });
      const upload = await storage.uploadStream({
        objectKey,
        stream: Readable.from(image.buffer),
        size: image.buffer.length,
        mimeType: image.mimeType,
        overwrite: true,
      });
      log.info("qiniu.image-upload.completed", { wordId, upload });
      const updated = await repository.markImagePublished(word.id, upload);
      log.info("image.migration.completed", {
        wordId,
        durationMs: Date.now() - startedAt,
        status: updated.ownedImageStatus,
        ownedImageUrl: updated.ownedImageUrl,
        ownedImageObjectKey: updated.ownedImageObjectKey,
      });
      return {
        wordId: word.id,
        status: "published",
        url: updated.ownedImageUrl,
      };
    } catch (error) {
      log.error("image.migration.failed", {
        wordId,
        sourceUrl,
        durationMs: Date.now() - startedAt,
        error,
      });
      await repository.markImageFailed(word.id, error.message);
      throw error;
    }
  }

  async function migrateMany(wordIds, options = {}) {
    const limit = Math.min(
      100,
      Math.max(1, Number(options.limit || wordIds.length || 1)),
    );
    const ids = [
      ...new Set(wordIds.map(Number).filter(Number.isInteger)),
    ].slice(0, limit);
    if (!ids.length) throw new Error("请至少选择一个词汇");
    log.info("image.batch.started", {
      requestedWordIds: wordIds,
      normalizedWordIds: ids,
      count: ids.length,
    });
    const results = new Array(ids.length);
    let cursor = 0;
    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    async function worker() {
      while (cursor < ids.length) {
        const index = cursor++;
        try {
          const value = await migrateOne(ids[index], {
            force: options.force,
          });
          results[index] = { ok: true, value };
          if (value.status === "skipped") skipped += 1;
          else succeeded += 1;
        } catch (error) {
          failed += 1;
          results[index] = {
            ok: false,
            wordId: ids[index],
            error: error.message,
          };
        } finally {
          completed += 1;
          options.onProgress?.({
            total: ids.length,
            completed,
            succeeded,
            failed,
            skipped,
            currentWordId: ids[index],
            lastResult: results[index],
          });
        }
      }
    }
    const concurrency = Math.min(
      3,
      Math.max(1, Number(options.concurrency || 3)),
    );
    await Promise.all(
      Array.from({ length: Math.min(concurrency, ids.length) }, worker),
    );
    log.info("image.batch.completed", {
      count: ids.length,
      succeeded: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results,
    });
    return results;
  }

  return { migrateOne, migrateMany };
}

module.exports = {
  buildImageObjectKey,
  createImageMigrationService,
  downloadImage,
};
