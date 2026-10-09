const path = require("node:path");

const supportedZones = new Set(["z0", "z1", "z2", "na0", "as0", "cn-east-2"]);

/**
 * 从进程环境读取七牛配置。调用方可以传入覆盖值，方便测试或在其他服务中复用。
 */
function loadQiniuConfig(overrides = {}) {
  const config = {
    accessKey: overrides.accessKey || process.env.QINIU_ACCESS_KEY,
    secretKey: overrides.secretKey || process.env.QINIU_SECRET_KEY,
    bucket: overrides.bucket || process.env.QINIU_BUCKET,
    zone: overrides.zone || process.env.QINIU_ZONE || "z0",
    publicBaseUrl:
      overrides.publicBaseUrl || process.env.QINIU_PUBLIC_BASE_URL || "",
    callbackUrl: overrides.callbackUrl || process.env.QINIU_CALLBACK_URL || "",
    callbackBody:
      overrides.callbackBody ||
      process.env.QINIU_CALLBACK_BODY ||
      "key=$(key)&hash=$(etag)&bucket=$(bucket)&fsize=$(fsize)&mimeType=$(mimeType)",
    catalogRoot:
      overrides.catalogRoot ||
      process.env.QINIU_CATALOG_ROOT ||
      path.resolve(__dirname, "../data"),
  };

  const missingNames = [];
  if (!config.accessKey) {
    missingNames.push("QINIU_ACCESS_KEY");
  }
  if (!config.secretKey) {
    missingNames.push("QINIU_SECRET_KEY");
  }
  if (!config.bucket) {
    missingNames.push("QINIU_BUCKET");
  }
  if (missingNames.length > 0) {
    throw new Error(`缺少七牛环境变量：${missingNames.join("、")}`);
  }
  if (!supportedZones.has(config.zone)) {
    throw new Error(`不支持的 QINIU_ZONE：${config.zone}`);
  }

  return config;
}

module.exports = { loadQiniuConfig, supportedZones };
