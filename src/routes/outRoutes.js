// src/routes/outRoutes.js
const express = require('express');
const router = express.Router();
const outController = require('../controllers/outController');
const apiAuthMiddleware = require('../middlewares/apiAuthMiddleware');
const apiValidationMiddleware = require('../middlewares/apiValidationMiddleware');

// Endpoints de Autenticación (sin autenticación, obviamente)
router.post(
  '/login',
  apiValidationMiddleware.validateLogin, // Validar email y password
  outController.login
);

router.post(
  '/usuarios',
  apiValidationMiddleware.validateUsuario, // Validar datos del usuario
  outController.crearUsuario
);

// Middlewares de Autenticación a las otras rutas
router.use(apiAuthMiddleware.authenticate);

// Middlewares de Autorización a las otras rutas

// **II. Módulo de Listado Equipos Realtime**
router.get(
  '/equipos/realtime/:clienteId',
  apiAuthMiddleware.checkPermissions(['ver_equipos_realtime']),
  outController.getEquiposRealtimePorCliente
);

// **III. Módulo de Listado de Equipos con Información Histórica**
router.get(
  '/equipos/historico/:chanelId',
  apiAuthMiddleware.checkPermissions(['ver_equipos_historico']),
  apiValidationMiddleware.validateDateRangeParams,
  outController.getEquiposHistorico
);

router.get(
  '/equipos/historico/:chanelId/resumen',
  apiAuthMiddleware.checkPermissions(['ver_equipos_historico']),
  apiValidationMiddleware.validateDateRangeParams,
  outController.getEquiposHistoricoResumen
);

router.get(
  '/equipos/historico/:chanelId/exportar',
  apiAuthMiddleware.checkPermissions(['exportar_equipos_historico']),
  apiValidationMiddleware.validateDateRangeParams,
  outController.exportarEquiposHistorico
);

// **IV. Módulo de Rescate de Información de Servidor de Datos**
router.get(
  '/equipos/raw/:chanelId',
  apiAuthMiddleware.checkPermissions(['ver_datos_raw']),
  apiValidationMiddleware.validateDateRangeParams,
  outController.getDatosRaw
);

module.exports = router;