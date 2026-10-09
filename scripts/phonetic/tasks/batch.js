/** 批量任务入口；返回逐项结果，便于失败重试和生成覆盖率报告。 */
async function runBatchPhoneticTask(service, inputs, options) {
  return service.resolveMany(inputs, options);
}
module.exports = { runBatchPhoneticTask };
