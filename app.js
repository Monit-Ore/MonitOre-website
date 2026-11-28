// var ambiente_processo = "producao";
var ambiente_processo = "desenvolvimento";

var caminho_env = ambiente_processo === "producao" ? ".env" : ".env.dev";

// Define qual arquivo .env será utilizado.
require("dotenv").config({
  path: caminho_env,
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
var torresRouter = require("./src/routes/torres");
var empresaRouter = require("./src/routes/empresas");
var dashboardCapacidadeRouter = require("./src/routes/dashboardCapacidade");

var equipeRouter = require("./src/routes/equipe");
var goldRouter = require("./src/routes/gold");
var dashboardProcessosRouter = require("./src/routes/dashboardProcessos");
var suporteRouter = require("./src/routes/suporte");
var dashboardRouter = require("./src/routes/dashboard");


// Permite receber JSON.
app.use(express.json());

// Permite receber dados de formulários.
app.use(
  express.urlencoded({
    extended: false,
  }),
);

// Rotas do Gold (S3 ou cópia local) precisam vir antes do static.
app.use("/gold", goldRouter);

app.use(express.static(path.join(__dirname, "public")));

// Permite requisições do frontend.
app.use(cors());

var session = require("express-session");

app.use(
    session({
        secret: process.env.SESSION_SECRET || "monitore-chave-desenvolvimento",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

app.use(require("./src/middleware/autorizacao").protegerAcesso);
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/equipe", equipeRouter);

app.use("/usuarios", usuariosRouter);

app.use("/torres", torresRouter);

app.use("/empresas", empresaRouter);
app.use("/dashboard", dashboardCapacidadeRouter);
app.use("/dashboard-processos", dashboardProcessosRouter);

app.use("/suporte", suporteRouter);
app.use("/dashboard", dashboardRouter);


if (require.main === module) app.listen(PORTA_APP, function () {
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

module.exports = app;
