var torresModel = require("../models/torresModel");
var goldService = require("../services/goldService");
var dashboardService = require("../services/dashboardService");
var cacheService = require("../services/cacheService");

const CACHE_LATEST_MS = 30 * 1000;
const CACHE_DASHBOARD_MS = 60 * 1000;
const CACHE_DATAS_MS = 5 * 60 * 1000;

function chaveCacheLatest(hostname) {
  return `latest:${hostname}`;
}

function chaveCacheDashboard(hostname, inicioMs, fimMs) {
  // Intervalos móveis (últimas 24 h) mudam alguns milissegundos a cada acesso.
  // Agrupar em janelas de 5 min permite reaproveitar a consulta equivalente.
  const janela = 5 * 60 * 1000;
  return `dashboard:${hostname}:${Math.floor(inicioMs / janela)}:${Math.floor(fimMs / janela)}`;
}

async function lerUltimoComCache(hostname) {
  const chave = chaveCacheLatest(hostname);
  const existente = cacheService.obter(chave);
  if (existente) return existente;

  const registro = await goldService.criarServicoGold().lerUltimo(hostname);
  if (registro) cacheService.guardar(chave, registro, CACHE_LATEST_MS);
  return registro;
}

// Ordem crescente de gravidade: normal < alerta < crítico.
const NIVEIS_STATUS = [
  { nome: "normal", padrao: /NORMAL/i },
  { nome: "alerta", padrao: /ALERT|ATEN/i },
  { nome: "critico", padrao: /CRIT/i },
];

function normalizarStatus(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function nivelStatus(valor) {
  var texto = normalizarStatus(valor);

  for (var indice = 0; indice < NIVEIS_STATUS.length; indice++) {
    if (NIVEIS_STATUS[indice].padrao.test(texto)) return indice;
  }

  return -1;
}

function piorStatusDosComponentes(registro) {
  var componentes = registro?.componentesMonitorados;

  if (!Array.isArray(componentes) || componentes.length === 0) {
    return "sem dados";
  }

  var piorNivel = -1;
  var statusEncontrado = "sem dados";

  componentes.forEach((componente) => {
    var nivel = nivelStatus(componente?.status);
    if (nivel > piorNivel) {
      piorNivel = nivel;
      statusEncontrado = componente.status;
    }
  });

  return statusEncontrado;
}

async function selecaoTorre(req, res) {
  try {
    const { fkEmpresa, idUsuario } = req.query;

    if (!fkEmpresa || !idUsuario) {
      return res.status(400).json({
        mensagem: "Identificação do usuário e fabricante obrigatórias.",
      });
    }

    const torres = await torresModel.listarTorresPorUsuario(
      idUsuario,
      fkEmpresa
    );

    const mapaMineradoras = new Map();

    torres.forEach((torre) => {
      const nomeMineradora = torre.mineradora_nome;

      if (!mapaMineradoras.has(nomeMineradora)) {
        mapaMineradoras.set(nomeMineradora, []);
      }

      mapaMineradoras.get(nomeMineradora).push({
        id_torre: torre.id_torre,
        codigo: torre.codigo,
      });
    });

    const resposta = Array.from(
      mapaMineradoras,
      ([mineradora, listaTorres]) => ({
        mineradora,
        torres: listaTorres,
      })
    );

    return res.status(200).json(resposta);
  } catch (erro) {
    console.error("Erro ao buscar torres para seleção:", erro);

    return res.status(500).json({
      mensagem: "Erro ao buscar torres.",
    });
  }
}


async function listarOpcoesCadastro(req, res) {
  try {
    const { fkEmpresa } = req.query;

    const mineradoras = await torresModel.listarMineradoras();

    res.status(200).json({
      mineradoras
    });
  } catch (erro) {
    console.error("Erro ao buscar opções de cadastro:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar opções de cadastro." });
  }
}

