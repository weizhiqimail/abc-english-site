const express = require("express");

function createApiRouter({ enrichmentService, imageMigrationService }) {
  const router = express.Router();

  router.post("/words/:wordId/enrich", async (request, response) => {
    try {
      request.log.info("api.enrichment.requested", {
        wordId: request.params.wordId,
      });
      const result = await enrichmentService.enrichWord(request.params.wordId);
      request.log.info("api.enrichment.succeeded", { result });
      response.json({ success: true, result });
    } catch (error) {
      request.log.error("api.enrichment.failed", {
        wordId: request.params.wordId,
        error,
      });
      response.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/images/migrate", async (request, response) => {
    try {
      request.log.info("api.image-migration.requested", {
        wordIds: request.body.wordIds || [],
      });
      const results = await imageMigrationService.migrateMany(
        request.body.wordIds || [],
      );
      request.log.info("api.image-migration.succeeded", { results });
      response.json({ success: true, results });
    } catch (error) {
      request.log.error("api.image-migration.failed", {
        wordIds: request.body.wordIds || [],
        error,
      });
      response.status(400).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { createApiRouter };
