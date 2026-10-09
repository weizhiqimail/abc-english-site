const {
  createPageData,
  groupProgressByLevel,
  readFilters,
} = require("../presenters/vocabularyPresenter");

function createVocabularyController({ repository, config }) {
  async function showLevels(_request, response, next) {
    try {
      const progress = await repository.getProgress();
      response.render("vocabulary/levels", {
        activeSection: "vocabulary",
        activeVocabularyPage: "levels",
        levels: groupProgressByLevel(progress),
      });
    } catch (error) {
      next(error);
    }
  }

  async function showCategories(request, response, next) {
    try {
      const progress = await repository.getProgress();
      const selectedLevel = request.params.level || request.query.level || "";
      response.render("vocabulary/categories", {
        activeSection: "vocabulary",
        activeVocabularyPage: "categories",
        selectedLevel,
        progress: selectedLevel
          ? progress.filter((item) => item.level === selectedLevel)
          : progress,
      });
    } catch (error) {
      next(error);
    }
  }

  async function showWords(request, response, next) {
    try {
      const filters = readFilters(request.query, config.pageSize, {
        categoryRecordId: request.params.categoryRecordId,
      });
      const result = await repository.listWords(filters);
      response.render("vocabulary/words", {
        activeSection: "vocabulary",
        activeVocabularyPage: "words",
        ...createPageData(result, filters),
      });
    } catch (error) {
      next(error);
    }
  }

  return { showCategories, showLevels, showWords };
}

module.exports = { createVocabularyController };
