const qiniu = require("qiniu");

const zoneMap = {
  z0: qiniu.zone.Zone_z0,
  z1: qiniu.zone.Zone_z1,
  z2: qiniu.zone.Zone_z2,
  na0: qiniu.zone.Zone_na0,
  as0: qiniu.zone.Zone_as0,
  "cn-east-2": qiniu.zone.Zone_cn_east_2,
};

/** 创建七牛 SDK 客户端，所有上传任务共用这一层。 */
function createQiniuClient(config) {
  const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);
  const sdkConfig = new qiniu.conf.Config();
  sdkConfig.zone = zoneMap[config.zone];

  return {
    bucket: config.bucket,
    bucketManager: new qiniu.rs.BucketManager(mac, sdkConfig),
    formUploader: new qiniu.form_up.FormUploader(sdkConfig),
    mac,
    qiniu,
    callbackUrl: config.callbackUrl,
    callbackBody: config.callbackBody,
  };
}

/** 为普通新增或覆盖上传生成对应权限的上传凭证。 */
function createUploadToken(client, objectKey, overwrite = false) {
  const scope = overwrite ? `${client.bucket}:${objectKey}` : client.bucket;
  const options = { scope };
  if (client.callbackUrl) {
    options.callbackUrl = client.callbackUrl;
    options.callbackBody = client.callbackBody;
    options.callbackBodyType = "application/x-www-form-urlencoded";
  }
  const putPolicy = new client.qiniu.rs.PutPolicy(options);
  return putPolicy.uploadToken(client.mac);
}

module.exports = { createQiniuClient, createUploadToken };
