const { loadQiniuConfig } = require("../../core/config");
const { createQiniuClient } = require("../../core/qiniuClient");
const {
  createObjectStorageService,
} = require("../../services/objectStorageService");
const { createUploadService } = require("../../services/uploadService");

/** 创建上传任务入口，未来的下载、删除等任务可以放在 tasks 下的其他目录。 */
function createUploadTask(options = {}) {
  const config = loadQiniuConfig(options.config);
  const client = options.client || createQiniuClient(config);
  return createUploadService({ client, config });
}

/**
 * 创建不带 manifest 规则的底层对象任务，供 TTS、图片迁移等模块自主管理索引。
 */
function createObjectStorageTask(options = {}) {
  const config = loadQiniuConfig(options.config);
  const client = options.client || createQiniuClient(config);
  return createObjectStorageService({ client, config });
}

module.exports = { createObjectStorageTask, createUploadTask };
