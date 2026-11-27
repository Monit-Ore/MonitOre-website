var express = require("express");
var router = express.Router();
var dashboardProcessosController = require("../controllers/dashboardProcessosController");

router.get("/processos", function (req, res) {
  dashboardProcessosController.carregarProcessos(req, res);
});

module.exports = router;
