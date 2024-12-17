// src/routes/totalesRoutes.js
const express = require('express');
const router = express.Router();
const totalesController = require('../controllers/totalesController');
const { validationMiddleware } = require('../middlewares');

// Endpoint para obtener los totales diarios por dispositivo
router.get('/daily/:date',
    validationMiddleware.validateDateParams.bind(validationMiddleware),
    totalesController.getDailyTotalsByDevice.bind(totalesController)
);

module.exports = router;