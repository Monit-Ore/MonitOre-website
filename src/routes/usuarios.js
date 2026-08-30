var express = require("express");
var router = express.Router();

var usuarioController =
    require("../controllers/usuarioController");

// Realiza o login
router.post("/autenticar", function (req, res) {
    usuarioController.autenticar(req, res);
});

// Cadastra um funcionário
router.post("/cadastrar", function (req, res) {
    usuarioController.cadastrar(req, res);
});

// Lista os cargos disponíveis no cadastro
router.get("/cargos", function (req, res) {
    usuarioController.listarCargos(req, res);
});

// Lista as mineradoras/unidades disponíveis
router.get("/mineradoras", function (req, res) {
    usuarioController.listarMineradoras(req, res);
});

module.exports = router;