var express = require("express");

var router = express.Router();

var torresController = require("../controllers/torresController");

// LISTAGEM DE TORRES COM MINERADORA

router.get("/listarTorres", function (req, res) {
  torresController.selecaoTorre(req, res);
});

router.get("/opcoes", function (req, res) {
  torresController.listarOpcoesCadastro(req, res);
});

router.post("/cadastrar-torres", function (req, res) {
  torresController.cadastrarTorre(req, res);
});

module.exports = router;
