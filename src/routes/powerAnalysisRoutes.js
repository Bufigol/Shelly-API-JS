// src/routes/powerAnalysisRoutes.js


const express = require('express');
const router = express.Router();
const powerAnalysisController = require('../controllers/powerAnalysisController.js');
const { validationMiddleware } = require('../middlewares');

router.get('/temperature-power-analysis/:date',
    validationMiddleware.validateDateParams.bind(validationMiddleware),
    powerAnalysisController.handleTemperaturePowerAnalysis.bind(powerAnalysisController)
);

router.get('/temperature-power-locations',
    powerAnalysisController.handleTemperaturePowerLocations.bind(powerAnalysisController)
);
module.exports = router;