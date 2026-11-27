const {
  S3Client,
  GetObjectCommand,
  paginateListObjectsV2,
} = require("@aws-sdk/client-s3");

const PREFIXO_PADRAO = "dashboard-suporte/";
const LIMITE_HISTORICO = 20;

class ErroConfiguracao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroConfiguracao";
  }
}

class CapturaNaoEncontradaError extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "CapturaNaoEncontradaError";
  }
}

class ErroJsonInvalido extends Error {
  constructor(mensagem, causa) {
    super(mensagem);
    this.name = "ErroJsonInvalido";
    this.cause = causa;
  }
}

class ErroLeituraS3 extends Error {
  constructor(mensagem, causa) {
    super(mensagem);
    this.name = "ErroLeituraS3";
    this.cause = causa;
  }
}

function obterPrefixo() {
  const prefixo = process.env.S3_PREFIX || PREFIXO_PADRAO;
  return prefixo.endsWith("/") ? prefixo : prefixo + "/";
}

// Etapa 1: conferir se o servidor tem as variáveis mínimas para acessar o S3.
function lerConfiguracao() {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  if (!bucket || !region) {
    throw new ErroConfiguracao(
      "Configuração AWS incompleta. Defina AWS_REGION e S3_BUCKET_NAME no ambiente do servidor."
    );
  }

  return {
    bucket,
    region,
    prefixo: obterPrefixo(),
    profile: process.env.AWS_PROFILE || undefined,
  };
}

// Etapa 2: criar o cliente. Sem AWS_PROFILE, o SDK usa a cadeia padrão (env, perfil ou IAM Role).
function criarClienteS3(configuracao) {
  const opcoes = { region: configuracao.region };

  if (configuracao.profile) {
    opcoes.profile = configuracao.profile;
  }

  return new S3Client(opcoes);
}

function traduzirErroS3(erro, acao) {
  const codigo = erro.name || erro.Code || erro.code;
  const status = erro.$metadata && erro.$metadata.httpStatusCode;

  if (codigo === "AccessDenied" || codigo === "Forbidden" || status === 403) {
    return new ErroLeituraS3(
      "Acesso negado ao S3 ao " + acao + ". Verifique as permissões IAM do servidor.",
      erro
    );
  }

  if (codigo === "NoSuchBucket") {
    return new ErroLeituraS3("Bucket S3 não encontrado.", erro);
  }

  return new ErroLeituraS3("Falha ao " + acao + " no S3.", erro);
}

function eArquivoJson(objeto) {
  return Boolean(
    objeto &&
      objeto.Key &&
      !objeto.Key.endsWith("/") &&
      objeto.Key.toLowerCase().endsWith(".json")
  );
}

function ordenarDoMaisRecente(a, b) {
  const tempoA = a.LastModified ? new Date(a.LastModified).getTime() : 0;
  const tempoB = b.LastModified ? new Date(b.LastModified).getTime() : 0;

  if (tempoB !== tempoA) return tempoB - tempoA;

  return String(b.Key).localeCompare(String(a.Key));
}

// Etapa 3: listar só os JSON do prefixo, percorrendo as páginas devolvidas pelo S3.
async function listarCapturas(s3, configuracao) {
  const capturas = [];
  const paginas = paginateListObjectsV2(
    { client: s3 },
    {
      Bucket: configuracao.bucket,
      Prefix: configuracao.prefixo,
    }
  );

  try {
    for await (const pagina of paginas) {
      const objetos = Array.isArray(pagina.Contents) ? pagina.Contents : [];
      capturas.push(...objetos.filter(eArquivoJson));
    }
  } catch (erro) {
    if (erro instanceof ErroLeituraS3) throw erro;
    throw traduzirErroS3(erro, "listar os objetos");
  }

  return capturas.sort(ordenarDoMaisRecente);
}

