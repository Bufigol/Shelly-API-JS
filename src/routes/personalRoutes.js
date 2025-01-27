const express = require('express');
const router = express.Router();
const { validationMiddleware } = require('../middlewares');
const personalController = require('../controllers/personalController');

router.get('/personal', 
    validationMiddleware.validateDateParams.bind(validationMiddleware),
    personalController.getPersonal.bind(personalController)
);

module.exports = router;