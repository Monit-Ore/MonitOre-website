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

router.get("/qtdTorresAtivas/:id", function (req, res) {
  torresController.mostrarQtdAtivas(req, res);
});

router.get("/disponiveis/:id", function (req, res) {
  torresController.listarTorresDisponiveis(req, res);
});

router.get("/:idTorre/dashboard", function (req, res) {
  torresController.buscarDashboardDaTorre(req, res);
});

router.get("/:idTorre/datas-disponiveis", function (req, res) {
  torresController.buscarDatasDisponiveis(req, res);
});

router.get("/:idTorre/status", function (req, res) {
  torresController.buscarStatusDaTorre(req, res);
});

router.get("/:idTorre/dados", function (req, res) {
  torresController.buscarDadosDaTorre(req, res);
});

router.get("/:idTorre/alertas-dia", function (req, res) {
  torresController.buscarAlertasDoDiaDaTorre(req, res);
});

router.get("/:id", function (req, res) {
  torresController.buscarTorrePorId(req, res);
});

router.put("/atualizar-torres/:id", function (req, res) {
  torresController.atualizarTorre(req, res);
});

module.exports = router;
