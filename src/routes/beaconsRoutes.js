// src/routes/beaconsRoutes.js
const express = require('express');
const router = express.Router();
const beaconsController = require('../controllers/beaconsController.js');

router.get('/door-status',
    beaconsController.getDoorStatus.bind(beaconsController)
);

router.get('/beacon-entries-exits',
    beaconsController.getBeaconEntriesExits.bind(beaconsController)
);

router.get('/beacons',
    beaconsController.getAllBeacons.bind(beaconsController)
);

router.get('/beacons-detection-status',
    beaconsController.getBeaconDetectionStatus.bind(beaconsController)
);

router.get('/latest-sectors',
    beaconsController.getLatestSectors.bind(beaconsController)
);

router.get('/active-beacons',
    beaconsController.getActiveBeacons.bind(beaconsController)
);

router.get('/oldest-active-beacon-detections',
    beaconsController.getOldestActiveBeaconDetections.bind(beaconsController)
);

router.get('/temperature-data',
    beaconsController.getTemperatureData.bind(beaconsController)
);
module.exports = router;