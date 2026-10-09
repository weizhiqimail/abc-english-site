const path = require("node:path");
const { Readable } = require("node:stream");
const { buildObjectKey, normalizeSegment } = require("../core/pathRules");
const { saveManifest } = require("./manifestService");
const { createObjectStorageService } = require("./objectStorageService");

/**
 * 创建可复用的上传服务。业务代码只需要选择模块名，服务会维护模块目录和清单。
 */
function createUploadService({ client, config }) {
  const objectStorage = createObjectStorageService({ client, config });
  // 同一模块的清单更新串行执行，避免并发上传时后写入者覆盖先写入者的数据。
  const manifestQueues = new Map();

  async function uploadManifest(moduleName, manifestResult) {
    const manifestKey = `${normalizeSegment(moduleName, "模块名称")}/manifest.json`;
    await objectStorage.uploadStream({
      objectKey: manifestKey,
      stream: manifestResult.stream,
      size: manifestResult.size,
      mimeType: "application/json; charset=utf-8",
      overwrite: true,
    });
  }

  async function completeUpload(options, uploadResult, size) {
    const uploadedAt = new Date().toISOString();
    const record = {
      key: options.objectKey,
      fileName: options.fileName,
      size,
      mimeType: uploadResult.mimeType,
      hash: uploadResult.hash || null,
      uploadedAt,
      publicUrl: uploadResult.publicUrl,
      source: options.source,
      metadata: options.metadata || {},
    };
    const previousTask =
      manifestQueues.get(options.moduleName) || Promise.resolve();
    const currentTask = previousTask
      .catch(() => {})
      .then(async () => {
        const manifestResult = await saveManifest(
          config.catalogRoot,
          options.moduleName,
          record,
        );
        await uploadManifest(options.moduleName, manifestResult);
        return { ...record, manifestPath: manifestResult.manifestPath };
      });
    manifestQueues.set(options.moduleName, currentTask);

    try {
      return await currentTask;
    } finally {
      if (manifestQueues.get(options.moduleName) === currentTask) {
        manifestQueues.delete(options.moduleName);
      }
    }
  }

  async function uploadLocalFile(options) {
    const absolutePath = path.resolve(options.filePath);
    const fileName = options.fileName || path.basename(absolutePath);
    const objectKey = buildObjectKey(
      options.moduleName,
      fileName,
      options.relativeDirectory,
    );
    const result = await objectStorage.uploadLocalFile({
      objectKey,
      filePath: absolutePath,
      mimeType: options.mimeType,
      overwrite: options.overwrite,
    });
    return completeUpload(
      {
        ...options,
        fileName,
        objectKey,
        // 远端清单不暴露开发机的绝对路径，只保留原始文件名。
        source: { type: "local-file", fileName: path.basename(absolutePath) },
      },
      result,
      result.size,
    );
  }

  async function uploadStream(options) {
    if (!(options.stream instanceof Readable)) {
      throw new TypeError("stream 必须是 Node.js Readable 文件流");
    }
    if (!options.fileName) {
      throw new Error("流上传必须提供 fileName");
    }
    const objectKey = buildObjectKey(
      options.moduleName,
      options.fileName,
      options.relativeDirectory,
    );
    const result = await objectStorage.uploadStream({
      objectKey,
      stream: options.stream,
      size: options.size,
      mimeType: options.mimeType,
      overwrite: options.overwrite,
    });
    return completeUpload(
      {
        ...options,
        objectKey,
        source: options.source || { type: "stream" },
      },
      result,
      Number.isFinite(options.size) ? options.size : null,
    );
  }

  return { uploadLocalFile, uploadStream };
}

module.exports = { createUploadService };
