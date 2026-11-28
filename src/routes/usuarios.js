var express = require("express");
var router = express.Router();

var usuarioController = require("../controllers/usuarioController");

router.post("/sair", function (req, res) {
    req.session.destroy(function (erro) {
        if (erro) return res.status(500).json({ mensagem: "Não foi possível encerrar a sessão." });
        res.clearCookie("connect.sid", { path: "/" });
        return res.sendStatus(204);
    });
});

router.post("/autenticar", function (req, res) {
    usuarioController.autenticar(req, res);
});


router.post("/cadastrar", function (req, res) {
    usuarioController.cadastrar(req, res);
});

router.get("/listar", function (req, res) {
    usuarioController.listarUsuarios(req, res);
});

router.get("/buscar", function (req, res) {
    usuarioController.buscarUsuario(req, res);
});

router.get("/buscarID/:idUsuario", function (req, res) {
    usuarioController.BuscarPorID(req, res);
});

router.delete("/deletar/:idUsuario", function (req, res) {
    usuarioController.deletarUsuario(req, res);
});

router.get("/cargos", function (req, res) {
    usuarioController.listarCargos(req, res);
});

router.get("/mineradoras", function (req, res) {
    usuarioController.listarMineradoras(req, res);
});

router.post("/atualizar/telefone", function (req, res) {
    usuarioController.atualizarTelefone(req, res);
});

router.post("/atualizar/senha", function (req, res) {
    usuarioController.atualizarSenha(req, res);
});

router.post("/atualizarSenhaAdmin", function (req, res) {
    usuarioController.atualizarSenhaAdmin(req, res);
});

router.post("/atualizarCargo", function (req, res) {
    usuarioController.atualizarCargo(req, res);
});

router.get("/torres", function (req, res) {
    usuarioController.listarTorresPorMineradora(req, res);
});

router.get("/torres/acessos/:idUsuario", function (req, res) {
    usuarioController.buscarAcessosTorres(req, res);
});

router.put("/torres/acessos/:idUsuario", function (req, res) {
    usuarioController.salvarAcessosTorres(req, res);
});

module.exports = router;
