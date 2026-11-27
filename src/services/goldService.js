var {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} = require("@aws-sdk/client-s3");

const LIMITE_CONCORRENCIA = 10;
const REGEX_TIMESTAMP = /_(\d{8}-\d{6})(?:_[^/]+)?\.json$/i;
const CAMADA_GOLD = "gold";

function validarCamada(camada) {
  var valor = String(camada ?? CAMADA_GOLD).trim().toLowerCase();

  if (!["bronze", "silver", "gold"].includes(valor)) {
    throw new Error("Camada inválida.");
  }

  return valor;
}

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

// Único lugar que monta prefixos/chaves dentro do bucket.
function prefixoPorDia(hostname, data, camada = CAMADA_GOLD) {
  var partes = partesDataUtc(data);
  return `${validarCamada(camada)}/${validarHostname(hostname)}/${partes.ano}/${partes.mes}/${partes.dia}`;
}

function chaveLatest(hostname) {
  return `${validarCamada(CAMADA_GOLD)}/${validarHostname(hostname)}/latest.json`;
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
  var bucket = opcoes.bucket ?? process.env.S3_BUCKET;
  var client = opcoes.client ?? new S3Client({ region: process.env.AWS_REGION });

  function conferirBucket() {
    if (!bucket) {
      throw new Error("S3_BUCKET não configurado.");
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

  async function listarDatasDisponiveis(hostname) {
    const hostnameValido = validarHostname(hostname);
    const prefixo = `${CAMADA_GOLD}/${hostnameValido}/`;
    const datas = new Set();
    let continuacao;

    do {
      const resposta = await client.send(
        new ListObjectsV2Command({
          Bucket: conferirBucket(),
          Prefix: prefixo,
          ContinuationToken: continuacao,
        }),
      );

      for (const objeto of resposta.Contents ?? []) {
        const partes = String(objeto.Key ?? "").split("/");
        if (
          partes.length >= 6 &&
          timestampDoNome(objeto.Key) !== null &&
          partes[0] === CAMADA_GOLD &&
          partes[1] === hostnameValido &&
          /^\d{4}$/.test(partes[2]) &&
          /^(0[1-9]|1[0-2])$/.test(partes[3]) &&
          /^(0[1-9]|[12]\d|3[01])$/.test(partes[4])
        ) {
          const data = `${partes[2]}-${partes[3]}-${partes[4]}`;
          if (!Number.isNaN(Date.parse(`${data}T00:00:00Z`))) datas.add(data);
        }
      }

      continuacao = resposta.NextContinuationToken;
    } while (continuacao);

    return [...datas].sort();
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

  // Uma única listagem; envia primeiro as capturas mais recentes.
  // Não é cache: os registros vivem apenas durante esta requisição.
  async function lerProgressivamente(hostname, inicio, fim, receberLote, cancelado = () => false) {
    const chaves = (await listarChaves(hostname, inicio, fim)).reverse();
    const registros = [];
    const tamanhoPrimeiroLote = 8;
    const tamanhoLote = 20;
    if (!chaves.length && !cancelado()) await receberLote([], 0, 0);

    for (let indice = 0; indice < chaves.length && !cancelado(); ) {
      // O primeiro lote é menor para a tela receber dados históricos antes.
      const tamanho = indice === 0 ? tamanhoPrimeiroLote : tamanhoLote;
      const lote = chaves.slice(indice, indice + tamanho);
      indice += tamanho;
      for (let posicao = 0; posicao < lote.length && !cancelado(); posicao += LIMITE_CONCORRENCIA) {
        const dados = await Promise.all(
          lote.slice(posicao, posicao + LIMITE_CONCORRENCIA)
            .map(async (chave) => JSON.parse(await lerObjeto(chave))),
        );
        registros.push(...dados);
      }
      if (!cancelado()) {
        // A agregação existente espera ordem cronológica.
        await receberLote(
          [...registros].sort((a, b) => Date.parse(a.capturadoEm) - Date.parse(b.capturadoEm)),
          registros.length,
          chaves.length,
        );
      }
    }
  }

  return {
    prefixoPorDia,
    chaveLatest,
    lerUltimo,
    listarChaves,
    listarDatasDisponiveis,
    lerPorIntervalo,
    lerProgressivamente,
  };
}

module.exports = {
  criarServicoGold,
  prefixoPorDia,
  chaveLatest,
};
