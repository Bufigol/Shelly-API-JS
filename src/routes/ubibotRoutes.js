// src/routes/ubibotRoutes.js
const express = require('express');
const router = express.Router();
const ubibotController = require('../controllers/ubibotController.js');

router.get('/temperature-range-data',
    ubibotController.getTemperatureRangeData.bind(ubibotController)
);

router.get('/temperature-devices',
    ubibotController.getTemperatureDevices.bind(ubibotController)
);

module.exports = router;