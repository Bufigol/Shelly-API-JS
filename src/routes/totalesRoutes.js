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

// Endpoint para obtener los totales diarios por dispositivo para un mes
router.get('/monthly/:month',
    validationMiddleware.validateMonthParams.bind(validationMiddleware),
    totalesController.getMonthlyTotalsByDevice.bind(totalesController)
);

// Endpoint para obtener los totales mensuales por dispositivo para un año
router.get('/yearly/:year',
    validationMiddleware.validateYearParams.bind(validationMiddleware),
    totalesController.getYearlyTotalsByDevice.bind(totalesController)
);

module.exports = router;