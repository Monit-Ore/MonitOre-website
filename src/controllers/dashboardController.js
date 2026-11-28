var fs = require("fs");
var path = require("path");
var mineradoraModel = require("../models/mineradoraModel");
var empresaModel = require("../models/empresaModel");
var torresModel = require("../models/torresModel");
var { filtrarDashboard } = require("../services/escopoDashboardMineradoras");

function diretorioGold() {
  var configurado = process.env.MONITORE_GOLD_DIR;
  if (configurado && path.isAbsolute(configurado)) {
    return configurado;
  }
  if (configurado) {
    return path.resolve(process.cwd(), configurado);
  }
  return path.resolve(__dirname, "../../../MonitOre-python/gold");
}

function lerJson(nome, padrao) {
  var caminho = path.join(diretorioGold(), nome);
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch (erro) {
    return padrao;
  }
}

var DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var MS_POR_DIA = 24 * 60 * 60 * 1000;
var PERIODO_PADRAO = "7";
var PERIODOS = {
  "1": { tipo: "dias", quantidade: 1, rotulo: "Hoje" },
  "7": { tipo: "dias", quantidade: 7, rotulo: "Últimos 7 dias" },
  "15": { tipo: "dias", quantidade: 15, rotulo: "Últimos 15 dias" },
  "30": { tipo: "dias", quantidade: 30, rotulo: "Últimos 30 dias" },
  "3m": { tipo: "meses", quantidade: 3, rotulo: "Últimos 3 meses" },
  "6m": { tipo: "meses", quantidade: 6, rotulo: "Últimos 6 meses" },
};

function ehAnoBissexto(ano) {
  return ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
}

function diasNoMes(ano, mes) {
  if (mes === 2 && ehAnoBissexto(ano)) {
    return 29;
  }
  return DIAS_POR_MES[mes - 1] || 0;
}

function serialCivil(ano, mes, dia) {
  var data = new Date(0);
  data.setUTCFullYear(ano, mes - 1, dia);
  data.setUTCHours(0, 0, 0, 0);
  return data.getTime();
}

function referenciaLocal(agora) {
  var ano = agora.getFullYear();
  var mes = agora.getMonth() + 1;
  var dia = agora.getDate();
  return { ano: ano, mes: mes, dia: dia, serial: serialCivil(ano, mes, dia) };
}

function parseDataRegistro(data) {
  if (typeof data !== "string") {
    return null;
  }
  var partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  var dia;
  var mes;
  var ano;

  if (partes) {
    dia = Number(partes[1]);
    mes = Number(partes[2]);
    ano = Number(partes[3]);
  } else {
    partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
    if (!partes) {
      return null;
    }
    ano = Number(partes[1]);
    mes = Number(partes[2]);
    dia = Number(partes[3]);
  }

  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) {
    return null;
  }
  return { ano: ano, mes: mes, dia: dia, serial: serialCivil(ano, mes, dia) };
}

function subtrairMeses(hoje, quantidade) {
  var indice = hoje.ano * 12 + (hoje.mes - 1) - quantidade;
  var ano = Math.floor(indice / 12);
  var mes = (indice % 12 + 12) % 12 + 1;
  var dia = Math.min(hoje.dia, diasNoMes(ano, mes));
  return { ano: ano, mes: mes, dia: dia, serial: serialCivil(ano, mes, dia) };
}

function resolverPeriodo(valor, hoje) {
  var chave = String(valor === undefined || valor === null ? "" : valor).trim();
  if (!Object.prototype.hasOwnProperty.call(PERIODOS, chave)) {
    chave = PERIODO_PADRAO;
  }
  var definicao = PERIODOS[chave];
  var inicioExclusivo;
  var diasEfetivos;

  if (definicao.tipo === "meses") {
    inicioExclusivo = subtrairMeses(hoje, definicao.quantidade);
    diasEfetivos = Math.round((hoje.serial - inicioExclusivo.serial) / MS_POR_DIA);
  } else {
    diasEfetivos = definicao.quantidade;
    inicioExclusivo = { serial: hoje.serial - diasEfetivos * MS_POR_DIA };
  }

  return {
    selecionado: chave,
    rotulo: definicao.rotulo,
    dias: diasEfetivos,
    inicioExclusivo: inicioExclusivo.serial,
    fimInclusivo: hoje.serial,
  };
}

