// src/routes/ubibotRoutes.js
const express = require("express");
const router = express.Router();
const ubibotController = require("../controllers/ubibotController.js");

router.get(
  "/temperature-range-data",
  ubibotController.getTemperatureRangeData.bind(ubibotController)
);

router.get(
  "/temperature-devices",
  ubibotController.getTemperatureDevices.bind(ubibotController)
);

router.post(
  "/channel-status",
  ubibotController.updateChannelStatus.bind(ubibotController)
);

router.get(
  "/channel-status",
  ubibotController.getChannelStatus.bind(ubibotController)
);

router.post(
  "/update-channel-status",
  ubibotController.handleUpdateChannelStatus.bind(ubibotController)
);

router.post(
  "/generate-defrost-report",
  ubibotController.handleGenerateDefrostReport.bind(ubibotController)
);

router.get(
  "/defrost-analysis-data",
  ubibotController.getDefrostAnalysisData.bind(ubibotController)
);

router.get(
  "/temperature-camaras-data",
  ubibotController.getTemperatureCamarasData.bind(ubibotController)
);

router.get(
    '/weekly-defrost-analysis-data',
    ubibotController.getWeeklyDefrostAnalysisData.bind(ubibotController)
)
router.get(
    '/temperature-dashboard-data',
    ubibotController.getTemperatureDashboardData.bind(ubibotController)
)

router.get(
    '/ubibot-status',
    ubibotController.getUbibotStatus.bind(ubibotController)
);
module.exports = router;