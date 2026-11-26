var {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} = require("@aws-sdk/client-s3");

const LIMITE_CONCORRENCIA = 10;
const REGEX_TIMESTAMP = /_(\d{8}-\d{6})(?:_[^/]+)?\.json$/i;

function validarHostname(hostname) {
  var valor = String(hostname ?? "").trim();
  if (!valor || /[\\/]/.test(valor)) {
    throw new Error("Hostname inválido.");
  }
  return valor;
}

function partesDataUtc(data) {
  var instante = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(instante.getTime())) {
    throw new Error("Data inválida.");
  }
  return {
    ano: String(instante.getUTCFullYear()).padStart(4, "0"),
    mes: String(instante.getUTCMonth() + 1).padStart(2, "0"),
    dia: String(instante.getUTCDate()).padStart(2, "0"),
    timestamp: instante.getTime(),
  };
}

// Único lugar que monta chaves da gold.
function prefixoPorDia(hostname, data) {
  var partes = partesDataUtc(data);
  return `${validarHostname(hostname)}/${partes.ano}/${partes.mes}/${partes.dia}`;
}

function chaveLatest(hostname) {
  return `${validarHostname(hostname)}/latest.json`;
}

function timestampDoNome(chave) {
  var encontrado = String(chave).match(REGEX_TIMESTAMP);
  if (!encontrado) return null;

  var valor = encontrado[1];
  var iso = `${valor.slice(0, 4)}-${valor.slice(4, 6)}-${valor.slice(6, 8)}T${valor.slice(9, 11)}:${valor.slice(11, 13)}:${valor.slice(13, 15)}Z`;
  var timestamp = Date.parse(iso);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function criarServicoGold(opcoes = {}) {
  var bucket = opcoes.bucket ?? process.env.S3_BUCKET_GOLD;
  var client = opcoes.client ?? new S3Client({ region: process.env.AWS_REGION });

  function conferirBucket() {
    if (!bucket) {
      throw new Error("S3_BUCKET_GOLD não configurado.");
    }
    return bucket;
  }

  async function lerObjeto(chave) {
    var resposta = await client.send(
      new GetObjectCommand({ Bucket: conferirBucket(), Key: chave }),
    );
    var corpo = resposta.Body;

    if (corpo && typeof corpo.transformToString === "function") {
      return await corpo.transformToString();
    }
    if (corpo && typeof corpo.on === "function") {
      var pedacos = [];
      for await (var pedaco of corpo) pedacos.push(pedaco);
      return Buffer.concat(pedacos).toString("utf8");
    }
    return String(corpo ?? "");
  }

  async function lerUltimo(hostname) {
    var chave = chaveLatest(hostname);

    try {
      return JSON.parse(await lerObjeto(chave));
    } catch (erro) {
      if (
        erro?.name === "NoSuchKey" ||
        erro?.name === "NotFound" ||
        erro?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw erro;
    }
  }

  async function listarChaves(hostname, inicio, fim) {
    var inicioMs = partesDataUtc(inicio).timestamp;
    var fimMs = partesDataUtc(fim).timestamp;

    if (inicioMs >= fimMs) {
      throw new Error("Intervalo inválido: inicio deve ser menor que fim.");
    }

    var atual = new Date(inicioMs);
    var ultimoDia = new Date(fimMs);
    var chaves = [];

    while (atual <= ultimoDia) {
      var prefixo = `${prefixoPorDia(hostname, atual)}/`;
      var continuacao;

      do {
        var resposta = await client.send(
          new ListObjectsV2Command({
            Bucket: conferirBucket(),
            Prefix: prefixo,
            ContinuationToken: continuacao,
          }),
        );

        for (var objeto of resposta.Contents ?? []) {
          var chave = objeto.Key;
          var timestamp = timestampDoNome(chave);

          if (timestamp !== null && timestamp >= inicioMs && timestamp <= fimMs) {
            chaves.push({ chave, timestamp });
          }
        }

        continuacao = resposta.NextContinuationToken;
      } while (continuacao);

      atual = new Date(
        Date.UTC(atual.getUTCFullYear(), atual.getUTCMonth(), atual.getUTCDate() + 1),
      );
    }

    chaves.sort((a, b) => a.timestamp - b.timestamp);
    return chaves.map((item) => item.chave);
  }

  async function lerPorIntervalo(hostname, inicio, fim) {
    var chaves = await listarChaves(hostname, inicio, fim);
    var resultados = new Array(chaves.length);

    for (var indice = 0; indice < chaves.length; indice += LIMITE_CONCORRENCIA) {
      var lote = chaves.slice(indice, indice + LIMITE_CONCORRENCIA);
      var conteudos = await Promise.all(
        lote.map(async (chave, posicao) => ({
          posicao: indice + posicao,
          dados: JSON.parse(await lerObjeto(chave)),
        })),
      );

      conteudos.forEach((item) => {
        resultados[item.posicao] = item.dados;
      });
    }

    return resultados;
  }

  return {
    prefixoPorDia,
    chaveLatest,
    lerUltimo,
    listarChaves,
    lerPorIntervalo,
  };
}

module.exports = {
  criarServicoGold,
  prefixoPorDia,
  chaveLatest,
};
