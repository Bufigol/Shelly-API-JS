const express = require("express");
const router = express.Router();
const { validationMiddleware } = require("../middlewares");
const smsController = require("../controllers/smsController");

router.get(
  "/sms-data",
  validationMiddleware.validateDateParams.bind(validationMiddleware),
  smsController.fetchSMSdata.bind(smsController)
);

module.exports = router;