function filtrarPorPeriodo(registros, periodoResolvido) {
  return registros.filter(function (registro) {
    var data = parseDataRegistro(registro.DATA);
    return data !== null
      && data.serial > periodoResolvido.inicioExclusivo
      && data.serial <= periodoResolvido.fimInclusivo;
  });
}

function mediana(valores) {
  if (!valores.length) {
    return 0;
  }
  var ordenados = valores.slice().sort(function (a, b) {
    return a - b;
  });
  var meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) {
    return ordenados[meio];
  }
  return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

function construirGrafico(alertasDiarios, mineradoras, periodoResolvido, modo) {
  var filtrados = filtrarPorPeriodo(alertasDiarios, periodoResolvido);
  var totais = new Map();

  mineradoras.forEach(function (mineradora) {
    totais.set(String(mineradora.ID_MINERADORA), 0);
  });

  filtrados.forEach(function (registro) {
    var chave = String(registro.ID_MINERADORA);
    var anterior = totais.has(chave) ? totais.get(chave) : 0;
    var divisor = 1;
    if (modo === "por_torre") {
      var mineradora = mineradoras.find(function (item) {
        return String(item.ID_MINERADORA) === chave;
      });
      divisor = mineradora && mineradora.TOTAL_TORRES ? mineradora.TOTAL_TORRES : 1;
    }
    totais.set(chave, anterior + Number(registro.QUANTIDADE || 0) / divisor);
  });

  var ordenados = Array.from(totais, function (item) {
    var mineradora = mineradoras.find(function (candidato) {
      return String(candidato.ID_MINERADORA) === item[0];
    });
    return {
      id: item[0],
      nome: mineradora ? mineradora.MINERADORA : "Mineradora " + item[0],
      valor: Math.round(item[1] * 100) / 100,
    };
  }).sort(function (a, b) {
    return b.valor - a.valor;
  });

  var top3 = ordenados.slice(0, 3);
  var valorMediana = Math.round(mediana(ordenados.map(function (item) {
    return item.valor;
  })) * 100) / 100;

  return {
    labels: top3.map(function (item) {
      return item.nome;
    }),
    valores: top3.map(function (item) {
      return item.valor;
    }),
    mediana: valorMediana,
    periodo: periodoResolvido.dias,
    periodo_selecionado: periodoResolvido.selecionado,
    periodo_rotulo: periodoResolvido.rotulo,
    modo: modo,
  };
}

function adicionarDetalhes(mineradoras, statusTorres) {
  var prioridade = {
    "Crítico": 3,
    "Atenção": 2,
    "Normal": 1,
    "Desconhecido": 0,
  };

  return mineradoras.map(function (mineradora) {
    var id = String(mineradora.ID_MINERADORA);
    var torres = statusTorres.filter(function (torre) {
      return String(torre.ID_MINERADORA) === id;
    });
    var semCaptura = torres.filter(function (torre) {
      return torre.STATUS_TORRE === "Desconhecido";
    });
    var comOcorrencia = torres.filter(function (torre) {
      return torre.STATUS_TORRE !== "Normal" && torre.STATUS_TORRE !== "Desconhecido";
    }).sort(function (a, b) {
      return (prioridade[b.STATUS_TORRE] || 0) - (prioridade[a.STATUS_TORRE] || 0);
    });

    var detalhes = [];
    if (comOcorrencia.length) {
      var pior = comOcorrencia[0];
      detalhes.push(pior.NOME_TORRE || pior.CODIGO_TORRE || "Torre");
      detalhes.push(pior.OBSERVACAO || pior.STATUS_TORRE);
    } else if (mineradora.OBSERVACAO && !semCaptura.length) {
      detalhes.push(mineradora.OBSERVACAO);
    }

    if (semCaptura.length) {
      detalhes.push(semCaptura.length === 1
        ? "1 torre sem captura"
        : semCaptura.length + " torres sem captura");
    }

    return Object.assign({}, mineradora, {
      DETALHE: detalhes.length ? detalhes.join(" · ") : "",
    });
  });
}

