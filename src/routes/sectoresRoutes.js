const express = require("express");
const router = express.Router();
const { validationMiddleware } = require("../middlewares");
const sectoresController = require("../controllers/sectoresController");

router.get('/listar-sectores',
    sectoresController.getAllSectores.bind(sectoresController)
);

router.get('/retrive_MapWithQuadrants_information',
    sectoresController.getMapWithQuadrantsInformation.bind(sectoresController)
);

module.exports = router;