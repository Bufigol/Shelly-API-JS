// src/routes/configRoutes.js
const express = require("express");
const router = express.Router();
const sem_configController = require("../controllers/sem_configController");
const tel_configController = require("../controllers/tel_configController");
const { authMiddleware } = require("../middlewares");

// Get current system parameters
router.get(
  "/sem/parametros",
  authMiddleware.authenticate.bind(authMiddleware),
  sem_configController.getSystemParameters.bind(sem_configController)
);

// Update system parameters
router.post(
  "/sem/parametros",
  authMiddleware.authenticate.bind(authMiddleware),
  sem_configController.updateSystemParameters.bind(sem_configController)
);

router.get(
  "/teltonica/parametros",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.getSystemParameters.bind(tel_configController)
);

router.post(
  "/teltonica/parametros",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.updateSystemParameters.bind(tel_configController)
);

router.get(
  "/teltonica/configuracion_beacon/:beacon_id",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.configurarBeacon.bind(tel_configController)
);

router.get(
  "/teltonica/temperatura-umbrales",
  (req, res, next) => {
    console.log("Ruta temperatura-umbrales accedida"); // Log para debug
    next();
  },
  tel_configController.getConfigTemperaturaUmbral.bind(tel_configController)
);

router.post(
  "/teltonica/temperatura-umbrales",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.setConfigTemperaturaUmbral.bind(tel_configController)
);

router.get(
  "/teltonica/umbrales",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.getConfigUmbrales.bind(tel_configController)
);

router.post(
  "/teltonica/umbrales",
  authMiddleware.authenticate.bind(authMiddleware),
  tel_configController.setConfigUmbrales.bind(tel_configController)
);

module.exports = router;