module.exports = function asyncRoute(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("asyncRoute 需要函数处理器");
  }
  return function wrappedRoute(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};