async function cadastrarTorre(req, res) {
  try {
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const {
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes,
    } = req.body;

    if (!nome || !codigo || !fk_mineradora) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações Gerais.",
      });
    }

    if (
      !pc_industrial ||
      !pc_industrial.identificador ||
      !pc_industrial.hostname ||
      !pc_industrial.uuid ||
      !endereco.cep ||
      !endereco.estado ||
      !endereco.cidade ||
      !endereco.logradouro ||
      !endereco.bairro ||
      !endereco.numero ||
      !endereco.complemento
    ) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações do PC Industrial e/ou endereço da torre.",
      });
    }

    if (!Array.isArray(componentes) || componentes.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione ao menos uma métrica de componente para monitorar.",
      });
    }

    const componentesValidos = componentes.every((componente) =>
      componente &&
      Number.isInteger(Number(componente.fk_componente)) &&
      Number(componente.fk_componente) > 0 &&
      Number.isFinite(Number(componente.alerta_critico)) &&
      Number(componente.alerta_critico) > 0 &&
      Number(componente.alerta_critico) <= 100 &&
      Number.isFinite(Number(componente.alerta_atencao)) &&
      Number(componente.alerta_atencao) > 0 &&
      Number(componente.alerta_atencao) <= 100 &&
      Number.isInteger(Number(componente.limite_alerta_diario)) &&
      Number(componente.limite_alerta_diario) > 0
    );

    if (!componentesValidos) {
      return res.status(400).json({
        mensagem: "Informe limites de alerta válidos para todos os componentes.",
      });
    }

    const codigoJaExiste = await torresModel.verificarCodigoExistente(
      fkEmpresa,
      codigo,
      pc_industrial.uuid
    );

    if (codigoJaExiste) {
      return res
        .status(409)
        .json({ mensagem: "Já existe uma torre com esse código." });
    }

    const novaTorre = await torresModel.criarTorre(
      fkEmpresa,
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes
    );

    res.status(201).json(novaTorre);
  } catch (erro) {
    console.error("Erro ao cadastrar torre:", erro);
    res.status(500).json({ mensagem: "Erro ao cadastrar torre." });
  }
}


async function buscarTorrePorId(req, res) {
  try {
    const { id } = req.params;
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const torre = await torresModel.buscarTorrePorId(id, fkEmpresa);

    if (!torre) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    res.status(200).json(torre);
  } catch (erro) {
    console.error("Erro ao buscar torre por ID:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar torre." });
  }
}

async function mostrarQtdAtivas(req,res) {
  try { 
    const { id } = req.params; 
    const { mineradora } = req.query;

    if (!id) {
      return res.status(400).json({ mensagem: "O ID do usuário é obrigatório." });
    }

    const resultado = await torresModel.qtdTorresAtivas(id, mineradora);

    return res.status(200).json(resultado[0]);
    
  }catch(erro){
    console.error("Erro ao buscar torre por ID:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar torre." });
  }
}

async function listarTorresDisponiveis(req, res) {
  try {
    const { id } = req.params;
    const { mineradora } = req.query;

    if (!id) {
      return res.status(400).json({ mensagem: "O ID do usuário é obrigatório." });
    }

    const torres = await torresModel.listarTorresDisponiveis(id, mineradora);

    return res.status(200).json(torres);
  } catch (erro) {
    console.error("Erro ao listar torres disponíveis:", erro);
    return res.status(500).json({
      mensagem: "Erro ao listar torres disponíveis.",
    });
  }
}

async function atualizarTorre(req, res) {
  try {
    const { id } = req.params;
    const { fkEmpresa } = req.query;
    const idTorre = Number(id);
    const idEmpresa = Number(fkEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    if (!Number.isInteger(idTorre) || idTorre <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const {
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes,
    } = req.body;

    if (
      typeof nome !== "string" ||
      !nome.trim() ||
      typeof codigo !== "string" ||
      !codigo.trim() ||
      !Number.isInteger(Number(fk_mineradora)) ||
      Number(fk_mineradora) <= 0
    ) {
      return res.status(400).json({
        mensagem: "Preencha todos os campos obrigatórios de Informações Gerais.",
      });
    }

    if (
      !pc_industrial ||
      !pc_industrial.identificador ||
      !pc_industrial.hostname ||
      !pc_industrial.uuid ||
      !endereco ||
      !endereco.cep ||
      !endereco.estado ||
      !endereco.cidade ||
      !endereco.logradouro ||
      !endereco.bairro ||
      !endereco.numero ||
      !endereco.complemento
    ) {
      return res.status(400).json({
        mensagem: "Preencha todos os campos obrigatórios do PC Industrial e Endereço.",
      });
    }

    if (!Array.isArray(componentes) || componentes.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione ao menos uma métrica de componente para monitorar.",
      });
    }

    const componentesValidos = componentes.every((componente) =>
      componente &&
      Number.isInteger(Number(componente.fk_componente)) &&
      Number(componente.fk_componente) > 0 &&
      Number.isFinite(Number(componente.alerta_critico)) &&
      Number(componente.alerta_critico) > 0 &&
      Number(componente.alerta_critico) <= 100 &&
      Number.isFinite(Number(componente.alerta_atencao)) &&
      Number(componente.alerta_atencao) > 0 &&
      Number(componente.alerta_atencao) <= 100 &&
      Number.isInteger(Number(componente.limite_alerta_diario)) &&
      Number(componente.limite_alerta_diario) > 0
    );

    if (!componentesValidos) {
      return res.status(400).json({
        mensagem: "Informe limites de alerta válidos para todos os componentes.",
      });
    }

    await torresModel.atualizarTorre(
      idTorre,
      idEmpresa,
      nome.trim(),
      codigo.trim(),
      Number(fk_mineradora),
      pc_industrial,
      endereco,
      componentes
    );

    res.status(200).json({ mensagem: "Torre atualizada com sucesso!" });
  } catch (erro) {
    console.error("Erro ao atualizar torre:", erro);
    if (erro.message === "Torre não encontrada.") {
      return res.status(404).json({ mensagem: erro.message });
    }
    res.status(500).json({ mensagem: "Erro ao atualizar torre." });
  }
}

