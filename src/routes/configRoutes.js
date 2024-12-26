// src/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const sem_configController = require('../controllers/sem_configController');
const tel_configController = require('../controllers/tel_configController');
const { authMiddleware } = require('../middlewares');

// Get current system parameters
router.get('/sem/parametros', 
    authMiddleware.authenticate,
    sem_configController.getSystemParameters.bind(sem_ConfigController)
);

// Update system parameters
router.post('/sem/parametros',
    authMiddleware.authenticate,
    sem_configController.updateSystemParameters.bind(sem_ConfigController)
);

router.get('/teltonica/parametros',
    authMiddleware.authenticate,
    tel_configController.getSystemParameters
);

router.post('/teltonica/parametros',
    authMiddleware.authenticate,
    tel_configController.updateSystemParameters
);

router.get('/teltonica/configuracion_beacon/:beacon_id',
    authMiddleware.authenticate,
    tel_configController.configurarBeacon
);

router.get('/teltonica/temperatura-umbrales',
    authMiddleware.authenticate,
    tel_configController.getConfigTemperaturaUmbral
);

router.post('/teltonica/temperatura-umbrales',
    authMiddleware.authenticate,
    tel_configController.setConfigTemperaturaUmbral
);

router.get('/teltonica/umbrales',
    authMiddleware.authenticate,
    tel_configController.getConfigUmbrales
);

router.post('/teltonica/umbrales',
    authMiddleware.authenticate,
    tel_configController.setConfigUmbrales
);

module.exports = router;