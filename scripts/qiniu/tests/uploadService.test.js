const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const {
  createObjectStorageService,
  normalizePublicBaseUrl,
} = require("../services/objectStorageService");
const { createUploadService } = require("../services/uploadService");

function createFakeClient(uploadedKeys, domains = []) {
  class PutExtra {}
  return {
    bucket: "test-bucket",
    bucketManager: {
      async listBucketDomains() {
        return { data: domains };
      },
    },
    mac: {},
    qiniu: {
      form_up: { PutExtra },
      rs: {
        PutPolicy: class {
          uploadToken() {
            return "test-token";
          }
        },
      },
    },
    formUploader: {
      putFile(token, key, filePath, putExtra, callback) {
        uploadedKeys.push(key);
        callback(
          null,
          { key, hash: `hash-${path.basename(filePath)}` },
          { statusCode: 200 },
        );
      },
      putStream(token, key, stream, putExtra, callback) {
        uploadedKeys.push(key);
        stream.resume();
        stream.on("end", () => {
          callback(null, { key, hash: `hash-${key}` }, { statusCode: 200 });
        });
      },
    },
  };
}

test("本地文件和文件流按模块保存，并共同更新模块清单", async (context) => {
  const catalogRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qiniu-test-"));
  context.after(() => fs.rm(catalogRoot, { recursive: true, force: true }));
  const localFile = path.join(catalogRoot, "local.txt");
  await fs.writeFile(localFile, "local file", "utf8");

  const uploadedKeys = [];
  const service = createUploadService({
    client: createFakeClient(uploadedKeys),
    config: {
      catalogRoot,
      publicBaseUrl: "https://cdn.example.com",
    },
  });

  await service.uploadLocalFile({
    moduleName: "A",
    filePath: localFile,
    relativeDirectory: "files/text",
  });
  await service.uploadStream({
    moduleName: "A",
    fileName: "remote.txt",
    stream: Readable.from("remote file"),
    size: 11,
    source: { type: "remote-stream" },
  });

  const manifest = JSON.parse(
    await fs.readFile(path.join(catalogRoot, "A", "manifest.json"), "utf8"),
  );
  assert.deepEqual(
    manifest.files.map((item) => item.key),
    ["A/files/remote.txt", "A/files/text/local.txt"],
  );
  assert.deepEqual(uploadedKeys, [
    "A/files/text/local.txt",
    "A/manifest.json",
    "A/files/remote.txt",
    "A/manifest.json",
  ]);
});

test("底层对象服务允许业务自主管理 object key，并且不会生成模块清单", async (context) => {
  const catalogRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qiniu-raw-"));
  context.after(() => fs.rm(catalogRoot, { recursive: true, force: true }));
  const uploadedKeys = [];
  const service = createObjectStorageService({
    client: createFakeClient(uploadedKeys),
    config: {
      catalogRoot,
      publicBaseUrl: "https://cdn.example.com",
    },
  });

  const result = await service.uploadStream({
    objectKey: "abc-english/tts/pronunciations/v1/en-US/ab/123/test.mp3",
    stream: Readable.from("audio"),
    size: 5,
    mimeType: "audio/mpeg",
  });

  assert.equal(result.size, 5);
  assert.equal(result.mimeType, "audio/mpeg");
  assert.deepEqual(uploadedKeys, [result.key]);
  await assert.rejects(fs.access(path.join(catalogRoot, "manifest.json")));
});

test("未配置公开地址时先查询 Bucket 域名再上传", async () => {
  const uploadedKeys = [];
  const service = createObjectStorageService({
    client: createFakeClient(uploadedKeys, [{ domain: "cdn.example.com" }]),
    config: { publicBaseUrl: "" },
  });

  const result = await service.uploadStream({
    objectKey: "images/test.jpg",
    stream: Readable.from("image"),
    size: 5,
    mimeType: "image/jpeg",
  });

  assert.equal(result.publicUrl, "http://cdn.example.com/images/test.jpg");
  assert.deepEqual(uploadedKeys, ["images/test.jpg"]);
});

test("公开域名同时接受 HTTP 和 HTTPS，裸域名默认补充 HTTP", () => {
  assert.equal(
    normalizePublicBaseUrl("cdn.example.com"),
    "http://cdn.example.com",
  );
  assert.equal(
    normalizePublicBaseUrl("http://cdn.example.com"),
    "http://cdn.example.com",
  );
  assert.equal(
    normalizePublicBaseUrl("https://cdn.example.com"),
    "https://cdn.example.com",
  );
});

test("Bucket 没有域名时在上传前失败", async () => {
  const uploadedKeys = [];
  const service = createObjectStorageService({
    client: createFakeClient(uploadedKeys),
    config: { publicBaseUrl: "" },
  });

  await assert.rejects(
    service.uploadStream({
      objectKey: "images/test.jpg",
      stream: Readable.from("image"),
      size: 5,
      mimeType: "image/jpeg",
    }),
    /没有可用的绑定域名/,
  );
  assert.deepEqual(uploadedKeys, []);
});
