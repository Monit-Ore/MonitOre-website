var express = require("express");
var router = express.Router();
var goldController = require("../controllers/goldController");

router.get("/:arquivo", function (req, res) {
  goldController.buscarArquivo(req, res);
});

module.exports = router;
