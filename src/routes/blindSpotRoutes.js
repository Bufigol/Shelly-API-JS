// src/routes/blindSpotRoutes.js
const express = require('express');
const router = express.Router();
const blindSpotController = require('../controllers/blindSpotController.js');

router.get('/blind-spot-intrusions',
    blindSpotController.handleBlindSpotIntrusions.bind(blindSpotController)
);

module.exports = router;