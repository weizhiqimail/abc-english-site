const { badRequest } = require("./errors");

// CONTROL_CHARACTER_PATTERN 识别不应出现在用户文本中的 ASCII 控制字符。
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
// POSITIVE_INTEGER_PATTERN 只允许不带前导符号且从 1 开始的十进制整数文本。
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
// SAFE_RESOURCE_ID_PATTERN 允许资源 ID 中常用的字母、数字与安全分隔符。
const SAFE_RESOURCE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
// USERNAME_PATTERN 允许用户名使用字母、数字、点、下划线、@ 与连字符。
const USERNAME_PATTERN = /^[A-Za-z0-9._@-]+$/;

function requirePlainObject(value, label = "请求体") {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw badRequest(`${label}必须是 JSON 对象`, "INVALID_BODY");
  }
  return value;
}

function optionalString(value, options = {}) {
  // 可选字段缺失时返回 null，调用方可以与非法类型明确区分。
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw badRequest(
      `${options.label || "字段"}必须是字符串`,
      "INVALID_STRING",
    );
  }
  // 只有调用方明确要求保留空白时才跳过 trim。
  const result = options.trim === false ? value : value.trim();
  if (!options.allowEmpty && result.length === 0) {
    throw badRequest(`${options.label || "字段"}不能为空`, "EMPTY_STRING");
  }
  if (CONTROL_CHARACTER_PATTERN.test(result)) {
    throw badRequest(
      `${options.label || "字段"}包含非法控制字符`,
      "INVALID_STRING",
    );
  }
  if (options.minLength && result.length < options.minLength) {
    throw badRequest(
      `${options.label || "字段"}至少 ${options.minLength} 位`,
      "STRING_TOO_SHORT",
    );
  }
  if (options.maxLength && result.length > options.maxLength) {
    throw badRequest(
      `${options.label || "字段"}最多 ${options.maxLength} 位`,
      "STRING_TOO_LONG",
    );
  }
  if (options.pattern && !options.pattern.test(result)) {
    throw badRequest(
      options.patternMessage || `${options.label || "字段"}格式错误`,
    );
  }
  return result;
}

function requiredString(value, options = {}) {
  const result = optionalString(value, options);
  if (result === null) {
    throw badRequest(`${options.label || "字段"}不能为空`, "MISSING_STRING");
  }
  return result;
}

function positiveInteger(value, label = "ID", options = {}) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw badRequest(`${label}必须是正整数`, "INVALID_INTEGER");
  }
  // 字符串参数先去除外围空白，数字参数保持原值以便安全整数校验。
  const raw = typeof value === "string" ? value.trim() : value;
  if (
    raw === "" ||
    (typeof raw === "string" && !POSITIVE_INTEGER_PATTERN.test(raw))
  ) {
    throw badRequest(`${label}必须是正整数`, "INVALID_INTEGER");
  }
  const result = Number(raw);
  const maximum = options.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw badRequest(`${label}必须是有效的正整数`, "INVALID_INTEGER");
  }
  return result;
}

function boundedInteger(value, options = {}) {
  if (value === undefined || value === null || value === "") {
    return options.defaultValue;
  }
  const result = positiveInteger(value, options.label || "参数", {
    max: options.max,
  });
  if (options.min && result < options.min) {
    throw badRequest(`${options.label || "参数"}不能小于 ${options.min}`);
  }
  return result;
}

function assertAllowedKeys(object, allowedKeys, label = "请求体") {
  const unexpected = Object.keys(object).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unexpected.length) {
    throw badRequest(
      `${label}包含不支持的字段：${unexpected.join("、")}`,
      "UNEXPECTED_FIELD",
    );
  }
}

module.exports = {
  SAFE_RESOURCE_ID_PATTERN,
  USERNAME_PATTERN,
  assertAllowedKeys,
  boundedInteger,
  optionalString,
  positiveInteger,
  requirePlainObject,
  requiredString,
};
