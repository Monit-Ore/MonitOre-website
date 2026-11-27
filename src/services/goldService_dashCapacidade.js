const fs = require("node:fs/promises");
const path = require("node:path");

const ARQUIVOS = {
  torres: "PANORAMA_TORRES.json",
  componentes: "PANORAMA_ANALISE_COMPONENTES.json",
};

function configuracaoGold() {
  return {
    fonte: process.env.GOLD_FONTE || "s3",
    pasta: process.env.GOLD_PASTA_LOCAL,
    bucket: process.env.GOLD_S3_BUCKET || "monitore-ouro-2026",
    prefixo: (process.env.GOLD_S3_PREFIXO || "").replace(/^\/+|\/+$/g, ""),
    regiao: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    fuso: process.env.GOLD_FUSO || "-03:00",
  };
}

function validarRegistros(registros, nome) {
  if (!Array.isArray(registros)) throw new Error(`${nome}: esperado um array JSON.`);
  const chaves = new Set();
  for (const item of registros) {
    if (!item || !Number.isInteger(item.ID_TORRE) || !Number.isInteger(item.ID_PC)) {
      throw new Error(`${nome}: ID_TORRE e ID_PC devem ser inteiros.`);
    }
    if (nome === ARQUIVOS.componentes && !["CPU", "RAM", "DISCO"].includes(item.COMPONENTE)) {
      throw new Error(`${nome}: componente inválido.`);
    }
    const chave = `${item.ID_TORRE}:${item.ID_PC}:${item.COMPONENTE || ""}`;
    if (chaves.has(chave)) throw new Error(`${nome}: registro duplicado (${chave}).`);
    chaves.add(chave);
    const status = nome === ARQUIVOS.torres ? item.STATUS_GERAL : item.STATUS_ATUAL;
    if (!["NORMAL", "ATENCAO", "CRITICO", "SEM_DADOS"].includes(status)) {
      throw new Error(`${nome}: situação inválida.`);
    }
    for (const [campo, valor] of Object.entries(item)) {
      if (campo.endsWith("_PCT") && valor !== null &&
          (!Number.isFinite(valor) || valor < 0 || valor > 100)) {
        throw new Error(`${nome}: percentual inválido (${campo}).`);
      }
    }
    if (nome === ARQUIVOS.componentes) {
      for (const campo of ["LIMITE_ATENCAO_PCT", "LIMITE_CRITICO_PCT", "ULTIMO_CONSUMO_PCT"]) {
        if (!(campo in item)) throw new Error(`${nome}: campo ausente (${campo}).`);
      }
      for (const campo of ["EXIBIR_TABELA", "DADOS_SUFICIENTES", "PREVISAO_ATENCAO_15D", "PREVISAO_CRITICO_15D"]) {
        if (typeof item[campo] !== "boolean") throw new Error(`${nome}: flag inválida (${campo}).`);
      }
      if (item.VARIACAO_PP !== null && !Number.isFinite(item.VARIACAO_PP)) {
        throw new Error(`${nome}: VARIACAO_PP inválida.`);
      }
      for (const nivel of ["ATENCAO", "CRITICO"]) {
        if (item[`PREVISAO_${nivel}_15D`] === true) {
          const dias = item[`DIAS_EXIBICAO_${nivel}`];
          if (!Number.isInteger(dias) || dias < 1 || dias > 15) {
            throw new Error(`${nome}: prazo de previsão inválido.`);
          }
        }
      }
    } else if (typeof item.MONITORAMENTO_ATIVO !== "boolean") {
      throw new Error(`${nome}: MONITORAMENTO_ATIVO deve ser booleano.`);
    }
  }
  return registros;
}

function criarLeitorGold(config = configuracaoGold(), dependencias = {}) {
  let cliente;
  let GetObjectCommand;
  if (config.fonte === "s3") {
    if (!config.regiao) throw new Error("Configure AWS_REGION para ler a Gold no S3.");
    const sdk = require("@aws-sdk/client-s3");
    GetObjectCommand = sdk.GetObjectCommand;
    cliente = dependencias.s3Client || new sdk.S3Client({ region: config.regiao, maxAttempts: 2 });
  } else if (config.fonte !== "local" || !config.pasta) {
    throw new Error("Configure GOLD_FONTE=s3 ou GOLD_FONTE=local com GOLD_PASTA_LOCAL.");
  }

  async function ler(nome) {
    let texto;
    if (config.fonte === "local") {
      texto = await (dependencias.readFile || fs.readFile)(path.resolve(config.pasta, nome), "utf8");
    } else {
      const objeto = await cliente.send(new GetObjectCommand({
        Bucket: config.bucket,
        Key: [config.prefixo, nome].filter(Boolean).join("/"),
      }), { abortSignal: AbortSignal.timeout(10000) });
      texto = await objeto.Body.transformToString();
    }
    return validarRegistros(JSON.parse(texto.replace(/^\uFEFF/, "")), nome);
  }

  return async function carregar() {
    const [torres, componentes] = await Promise.all([ler(ARQUIVOS.torres), ler(ARQUIVOS.componentes)]);
    const pcs = new Set(torres.map((item) => `${item.ID_TORRE}:${item.ID_PC}`));
    if (componentes.some((item) => !pcs.has(`${item.ID_TORRE}:${item.ID_PC}`))) {
      throw new Error("JSONs da Gold incompatíveis: componente sem resumo da torre/PC.");
    }
    return { torres, componentes, fuso: config.fuso || "-03:00" };
  };
}

