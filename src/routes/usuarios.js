var express = require("express");

var router = express.Router();

var usuarioController =
    require("../controllers/usuarioController");


// LOGIN

router.post("/autenticar", function (req, res) {
    usuarioController.autenticar(req, res);
});


// CADASTRO

router.post("/cadastrar", function (req, res) {
    usuarioController.cadastrar(req, res);
});


// LISTAGEM DE CARGOS

router.get("/cargos", function (req, res) {
    usuarioController.listarCargos(req, res);
});


// LISTAGEM DE MINERADORAS

router.get("/mineradoras", function (req, res) {
    usuarioController.listarMineradoras(req, res);
});


module.exports = router;