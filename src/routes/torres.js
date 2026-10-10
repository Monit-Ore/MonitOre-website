var express = require("express");
var router = express.Router();
var torresController = require("../controllers/torresController");

router.get("/listarTorres", function (req, res) {
  torresController.selecaoTorre(req, res);
});

router.get("/opcoes", function (req, res) {
  torresController.listarOpcoesCadastro(req, res);
});

router.post("/cadastrar-torres", function (req, res) {
  torresController.cadastrarTorre(req, res);
});

router.get("/:id", function (req, res) {
  torresController.buscarTorrePorId(req, res);
});

router.put("/atualizar-torres/:id", function (req, res) {
  torresController.atualizarTorre(req, res);
});

module.exports = router;