function dataGold(valor, fuso) {
  if (!valor) return null;
  const iso = valor.replace(" ", "T");
  const comFuso = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : iso + fuso;
  if (!Number.isFinite(Date.parse(comFuso))) throw new Error("Data inválida na Gold.");
  return new Date(comFuso).toISOString();
}

function maisRecente(datas) {
  return datas.filter(Boolean).sort().at(-1) || null;
}

function normalizarComponente(nome) {
  const texto = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return ["CPU", "RAM", "DISCO"].find((componente) => texto.includes(componente));
}

function montarPanorama(cadastros, gold) {
  const resumos = new Map(gold.torres.map((item) => [`${item.ID_TORRE}:${item.ID_PC}`, item]));
  const analises = new Map(gold.componentes.map((item) =>
    [`${item.ID_TORRE}:${item.ID_PC}:${item.COMPONENTE}`, item]));
  const torres = cadastros.map((torre) => {
    const componentes = torre.monitoramentoAtivo ? torre.componentes.map((cadastro) => {
      const chavePc = `${torre.id_torre}:${cadastro.id_pc}`;
      const resumo = resumos.get(chavePc);
      const item = resumo?.MONITORAMENTO_ATIVO === true
        ? analises.get(`${chavePc}:${normalizarComponente(cadastro.nome)}`) : null;
      const previsoes = item?.SITUACAO_PREVISAO === "PREVISAO_INDISPONIVEL" || !item ? null :
        ["ATENCAO", "CRITICO"].flatMap((nivel) => item[`PREVISAO_${nivel}_15D`] === true
          ? [{ nivel: nivel.toLowerCase(), dias: item[`DIAS_EXIBICAO_${nivel}`] }] : []);
      return {
        ...cadastro,
        atencao: item?.LIMITE_ATENCAO_PCT ?? cadastro.atencao,
        critico: item?.LIMITE_CRITICO_PCT ?? cadastro.critico,
        atual: item?.ULTIMO_CONSUMO_PCT ?? null,
        situacao: item?.STATUS_ATUAL.toLowerCase() || "sem_dados",
        variacao: item?.VARIACAO_PP ?? null,
        crescente: item?.CRESCIMENTO_PREOCUPANTE === true,
        sobPressao: item?.SOB_PRESSAO === true,
        comparavel: item?.DADOS_SUFICIENTES === true,
        exibirTabela: item?.EXIBIR_TABELA === true,
        prioridade: item?.PRIORIDADE ?? null,
        ultimaLeitura: dataGold(item?.DATA_HORA_ULTIMA_LEITURA, gold.fuso),
        previsoes,
      };
    }) : [];
    const pcs = [...new Set(componentes.map((item) => item.id_pc))];
    const estados = pcs.map((id) => resumos.get(`${torre.id_torre}:${id}`)?.STATUS_GERAL.toLowerCase() || "sem_dados");
    const situacao = !torre.monitoramentoAtivo ? "sem_monitoramento" :
      ["critico", "atencao", "sem_dados", "normal"].find((estado) => estados.includes(estado)) || "sem_dados";
    return {
      ...torre, componentes, situacao,
      ultimaLeitura: maisRecente(componentes.map((item) => item.ultimaLeitura)),
      crescente: componentes.some((item) => item.crescente),
      atencaoPrevista: componentes.some((item) => item.previsoes?.some((evento) => evento.nivel === "atencao")),
      criticoPrevisto: componentes.some((item) => item.previsoes?.some((evento) => evento.nivel === "critico")),
    };
  });
  return { torres, ultimaAtualizacao: maisRecente(torres.map((torre) => torre.ultimaLeitura)) };
}

let leitor;
async function carregarGold() {
  leitor ||= criarLeitorGold();
  return leitor();
}

module.exports = { carregarGold, criarLeitorGold, montarPanorama };