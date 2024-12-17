// src/routes/totalesRoutes.js
const express = require('express');
const router = express.Router();
const totalesController = require('../controllers/totalesController.js');
const { authMiddleware, validationMiddleware } = require('../middlewares');

// Endpoint para obtener los totales diarios por dispositivo
router.get('/daily/:date',
    authMiddleware.authenticate,
    validationMiddleware.validateDateParams,
    totalesController.getDailyTotalsByDevice.bind(totalesController)
);


module.exports = router;