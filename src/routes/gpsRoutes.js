const express = require('express');
const router = express.Router();
const { validationMiddleware } = require('../middlewares');
const gpsController = require('../controllers/gpsController');


router.get('/historical-gps-data',
    gpsController.getHistoricalGpsData.bind(gpsController)
);

router.get('/last-known-position',
    gpsController.getLastKnownPosition.bind(gpsController)
);

router.get('/get-latest-gps-data',
    gpsController.getLatestGpsData.bind(gpsController)
);

router.get('/get-gps-data',
    gpsController.getGpsData.bind(gpsController)
);

router.get('/previous-valid-position',
    gpsController.getPreviousValidPosition.bind(gpsController)
);
module.exports = router;