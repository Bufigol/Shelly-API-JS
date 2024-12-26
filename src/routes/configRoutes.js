// src/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const sem_configController = require('../controllers/sem_configController');
const tel_configController = require('../controllers/tel_configController');
const { authMiddleware } = require('../middlewares');

// Get current system parameters
router.get('/parameters', 
    authMiddleware.authenticate,
    sem_configController.getSystemParameters.bind(sem_ConfigController)
);

// Update system parameters
router.post('/parameters',
    authMiddleware.authenticate,
    sem_configController.updateSystemParameters.bind(sem_ConfigController)
);

router.get('/teltonica',
    authMiddleware.authenticate,
    tel_configController.getSystemParameters
);
module.exports = router;