async function carregarDashboardMineradoras() {
  try {
    return await mineradoraModel.buscarJson("dashboard.json");
  } catch (erro) {
    // Sem credenciais/S3 disponíveis, os indicadores básicos vêm do MySQL.
    console.warn(
      "Gold indisponível; usando o banco local para a dashboard de mineradoras:",
      erro && erro.message ? erro.message : erro,
    );
    var mineradoras = await empresaModel.listarMineradorasMonitoradas();
    var totalTorres = mineradoras.reduce(function (soma, item) {
      return soma + Number(item.TOTAL_TORRES || 0);
    }, 0);

    return {
      atualizado_em: new Date().toISOString(),
      kpis: {
        TOTAL_MINERADORAS_MONITORADAS: mineradoras.length,
        TOTAL_TORRES_MONITORADAS: totalTorres,
        TORRES_ATENCAO: 0,
        TORRES_CRITICAS: 0,
        ALERTAS_HOJE: 0,
        ALERTAS_ONTEM: 0,
      },
      mineradoras: mineradoras,
      status_torres: [],
      status_pcs: [],
      processos_destaque: [],
    };
  }
}

async function carregarAlertasDiarios() {
  try {
    return await mineradoraModel.buscarJson("alertas_diarios.json");
  } catch (erro) {
    console.warn(
      "Gold de alertas diários indisponível:",
      erro && erro.message ? erro.message : erro,
    );
    return [];
  }
}

async function dashboardMineradoras(req, res) {
  try {
    var agora = new Date();
    var hoje = referenciaLocal(agora);
    var periodoResolvido = resolverPeriodo(req.query.periodo, hoje);
    var resultados = await Promise.all([
      carregarDashboardMineradoras(),
      carregarAlertasDiarios(),
    ]);
    var dashboard = resultados[0] || {};
    var alertasDiarios = resultados[1] || [];
    var escopo = null;
    if (req.session.CARGO_USUARIO === "Operador") {
      var acessos = await torresModel.listarTorresPorUsuario(
        req.session.ID_USUARIO, req.session.FK_EMPRESA_USUARIO,
      );
      escopo = filtrarDashboard(dashboard, alertasDiarios, acessos);
      dashboard = escopo.dashboard;
      alertasDiarios = escopo.alertasDiarios;
    }
    var modo = req.query.modo === "por_torre" ? "por_torre" : "total";
    var mineradoras = adicionarDetalhes(
      dashboard.mineradoras || [],
      dashboard.status_torres || [],
    );

    return res.status(200).json({
      atualizado_em: dashboard.atualizado_em || null,
      mensagem: escopo ? escopo.mensagem : "",
      kpis: dashboard.kpis || {},
      mineradoras: mineradoras,
      status_torres: dashboard.status_torres || [],
      status_pcs: dashboard.status_pcs || [],
      processos_destaque: dashboard.processos_destaque || [],
      alertas_diarios: alertasDiarios,
      grafico_alertas: construirGrafico(alertasDiarios, escopo ? escopo.mineradorasGrafico : mineradoras, periodoResolvido, modo),
      filtros: {
        periodo: periodoResolvido.dias,
        periodo_selecionado: periodoResolvido.selecionado,
        periodo_rotulo: periodoResolvido.rotulo,
        modo: modo,
      },
    });
  } catch (erro) {
    console.error(
      "Erro ao carregar dashboard de mineradoras:",
      erro && erro.message ? erro.message : erro,
    );
    return res.status(500).json({
      mensagem: "Erro ao carregar dados do dashboard.",
    });
  }
}

function visaoExecutiva(req, res) {
  var dashboard = lerJson("dashboard.json", {});
  return res.status(200).json(dashboard);
}

module.exports = {
  dashboardMineradoras,
  visaoExecutiva,
  adicionarDetalhes,
};
