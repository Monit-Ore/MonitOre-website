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
var { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
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

var equipeRouter = require("./src/routes/equipe");


// Permite receber JSON.
app.use(express.json());

// Permite receber dados de formulários.
app.use(
  express.urlencoded({
    extended: false,
  }),
);

var s3Client = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
});
var s3Bucket = process.env.MONITORE_BUCKET || process.env.S3_BUCKET;
var s3GoldPrefix = (process.env.S3_PREFIX_GOLD || "gold").replace(/^\/+|\/+$/g, "");

async function streamToString(stream) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

app.get("/gold/:arquivo", async function (req, res) {
  const arquivo = path.basename(req.params.arquivo || "");
  if (!arquivo || !arquivo.endsWith(".json")) {
    return res.status(400).json({ erro: "Arquivo inválido" });
  }

  if (!s3Bucket) {
    return res.status(500).json({ erro: "Bucket S3 não configurado (MONITORE_BUCKET/S3_BUCKET)" });
  }

  const chave = `${s3GoldPrefix}/${arquivo}`;
  try {
    const resposta = await s3Client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: chave }));
    const corpo = await streamToString(resposta.Body);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(corpo);
  } catch (erro) {
    console.error("Erro ao buscar gold no S3:", chave, erro?.name || erro);
    return res.status(404).json({ erro: "Arquivo gold não encontrado no S3", arquivo, chave });
  }
});

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

app.use("/", indexRouter);
app.use("/equipe", equipeRouter);

app.use("/usuarios", usuariosRouter);

app.use("/torres", torresRouter);

app.use("/empresas", empresaRouter);


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
