var path = require("path");
var fs = require("fs/promises");
var { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

var clienteS3 = new S3Client({
  region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
});

function configuracaoGold() {
  return {
    bucket: process.env.MONITORE_BUCKET || process.env.S3_BUCKET || "",
    prefixo: (process.env.S3_PREFIX_GOLD || "gold").replace(/^\/+|\/+$/g, ""),
  };
}

function validarArquivo(arquivo) {
  if (!arquivo) return null;

  var nome = path.basename(arquivo);
  if (nome !== arquivo || !nome.endsWith(".json") || nome.startsWith(".")) {
    return null;
  }
  return nome;
}

async function converterTexto(stream) {
  return await new Promise(function (resolve, reject) {
    const chunks = [];
    stream.on("data", function (chunk) { chunks.push(chunk); });
    stream.on("error", reject);
    stream.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
  });
}

async function lerDoLocal(arquivo) {
  var caminho = path.join(__dirname, "..", "..", "public", "gold", arquivo);

  try {
    return await fs.readFile(caminho, "utf8");
  } catch (erro) {
    if (erro.code === "ENOENT") {
      var falha = new Error("Arquivo gold não encontrado: " + arquivo);
      falha.status = 404;
      throw falha;
    }
    throw erro;
  }
}

async function lerDoS3(arquivo, bucket, prefixo) {
  var chave = prefixo ? `${prefixo}/${arquivo}` : arquivo;

  try {
    var resposta = await clienteS3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: chave,
    }));
    return await converterTexto(resposta.Body);
  } catch (erro) {
    console.error("Erro ao buscar gold no S3:", chave, erro?.name || erro);
    var falha = new Error("Arquivo gold não encontrado no S3: " + arquivo);
    falha.status = 404;
    falha.chave = chave;
    throw falha;
  }
}

async function buscarJson(arquivo) {
  var nome = validarArquivo(arquivo);
  if (!nome) {
    var invalido = new Error("Arquivo inválido");
    invalido.status = 400;
    throw invalido;
  }

  var config = configuracaoGold();
  var conteudo = config.bucket
    ? await lerDoS3(nome, config.bucket, config.prefixo)
    : await lerDoLocal(nome);

  try {
    return JSON.parse(conteudo.replace(/^\uFEFF/, ""));
  } catch (erro) {
    console.error("Erro ao interpretar JSON gold:", nome, erro);
    var falha = new Error("Arquivo gold inválido: " + nome);
    falha.status = 500;
    throw falha;
  }
}

module.exports = { buscarJson, validarArquivo, converterTexto };
