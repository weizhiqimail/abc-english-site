module.exports = function asyncRoute(handler) {
  return function wrappedRoute(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
};
