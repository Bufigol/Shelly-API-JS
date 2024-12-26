const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const energyController = require('../controllers/energyController');
const { validationMiddleware } = require('../middlewares');

// Ruta existente
router.get('/latest-measurements', 
    deviceController.getLatestDevicesMeasurements.bind(deviceController)
);

// Nuevas rutas para consumo eléctrico
router.get('/consumption/:date', 
    validationMiddleware.validateDateParams.bind(validationMiddleware),
    energyController.getDailyConsumption.bind(energyController)
);

router.get('/download/:shellyId/:date',
    validationMiddleware.validateDateParams.bind(validationMiddleware),
    energyController.downloadDeviceData.bind(energyController)
);

module.exports = router;