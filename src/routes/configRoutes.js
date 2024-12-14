// src/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { authMiddleware } = require('../middlewares');

// Get current system parameters
router.get('/parameters', 
    authMiddleware.authenticate,
    configController.getSystemParameters.bind(configController)
);

// Update system parameters
router.post('/parameters',
    authMiddleware.authenticate,
    configController.updateSystemParameters.bind(configController)
);

module.exports = router;