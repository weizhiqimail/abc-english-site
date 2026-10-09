const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createUploadToken } = require("../core/qiniuClient");

/** 调用七牛 SDK 上传对象，并把回调接口统一转换成 Promise。 */
function uploadWithSdk(client, uploadToken, objectKey, source, putExtra) {
  return new Promise((resolve, reject) => {
    const callback = (error, body, info) => {
      if (error) {
        reject(error);
        return;
      }
      if (!info || info.statusCode < 200 || info.statusCode >= 300) {
        reject(
          new Error(
            `七牛上传失败（HTTP ${info?.statusCode || "unknown"}）：${JSON.stringify(body)}`,
          ),
        );
        return;
      }
      resolve(body);
    };

    if (source.type === "file") {
      client.formUploader.putFile(
        uploadToken,
        objectKey,
        source.path,
        putExtra,
        callback,
      );
      return;
    }
    client.formUploader.putStream(
      uploadToken,
      objectKey,
      source.stream,
      putExtra,
      callback,
    );
  });
}

function createPublicUrl(baseUrl, objectKey) {
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl.replace(/\/$/, "")}/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function normalizePublicBaseUrl(domain, defaultProtocol = "http:") {
  if (!domain) return "";
  return /^https?:\/\//i.test(domain)
    ? domain
    : `${defaultProtocol}//${domain}`;
}

/**
 * 七牛底层对象服务只处理明确的 object key，不维护业务目录或索引。
 * TTS、图片迁移等任务可以在这一层之上实现自己的分片索引。
 */
function createObjectStorageService({ client, config }) {
  let resolvedPublicBaseUrl = normalizePublicBaseUrl(config.publicBaseUrl);

  async function resolvePublicBaseUrl() {
    if (resolvedPublicBaseUrl) return resolvedPublicBaseUrl;
    const response = await client.bucketManager.listBucketDomains(
      client.bucket,
    );
    const records = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
        ? response.data
        : [];
    const domain = records
      .map((item) => (typeof item === "string" ? item : item?.domain))
      .find(Boolean);
    if (!domain) {
      throw new Error(
        `七牛空间 ${client.bucket} 没有可用的绑定域名；请绑定公开 HTTP/HTTPS 域名并配置 QINIU_PUBLIC_BASE_URL`,
      );
    }
    resolvedPublicBaseUrl = normalizePublicBaseUrl(domain);
    return resolvedPublicBaseUrl;
  }

  async function uploadLocalFile(options) {
    const absolutePath = path.resolve(options.filePath);
    const stat = await fsPromises.stat(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`不是可上传的本地文件：${absolutePath}`);
    }
    // 先确认访问域名，避免对象已上传后才因无法生成公开 URL 而留下孤儿对象。
    const publicBaseUrl = await resolvePublicBaseUrl();
    const token = createUploadToken(
      client,
      options.objectKey,
      options.overwrite,
    );
    const putExtra = new client.qiniu.form_up.PutExtra();
    putExtra.mimeType = options.mimeType || "application/octet-stream";
    const result = await uploadWithSdk(
      client,
      token,
      options.objectKey,
      { type: "file", path: absolutePath },
      putExtra,
    );
    return {
      key: options.objectKey,
      hash: result.hash || null,
      size: stat.size,
      mimeType: putExtra.mimeType,
      publicUrl: createPublicUrl(publicBaseUrl, options.objectKey),
    };
  }

  async function uploadStream(options) {
    if (!(options.stream instanceof Readable)) {
      throw new TypeError("stream 必须是 Node.js Readable 文件流");
    }
    // 先确认访问域名，避免对象已上传后才因无法生成公开 URL 而留下孤儿对象。
    const publicBaseUrl = await resolvePublicBaseUrl();
    const token = createUploadToken(
      client,
      options.objectKey,
      options.overwrite,
    );
    const putExtra = new client.qiniu.form_up.PutExtra();
    putExtra.mimeType = options.mimeType || "application/octet-stream";
    const result = await uploadWithSdk(
      client,
      token,
      options.objectKey,
      { type: "stream", stream: options.stream },
      putExtra,
    );
    return {
      key: options.objectKey,
      hash: result.hash || null,
      size: Number.isFinite(options.size) ? options.size : null,
      mimeType: putExtra.mimeType,
      publicUrl: createPublicUrl(publicBaseUrl, options.objectKey),
    };
  }

  return { resolvePublicBaseUrl, uploadLocalFile, uploadStream };
}

module.exports = {
  createObjectStorageService,
  createPublicUrl,
  normalizePublicBaseUrl,
};
