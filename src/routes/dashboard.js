var express = require("express");
var router = express.Router();
var dashboardController = require("../controllers/dashboardController");

router.get("/mineradoras", function (req, res) {
  dashboardController.dashboardMineradoras(req, res);
});

router.get("/visao-executiva", function (req, res) {
  dashboardController.visaoExecutiva(req, res);
});

module.exports = router;
