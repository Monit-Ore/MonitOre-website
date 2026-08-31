// var ambiente_processo = "producao";
var ambiente_processo = "desenvolvimento";

var caminho_env =
    ambiente_processo === "producao"
        ? ".env"
        : ".env.dev";

// Define qual arquivo .env será utilizado.
require("dotenv").config({
    path: caminho_env
});

var express = require("express");
var cors = require("cors");
var path = require("path");

var PORTA_APP = process.env.APP_PORT;
var HOST_APP = process.env.APP_HOST;

var app = express();

// =========================================================
// IMPORTAÇÃO DAS ROTAS
// =========================================================

var indexRouter = require("./src/routes/index");
var usuariosRouter = require("./src/routes/usuarios");

// =========================================================
// MIDDLEWARES
// =========================================================

// Permite receber JSON.
app.use(express.json());

// Permite receber dados de formulários.
app.use(express.urlencoded({
    extended: false
}));

// Disponibiliza HTML, CSS, JavaScript, imagens e fontes
// armazenados dentro da pasta public.
app.use(express.static(
    path.join(__dirname, "public")
));

// Permite requisições do frontend.
app.use(cors());

// =========================================================
// REGISTRO DAS ROTAS
// =========================================================

app.use("/", indexRouter);

app.use("/usuarios", usuariosRouter);

// Rotas resultantes:
//
// POST /usuarios/autenticar
// POST /usuarios/cadastrar
// GET  /usuarios/cargos
// GET  /usuarios/mineradoras

// =========================================================
// INICIALIZAÇÃO DO SERVIDOR
// =========================================================

app.listen(PORTA_APP, function () {
    console.log(`
    ##   ##  ######   #####             ####       ##     ######     ##              ##  ##    ####    ######
    ##   ##  ##       ##  ##            ## ##     ####      ##      ####             ##  ##     ##        ##
    ##   ##  ##       ##  ##            ##  ##   ##  ##     ##     ##  ##            ##  ##     ##       ##
    ## # ##  ####     #####    ######   ##  ##   ######     ##     ######   ######   ##  ##     ##      ##
    #######  ##       ##  ##            ##  ##   ##  ##     ##     ##  ##            ##  ##     ##     ##
    ### ###  ##       ##  ##            ## ##    ##  ##     ##     ##  ##             ####      ##    ##
    ##   ##  ######   #####             ####     ##  ##     ##     ##  ##              ##      ####   ######

    Servidor do seu site já está rodando!

    Acesse:
    http://${HOST_APP}:${PORTA_APP}

    Ambiente selecionado:
    ${ambiente_processo}

    Se desenvolvimento, você está conectado ao banco local.
    Se produção, você está conectado ao banco remoto.

    Para alterar o ambiente, modifique as primeiras linhas do app.js.
    `);
});