async function buscarStatusDaTorre(req, res) {
  var respostaSemDados = { status: "sem dados", capturadoEm: null };

  try {
    const { idTorre } = req.params;
    const { fkEmpresa } = req.query;
    const id = Number(idTorre);
    const idEmpresa = Number(fkEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const hostname = await torresModel.buscarHostnamePorTorre(id, idEmpresa);
    if (!hostname) {
      return res.status(200).json(respostaSemDados);
    }

    var registro;
    try {
      registro = await lerUltimoComCache(hostname);
    } catch (erroLeitura) {
      console.warn("AVISO: falha ao ler latest.json da torre", id, erroLeitura.message);
      return res.status(200).json(respostaSemDados);
    }

    if (!registro) {
      return res.status(200).json(respostaSemDados);
    }

    return res.status(200).json({
      status: piorStatusDosComponentes(registro),
      capturadoEm: registro.capturadoEm ?? null,
    });
  } catch (erro) {
    console.error("Erro ao consultar status da torre:", erro);
    return res.status(200).json(respostaSemDados);
  }
}

async function buscarDashboardDaTorre(req, res) {
  try {
    const { idTorre } = req.params;
    const { fkEmpresa, inicio, fim } = req.query;
    const id = Number(idTorre);
    const idEmpresa = Number(fkEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const inicioMs = Date.parse(inicio);
    const fimMs = Date.parse(fim);

    if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) {
      return res.status(400).json({
        mensagem: "Informe início e fim no formato ISO 8601 (UTC).",
      });
    }

    if (inicioMs >= fimMs) {
      return res.status(400).json({
        mensagem: "O início do intervalo deve ser menor que o fim.",
      });
    }

    if (fimMs - inicioMs > 31 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({
        mensagem: "O intervalo máximo é de 31 dias.",
      });
    }

    const hostname = await torresModel.buscarHostnamePorTorre(id, idEmpresa);
    if (!hostname) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    const chaveCache = chaveCacheDashboard(hostname, inicioMs, fimMs);
    const emCache = cacheService.obter(chaveCache);
    if (emCache) {
      if (req.query.progressivo === "1") {
        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        return res.end(JSON.stringify({
          dados: emCache.dados,
          carregados: emCache.total,
          total: emCache.total,
          concluido: true,
          cache: true,
        }) + "\n");
      }
      return res.status(200).json(emCache.dados);
    }

    if (req.query.progressivo === "1") {
      // Cada linha JSON é uma atualização completa do que já foi lido.
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      let cancelado = false;
      res.on("close", () => { cancelado = true; });
      try {
        await goldService.criarServicoGold().lerProgressivamente(
          hostname, inicio, fim,
          async (registros, carregados, total) => {
            if (cancelado) return;
            const dados = dashboardService.agregarDashboard(registros, inicio, fim);
            if (carregados === total) {
              cacheService.guardar(
                chaveCache,
                { dados, total },
                CACHE_DASHBOARD_MS,
              );
            }
            res.write(JSON.stringify({
              dados,
              carregados, total, concluido: carregados === total,
              cache: false,
            }) + "\n");
          },
          () => cancelado,
        );
      } catch (erro) {
        console.error("Erro no carregamento progressivo:", erro);
        if (!cancelado) res.write(JSON.stringify({ mensagem: "Falha ao carregar o restante do histórico." }) + "\n");
      } finally {
        if (!cancelado) res.end();
      }
      return;
    }

    const registros = await goldService.criarServicoGold().lerPorIntervalo(
      hostname,
      inicio,
      fim,
    );

    const dados = dashboardService.agregarDashboard(registros, inicio, fim);
    cacheService.guardar(
      chaveCache,
      { dados, total: registros.length },
      CACHE_DASHBOARD_MS,
    );
    return res.status(200).json(dados);
  } catch (erro) {
    console.error("Erro ao consultar dashboard da torre:", erro);
    return res.status(500).json({
      mensagem: "Erro ao consultar dados da torre.",
    });
  }
}

async function buscarAlertasDoDiaDaTorre(req, res) {
  try {
    const { idTorre } = req.params;
    const { fkEmpresa } = req.query;
    const id = Number(idTorre);
    const idEmpresa = Number(fkEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const hostname = await torresModel.buscarHostnamePorTorre(id, idEmpresa);
    if (!hostname) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    const registro = await lerUltimoComCache(hostname);
    if (!registro) {
      return res.status(404).json({ mensagem: "Sem dados para esta torre." });
    }

    const capturadoMs = Date.parse(registro.capturadoEm);
    if (Number.isNaN(capturadoMs)) {
      return res.status(404).json({ mensagem: "Arquivo mais recente sem data válida." });
    }

    const diaIso = new Date(capturadoMs).toISOString().slice(0, 10);
    const chaveCache = `alertasDia:${hostname}:${diaIso}`;
    const emCache = cacheService.obter(chaveCache);
    if (emCache) {
      return res.status(200).json({
        hostname,
        capturadoEm: registro.capturadoEm,
        barrasAlertas: emCache,
      });
    }

    const inicio = `${diaIso}T00:00:00.000Z`;
    const fim = `${diaIso}T23:59:59.999Z`;
    const registros = await goldService.criarServicoGold().lerPorIntervalo(
      hostname, inicio, fim,
    );
    const barrasAlertas = dashboardService.contarAlertasDoDia(
      registros, registro.barrasAlertas, diaIso,
    );
    cacheService.guardar(chaveCache, barrasAlertas, CACHE_DASHBOARD_MS);

    return res.status(200).json({
      hostname,
      capturadoEm: registro.capturadoEm,
      barrasAlertas,
    });
  } catch (erro) {
    console.error("Erro ao contar alertas do dia da torre:", erro);
    return res.status(500).json({ mensagem: "Erro ao consultar alertas do dia." });
  }
}

async function buscarDatasDisponiveis(req, res) {
  try {
    const id = Number(req.params.idTorre);
    const idEmpresa = Number(req.query.fkEmpresa);
    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const hostname = await torresModel.buscarHostnamePorTorre(id, idEmpresa);
    if (!hostname) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    const chave = `datas:${hostname}`;
    let datas = cacheService.obter(chave);
    if (!datas) {
      datas = await goldService.criarServicoGold().listarDatasDisponiveis(hostname);
      cacheService.guardar(chave, datas, CACHE_DATAS_MS);
    }

    return res.status(200).json({ hostname, datas });
  } catch (erro) {
    console.error("Erro ao listar datas da torre:", erro);
    return res.status(500).json({ mensagem: "Erro ao listar datas disponíveis." });
  }
}

async function buscarDadosDaTorre(req, res) {
  try {
    const { idTorre } = req.params;
    const { fkEmpresa } = req.query;
    const id = Number(idTorre);
    const idEmpresa = Number(fkEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID de torre inválido." });
    }

    const hostname = await torresModel.buscarHostnamePorTorre(id, idEmpresa);
    if (!hostname) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    const dados = await lerUltimoComCache(hostname);
    if (!dados) {
      return res.status(404).json({ mensagem: "Sem dados para esta torre." });
    }

    return res.status(200).json(dados);
  } catch (erro) {
    console.error("Erro ao consultar dados da torre:", erro);
    return res.status(500).json({
      mensagem: "Erro ao consultar dados da torre.",
    });
  }
}

// Certifique-se de exportar as novas funções junto com as antigas:
module.exports = {
  selecaoTorre,
  listarOpcoesCadastro,
  cadastrarTorre,
  buscarTorrePorId,
  atualizarTorre,
  buscarDadosDaTorre,
  buscarStatusDaTorre,
  buscarDashboardDaTorre,
  buscarAlertasDoDiaDaTorre,
  buscarDatasDisponiveis,
  listarTorresDisponiveis,
  mostrarQtdAtivas
};
