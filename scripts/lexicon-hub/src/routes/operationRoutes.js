const express = require("express");
const {
  createOperationController,
} = require("../controllers/operationController");

function createOperationRouter(dependencies) {
  const router = express.Router();
  const controller = createOperationController(dependencies);
  router.get("/", controller.showOperations);
  return router;
}

module.exports = { createOperationRouter };
