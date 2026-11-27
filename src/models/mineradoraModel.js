const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const BUCKET_NAME = process.env.S3_GOLD_BUCKET || "monitore-bronze-arthur";
const REGION = process.env.S3_REGION || "us-east-1";
const PREFIXO_GOLD = process.env.S3_PREFIX_GOLD || "gold/";

const s3 = new S3Client({ region: REGION });

function normalizarPrefixo(prefixo) {
    var valor = String(prefixo === undefined || prefixo === null ? "" : prefixo).trim();
    if (!valor || valor === "/") {
        return "";
    }
    return valor.replace(/^\/+/, "").replace(/\/+$/, "") + "/";
}

function montarChave(nomeArquivo) {
    var nome = String(nomeArquivo === undefined || nomeArquivo === null ? "" : nomeArquivo)
        .trim()
        .replace(/^\/+/, "");
    return normalizarPrefixo(PREFIXO_GOLD) + nome;
}

async function buscarJson(nomeArquivo) {
    var command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: montarChave(nomeArquivo),
    });

    var resposta = await s3.send(command);
    var conteudo = await resposta.Body.transformToString();
    return JSON.parse(conteudo);
}

function buscarMineradoras() {
    return buscarJson("dashboard.json");
}

module.exports = {
    buscarJson,
    buscarMineradoras,
};