// Etapa 4: baixar o JSON e conferir se ele tem a forma esperada pelo dashboard.
async function lerCaptura(s3, configuracao, objeto) {
  let conteudo;

  try {
    const resposta = await s3.send(
      new GetObjectCommand({
        Bucket: configuracao.bucket,
        Key: objeto.Key,
      })
    );

    if (!resposta.Body || typeof resposta.Body.transformToString !== "function") {
      throw new ErroJsonInvalido("A captura " + objeto.Key + " não retornou conteúdo.");
    }

    conteudo = await resposta.Body.transformToString();
  } catch (erro) {
    if (erro instanceof ErroLeituraS3 || erro instanceof ErroJsonInvalido) throw erro;
    throw traduzirErroS3(erro, "ler o objeto " + objeto.Key);
  }

  let captura;

  try {
    captura = JSON.parse(conteudo);
  } catch (erro) {
    throw new ErroJsonInvalido(
      "A captura " + objeto.Key + " não contém um JSON válido.",
      erro
    );
  }

  if (!captura || typeof captura !== "object" || Array.isArray(captura)) {
    throw new ErroJsonInvalido(
      "A captura " + objeto.Key + " não contém um objeto JSON."
    );
  }

  if (!captura.metadados || !captura.indicadores) {
    throw new ErroJsonInvalido(
      "A captura " + objeto.Key + " não possui as seções metadados e indicadores."
    );
  }

  return captura;
}

function formatarData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString();
  return valor;
}

function capturasSaoComparaveis(atual, anterior) {
  const abertosAtuais = atual.indicadores.chamados_abertos;
  const abertosAnteriores = anterior.indicadores.chamados_abertos;

  if (!Number.isFinite(abertosAtuais) || !Number.isFinite(abertosAnteriores)) {
    return false;
  }

  const demonstrativoAtual = Boolean(atual.metadados.dados_demonstrativos);
  const demonstrativoAnterior = Boolean(anterior.metadados.dados_demonstrativos);

  if (demonstrativoAtual !== demonstrativoAnterior) return false;

  const periodoAtual = atual.metadados.periodo_consultado;
  const periodoAnterior = anterior.metadados.periodo_consultado;

  if (periodoAtual && periodoAnterior && periodoAtual !== periodoAnterior) {
    return false;
  }

  const instanteAtual = Date.parse(atual.metadados.extraido_em);
  const instanteAnterior = Date.parse(anterior.metadados.extraido_em);

  if (
    Number.isFinite(instanteAtual) &&
    Number.isFinite(instanteAnterior) &&
    instanteAnterior >= instanteAtual
  ) {
    return false;
  }

  return true;
}

// Etapa 5: procurar uma captura anterior comparável para calcular a variação.
async function buscarCapturaAnterior(s3, configuracao, capturas, capturaAtual, objetoAtual) {
  const candidatos = capturas
    .filter((objeto) => objeto.Key !== objetoAtual.Key)
    .filter((objeto) => {
      const tempoAtual = new Date(objetoAtual.LastModified).getTime();
      const tempoCandidato = new Date(objeto.LastModified).getTime();
      return tempoCandidato <= tempoAtual;
    })
    .slice(0, LIMITE_HISTORICO);

  for (const objeto of candidatos) {
    let capturaAnterior;

    try {
      capturaAnterior = await lerCaptura(s3, configuracao, objeto);
    } catch (erro) {
      if (erro instanceof ErroJsonInvalido) continue;
      throw erro;
    }

    if (!capturasSaoComparaveis(capturaAtual, capturaAnterior)) continue;

    return {
      disponivel: true,
      variacaoChamadosAbertos:
        capturaAtual.indicadores.chamados_abertos -
        capturaAnterior.indicadores.chamados_abertos,
      chaveAnterior: objeto.Key,
      ultimaModificacaoAnterior: formatarData(objeto.LastModified),
    };
  }

  return {
    disponivel: false,
    variacaoChamadosAbertos: null,
    chaveAnterior: null,
    ultimaModificacaoAnterior: null,
  };
}

async function buscarCapturaSuporte() {
  const configuracao = lerConfiguracao();
  const s3 = criarClienteS3(configuracao);
  const capturas = await listarCapturas(s3, configuracao);

  if (!capturas.length) {
    throw new CapturaNaoEncontradaError(
      "Nenhuma captura de dashboard de suporte foi encontrada no prefixo " +
        configuracao.prefixo + "."
    );
  }

  const objetoAtual = capturas[0];
  const captura = await lerCaptura(s3, configuracao, objetoAtual);
  const historico = await buscarCapturaAnterior(
    s3,
    configuracao,
    capturas,
    captura,
    objetoAtual
  );

  return {
    captura,
    fonte: {
      chave: objetoAtual.Key,
      ultimaModificacao: formatarData(objetoAtual.LastModified),
      bucket: configuracao.bucket,
      prefixo: configuracao.prefixo,
    },
    historico,
  };
}

module.exports = {
  buscarCapturaSuporte,
  listarCapturas,
  lerCaptura,
  ErroConfiguracao,
  CapturaNaoEncontradaError,
  ErroJsonInvalido,
  ErroLeituraS3,
};
