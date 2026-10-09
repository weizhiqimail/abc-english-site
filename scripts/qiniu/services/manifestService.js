const fs = require("node:fs/promises");
const path = require("node:path");
const { Readable } = require("node:stream");
const { getModuleCatalogPath } = require("../core/pathRules");

const schemaVersion = 1;

async function readManifest(catalogRoot, moduleName) {
  const manifestPath = getModuleCatalogPath(catalogRoot, moduleName);
  try {
    const content = await fs.readFile(manifestPath, "utf8");
    return { manifest: JSON.parse(content), manifestPath };
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return {
      manifest: {
        schemaVersion,
        module: moduleName,
        updatedAt: null,
        files: [],
      },
      manifestPath,
    };
  }
}

/** 写入本地清单镜像；远端同样会保存到“模块名/manifest.json”。 */
async function saveManifest(catalogRoot, moduleName, fileRecord) {
  const { manifest, manifestPath } = await readManifest(
    catalogRoot,
    moduleName,
  );
  const recordIndex = manifest.files.findIndex(
    (item) => item.key === fileRecord.key,
  );
  if (recordIndex >= 0) {
    manifest.files[recordIndex] = fileRecord;
  } else {
    manifest.files.push(fileRecord);
  }
  manifest.updatedAt = new Date().toISOString();
  manifest.files.sort((left, right) => left.key.localeCompare(right.key));

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(manifestPath, serialized, "utf8");

  return {
    manifest,
    manifestPath,
    stream: Readable.from(Buffer.from(serialized, "utf8")),
    size: Buffer.byteLength(serialized),
  };
}

module.exports = { readManifest, saveManifest };
