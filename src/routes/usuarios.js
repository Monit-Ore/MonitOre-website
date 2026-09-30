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

// DELETAR
router.delete("/deletar/:idUsuario", function(req, res) {
    usuarioController.deletarUsuario(req, res);
});
//Buscar Usuario Especifico

router.get("/buscar", function(req, res){
    usuarioController.buscarUsuario(req, res)
})

// LISTAGEM DE USUARIOS
router.get("/listar", function (req, res) {
    usuarioController.listarUsuarios(req, res);
});

router.get("/buscarID/:idUsuario", function(req, res){
    usuarioController.BuscarPorID(req,res);
})

// LISTAGEM DE CARGOS

router.get("/cargos", function (req, res) {
    usuarioController.listarCargos(req, res);
});


// LISTAGEM DE MINERADORAS

router.get("/mineradoras", function (req, res) {
    usuarioController.listarMineradoras(req, res);
});

// GERENCIAMENTO DO PERFIL

router.post("/atualizar/telefone", function (req, res) {
    usuarioController.atualizarTelefone(req, res);
});

router.post("/atualizar/senha", function (req, res) {
    usuarioController.atualizarSenha(req, res);
});

router.post("/atualizarSenhaAdmin", function(req,res){
    usuarioController.atualizarSenhaAdmin(req,res);
})

router.post("/atualizarCargo", function(req,res){
    usuarioController.atualizarCargo(req,res)
})


module.exports = router;