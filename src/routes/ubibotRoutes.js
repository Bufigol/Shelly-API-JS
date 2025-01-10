// src/routes/ubibotRoutes.js
const express = require("express");
const router = express.Router();
const ubibotController = require("../controllers/ubibotController.js");

router.get("/temperature-range-data", (req, res) =>
  ubibotController.getTemperatureRangeData(req, res)
);

router.get("/temperature-devices", (req, res) =>
  ubibotController.getTemperatureDevices(req, res)
);

router.post("/channel-status", (req, res) =>
  ubibotController.updateChannelStatus(req, res)
);

router.get("/channel-status", (req, res) =>
  ubibotController.getChannelStatus(req, res)
);

router.post("/update-channel-status", (req, res) =>
  ubibotController.handleUpdateChannelStatus(req, res)
);

router.post("/generate-defrost-report", (req, res) =>
  ubibotController.handleGenerateDefrostReport(req, res)
);

router.get("/defrost-analysis-data", (req, res) =>
  ubibotController.getDefrostAnalysisData(req, res)
);

router.get("/temperature-camaras-data", (req, res) =>
  ubibotController.getTemperatureCamarasData(req, res)
);

router.get("/weekly-defrost-analysis-data", (req, res) =>
  ubibotController.getWeeklyDefrostAnalysisData(req, res)
);
router.get("/temperature-dashboard-data", (req, res) =>
  ubibotController.getTemperatureDashboardData(req, res)
);

router.get("/ubibot-status", (req, res) =>
  ubibotController.getUbibotStatus(req, res)
);

module.exports = router;
