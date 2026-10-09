function assertMethods(target, label, methodNames) {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError(`${label} 不可用`);
  }
  for (const methodName of methodNames) {
    if (typeof target[methodName] !== "function") {
      throw new TypeError(`${label}.${methodName} 必须是函数`);
    }
  }
  return target;
}

module.exports = { assertMethods };
