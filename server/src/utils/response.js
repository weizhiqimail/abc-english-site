exports.ok = (response, data, status = 200) =>
  response.status(status).json({ success: true, data, error: null });
exports.fail = (response, status, error) =>
  response.status(status).json({ success: false, data: null, error });
