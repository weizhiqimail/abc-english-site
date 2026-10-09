const {
  createPageData,
  readFilters,
} = require("../presenters/vocabularyPresenter");

function createOperationController({ repository, config, logger }) {
  async function showOperations(request, response, next) {
    try {
      const categories = await repository.listCategories();
      const requestedLevel = request.query.level || "A1";
      const levelCategories = categories.filter(
        (category) => category.level === requestedLevel,
      );
      const fallbackCategories = levelCategories.length
        ? levelCategories
        : categories.filter((category) => category.level === "A1");
      const selectedCategory =
        fallbackCategories.find(
          (category) => category.recordId === request.query.category,
        ) || fallbackCategories[0];
      if (!selectedCategory) {
        throw new Error("没有可用于批量操作的词汇分类");
      }
      const filters = {
        ...readFilters(request.query, config.pageSize),
        level: selectedCategory.level,
        categoryRecordId: selectedCategory.recordId,
        page: 1,
        paginate: false,
      };
      const result = await repository.listWords(filters);
      logger.info("operations.page.loaded", {
        filters,
        wordCount: result.items.length,
      });
      response.render("operations/index", {
        activeSection: "operations",
        activeVocabularyPage: "",
        ...createPageData(result, filters),
        categories: fallbackCategories,
      });
    } catch (error) {
      next(error);
    }
  }

  return { showOperations };
}

module.exports = { createOperationController };
