const express = require("express");
const {
  createVocabularyController,
} = require("../controllers/vocabularyController");

function createVocabularyRouter(dependencies) {
  const router = express.Router();
  const controller = createVocabularyController(dependencies);

  router.get("/", (_request, response) =>
    response.redirect("/vocabulary/levels"),
  );
  router.get("/levels", controller.showLevels);
  router.get("/levels/:level", controller.showCategories);
  router.get("/categories", controller.showCategories);
  router.get("/categories/:categoryRecordId", controller.showWords);
  router.get("/words", controller.showWords);

  return router;
}

module.exports = { createVocabularyRouter };
