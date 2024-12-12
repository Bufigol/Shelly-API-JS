const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/latest-measurements', deviceController.getLatestDevicesMeasurements.bind(deviceController));

module.exports = router;