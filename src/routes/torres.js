var express = require("express");

var router = express.Router();

var torresController = require("../controllers/torresController");

// LISTAGEM DE TORRES COM MINERADORA

router.get("/listarTorres/:fkEmpresa", function (req, res) {
  torresController.listarTorresComMineradora(req, res);
});
