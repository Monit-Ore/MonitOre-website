var express = require("express");

var router = express.Router();

var torresController = require("../controllers/torresController");

// LISTAGEM DE TORRES COM MINERADORA

router.get("/listarTorres", function (req, res) {
  torresController.selecaoTorre(req, res);
});

module.exports = router;
