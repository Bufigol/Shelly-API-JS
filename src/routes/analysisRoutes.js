// src/routes/analysisRoutes.js
const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController.js');
const { validationMiddleware } = require('../middlewares');

// Endpoint para análisis de potencia y temperatura
router.get('/temperature-power-analysis',
    validationMiddleware.validateDateParams,
    analysisController.getTemperaturePowerAnalysis.bind(analysisController)
);

// Endpoint para obtener las ubicaciones y canales de temperatura
router.get('/temperature-power-locations',
    analysisController.getTemperaturePowerLocations.bind(analysisController)
);

module.exports = router;