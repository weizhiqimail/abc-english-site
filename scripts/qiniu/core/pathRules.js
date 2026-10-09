const path = require("node:path");

/** 只允许安全的目录片段，防止业务模块互相覆盖或产生路径穿越。 */
function normalizeSegment(value, fieldName) {
  const segment = String(value || "").trim();
  if (!segment || segment === "." || segment === "..") {
    throw new Error(`${fieldName} 不能为空或使用相对路径符号`);
  }
  if (!/^[\p{L}\p{N}._-]+$/u.test(segment)) {
    throw new Error(`${fieldName} 只能包含文字、数字、点、下划线和短横线`);
  }
  return segment;
}

function normalizeRelativePath(value) {
  const parts = String(value || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .map((part) => normalizeSegment(part, "文件路径"));
  if (parts.length === 0) {
    throw new Error("文件路径不能为空");
  }
  return parts.join("/");
}

function buildObjectKey(moduleName, fileName, relativeDirectory = "files") {
  const safeModuleName = normalizeSegment(moduleName, "模块名称");
  const safeDirectory = normalizeRelativePath(relativeDirectory);
  const safeFileName = normalizeRelativePath(fileName);
  return `${safeModuleName}/${safeDirectory}/${safeFileName}`;
}

function getModuleCatalogPath(catalogRoot, moduleName) {
  return path.join(
    catalogRoot,
    normalizeSegment(moduleName, "模块名称"),
    "manifest.json",
  );
}

module.exports = {
  buildObjectKey,
  getModuleCatalogPath,
  normalizeSegment,
};
