// src/routes/outRoutes.js
const express = require("express");
const router = express.Router();
const outController = require("../controllers/outController");
const apiAuthMiddleware = require("../middlewares/apiAuthMiddleware");
const apiValidationMiddleware = require("../middlewares/apiValidationMiddleware");

// Endpoints de Autenticación (sin autenticación)
router.post(
  "/login",
  apiValidationMiddleware.validateLogin,
  outController.login
);

router.post(
  "/usuarios",
  apiValidationMiddleware.validateUsuario,
  outController.crearUsuario
);

// Middleware de Autenticación (aplicado a todas las rutas siguientes)
router.use(apiAuthMiddleware.authenticate);

module.exports = router;
