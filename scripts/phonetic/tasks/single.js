/** 单词任务入口，供 lexicon-hub 或其他 Node.js 代码直接调用。 */
async function runSinglePhoneticTask(service, input) {
  return service.resolveOne(input);
}
module.exports = { runSinglePhoneticTask };
