var express = require("express");
var router = express.Router();
var dashboardCapacidadeController = require("../controllers/dashboardCapacidadeController");

router.get("/capacidade", function (req, res) {
  dashboardCapacidadeController.buscarPanorama(req, res);
});

module.exports = router;
