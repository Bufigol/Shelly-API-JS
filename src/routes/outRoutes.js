// src/routes/outRoutes.js
const express = require("express");
const router = express.Router();
const outController = require("../controllers/outController");
const apiAuthMiddleware = require("../middlewares/apiAuthMiddleware");
const apiValidationMiddleware = require("../middlewares/apiValidationMiddleware");

// ====================================================================
// Endpoints de Autenticación (sin autenticación)
// ====================================================================
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

router.post(
  "/reset-password",
  apiValidationMiddleware.validateEmail,
  outController.solicitarResetPassword
);

router.post(
  "/reset-password/:token",
  apiValidationMiddleware.validateNewPassword,
  outController.confirmarResetPassword
);

// ====================================================================
// Middleware de Autenticación (aplicado a todas las rutas siguientes)
// ====================================================================
router.use(apiAuthMiddleware.authenticate.bind(apiAuthMiddleware));

// ====================================================================
// Módulo de listado de equipos en tiempo real por cliente
// ====================================================================
router.get(
  "/equipos",
  outController.obtenerEquipos
);

router.get(
  "/equipos/:id",
  apiValidationMiddleware.validateEquipoId,
  outController.obtenerEquipoDetalle
);

router.get(
  "/equipos/:id/status",
  apiValidationMiddleware.validateEquipoId,
  outController.obtenerEquipoStatus
);

// ====================================================================
// Módulo de Faenas
// ====================================================================
router.get(
  "/faenas",
  outController.obtenerFaenas
);

router.get(
  "/faenas/:id",
  apiValidationMiddleware.validateFaenaId,
  outController.obtenerFaenaDetalle
);

// Ruta que requiere permiso de editor
router.post(
  "/faenas",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateFaenaCreate,
  outController.crearFaena
);

// Ruta que requiere permiso de editor
router.put(
  "/faenas/:id",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateFaenaUpdate,
  outController.actualizarFaena
);

// ====================================================================
// Módulo de listado de equipos con información histórica
// ====================================================================
router.get(
  "/equipos/:id/historico",
  apiValidationMiddleware.validateHistoricoParams,
  outController.obtenerHistoricoEquipo
);

router.get(
  "/equipos/:id/faenas",
  apiValidationMiddleware.validateEquipoId,
  outController.obtenerFaenasPorEquipo
);

router.get(
  "/faenas/:id/datos",
  apiValidationMiddleware.validateFaenaId,
  outController.obtenerDatosFaena
);

router.get(
  "/faenas/:id/resumen",
  apiValidationMiddleware.validateFaenaId,
  outController.obtenerResumenFaena
);

router.get(
  "/faenas/:id/export",
  apiValidationMiddleware.validateFaenaId,
  outController.exportarDatosFaena
);

// ====================================================================
// Módulo de administración (solo para usuarios con permiso de editor)
// ====================================================================
router.get(
  "/configuracion",
  outController.obtenerConfiguracion
);

// Rutas que requieren permiso de editor
router.put(
  "/configuracion",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateConfiguracion,
  outController.actualizarConfiguracion
);

router.post(
  "/equipos/asociar",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateAsociarEquipo,
  outController.asociarEquipoMaquina
);

module.exports = router;