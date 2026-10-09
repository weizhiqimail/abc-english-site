const { groupProgressByLevel } = require("../presenters/vocabularyPresenter");
const { listTaskTypes } = require("../tasks/taskRegistry");

function createTaskController({ repository, taskDefinitions }) {
  async function showTasks(request, response, next) {
    try {
      const progress = await repository.getProgress();
      response.render("tasks/index", {
        activeSection: "tasks",
        activeVocabularyPage: "",
        levels: groupProgressByLevel(progress),
        taskTypes: listTaskTypes(taskDefinitions),
      });
    } catch (error) {
      next(error);
    }
  }

  return { showTasks };
}

module.exports = { createTaskController };
