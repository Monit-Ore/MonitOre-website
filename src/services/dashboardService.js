const LIMITE_PONTOS = 300;
const CHAVES = ["cpu", "ram", "disco"];
const CAMPOS_METADADO = ["label", "cor", "corLimite", "alerta", "critico"];

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function chaveComponente(nome) {
  const texto = normalizarTexto(nome);

  if (texto.includes("CPU")) return "cpu";
  if (texto.includes("RAM") || texto.includes("MEM")) return "ram";
  if (texto.includes("DISCO") || texto.includes("DISK")) return "disco";

  return null;
}

function nivelStatus(valor) {
  const texto = normalizarTexto(valor);

  if (texto.includes("CRIT")) return 3;
  if (texto.includes("ALERT") || texto.includes("ATEN")) return 2;
  if (texto.includes("NORMAL")) return 1;

  return 0;
}

function granularidadeDe(duracaoMs) {
  if (duracaoMs <= 60 * 60 * 1000) return { nome: "bruto", largura: 0 };
  if (duracaoMs <= 24 * 60 * 60 * 1000) return { nome: "5min", largura: 5 * 60 * 1000 };
  if (duracaoMs <= 7 * 24 * 60 * 60 * 1000) return { nome: "1h", largura: 60 * 60 * 1000 };
  return { nome: "1dia", largura: 24 * 60 * 60 * 1000 };
}

function horaUtc(timestamp) {
  return new Date(timestamp).toISOString().slice(11, 16);
}

function dataIso(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dataBr(timestamp) {
  const iso = dataIso(timestamp);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? Math.round(convertido * 100) / 100 : null;
}

function metadadosDe(registro) {
  const origem = registro?.componentes || {};
  const resultado = {};

  CHAVES.forEach((chave) => {
    const item = origem[chave];
    if (!item || typeof item !== "object") return;

    resultado[chave] = {};
    CAMPOS_METADADO.forEach((campo) => {
      if (item[campo] !== undefined) resultado[chave][campo] = item[campo];
    });
  });

  return resultado;
}

function agrupar(registros, inicioMs, fimMs) {
  const { nome, largura } = granularidadeDe(fimMs - inicioMs);
  const janelas = new Map();

  registros.forEach((registro) => {
    const timestamp = Date.parse(registro?.capturadoEm);
    if (Number.isNaN(timestamp) || timestamp < inicioMs || timestamp > fimMs) return;

    const inicioJanela = largura === 0
      ? timestamp
      : Math.floor(timestamp / largura) * largura;

    if (!janelas.has(inicioJanela)) {
      janelas.set(inicioJanela, {
        timestamp: inicioJanela,
        fim: inicioJanela + (largura || 1),
        totalAmostras: 0,
        componentes: new Map(),
      });
    }

    const janela = janelas.get(inicioJanela);
    janela.totalAmostras += 1;

    const componentes = registro.componentesMonitorados;
    if (!Array.isArray(componentes)) return;

    componentes.forEach((item) => {
      const chave = chaveComponente(item.componente);
      if (!chave) return;

      const valor = numero(item.valor);
      if (!janela.componentes.has(chave)) {
        janela.componentes.set(chave, {
          soma: 0,
          quantidade: 0,
          maximo: null,
          horaMaximo: null,
          piorStatus: "sem dados",
          nivel: 0,
        });
      }

      const acumulado = janela.componentes.get(chave);
      if (valor !== null) {
        acumulado.soma += valor;
        acumulado.quantidade += 1;
        if (acumulado.maximo === null || valor > acumulado.maximo) {
          acumulado.maximo = valor;
          acumulado.horaMaximo = horaUtc(timestamp);
        }
      }

      const nivel = nivelStatus(item.status);
      if (nivel > acumulado.nivel) {
        acumulado.nivel = nivel;
        acumulado.piorStatus = item.status;
      }
    });
  });

  return { nome, janelas: [...janelas.values()].sort((a, b) => a.timestamp - b.timestamp) };
}

function converterComponentes(janelas, metadados = {}, granularidade = "") {
  const resultado = {};

  CHAVES.forEach((chave) => {
    resultado[chave] = {
      label: metadados[chave]?.label ?? chave.toUpperCase(),
      serie: [],
      pico: [],
      horaPico: [],
      amostras: []
    };

    CAMPOS_METADADO.filter((campo) => campo !== "label").forEach((campo) => {
      if (metadados[chave]?.[campo] !== undefined) {
        resultado[chave][campo] = metadados[chave][campo];
      }
    });
  });

  janelas.forEach((janela) => {
    CHAVES.forEach((chave) => {
      const acumulado = janela.componentes.get(chave);
      const destino = resultado[chave];

      destino.serie.push(
        acumulado && acumulado.quantidade
          ? numero(acumulado.soma / acumulado.quantidade)
          : null,
      );
      destino.pico.push(acumulado ? acumulado.maximo : null);
      destino.horaPico.push(acumulado ? acumulado.horaMaximo : null);
      destino.amostras.push(acumulado ? acumulado.quantidade : 0);
    });
  });

  return resultado;
}

function janelasPorHora(janelas, metadados, granularidade) {
  const horas = new Map();

  janelas.forEach((janela) => {
    const hora = horaUtc(janela.timestamp).slice(0, 2);
    if (!horas.has(hora)) horas.set(hora, []);
    horas.get(hora).push(janela);
  });

  const resultado = {};
  horas.forEach((lista, hora) => {
    resultado[hora] = {
      horarios: lista.map((janela) => horaUtc(janela.timestamp)),
      horas: [hora],
      componentes: converterComponentes(lista, metadados, granularidade),
      granularidade,
      inicio: new Date(lista[0].timestamp).toISOString(),
      fim: new Date(lista[lista.length - 1].fim).toISOString(),
      totalAmostras: lista.reduce((total, janela) => total + janela.totalAmostras, 0)
    };
  });

  return resultado;
}

function montarHistorico(janelas, mineradora, metadados) {
  const linhas = [];

  janelas.forEach((janela) => {
    janela.componentes.forEach((acumulado, chave) => {
      if (acumulado.nivel < 2) return;

      linhas.push({
        timestamp: janela.timestamp,
        dataHora: `${dataBr(janela.timestamp)} ${horaUtc(janela.timestamp)}`,
        mineradora: mineradora ?? "",
        componente: (metadados[chave]?.label ?? chave).toUpperCase(),
        valor: acumulado.maximo,
        alerta: metadados[chave]?.alerta ?? null,
        critico: metadados[chave]?.critico ?? null,
        status: acumulado.piorStatus
      });
    });
  });

  return linhas
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ timestamp, ...linha }) => linha);
}

// Conta, por componente, quantas capturas do dia estão em alerta/crítico.
// O dia é o do arquivo mais recente (capturadoEm), não o filtro da dashboard.
function contarAlertasDoDia(registros, base = {}, diaIso = "") {
  const totais = { cpu: 0, ram: 0, disco: 0 };
  const dia = diaIso || dataIso(Date.now());

  (Array.isArray(registros) ? registros : []).forEach((registro) => {
    const componentes = Array.isArray(registro?.componentesMonitorados)
      ? registro.componentesMonitorados
      : [];

    CHAVES.forEach((chave) => {
      const item = componentes.find(
        (componente) => chaveComponente(componente?.componente) === chave,
      );
      if (nivelStatus(item?.status) >= 2) totais[chave] += 1;
    });
  });

  return {
    dataIso: dia,
    data: dataBr(`${dia}T00:00:00.000Z`),
    totais: CHAVES.map((chave) => totais[chave]),
    ...(Array.isArray(base?.limites) ? { limites: base.limites } : {}),
    ...(base?.cor ? { cor: base.cor } : {}),
    periodo: "dia do arquivo mais recente",
    inicio: `${dia}T00:00:00.000Z`,
    fim: `${dia}T23:59:59.999Z`,
  };
}

function agregarDashboard(registros, inicio, fim) {
  const inicioMs = Date.parse(inicio);
  const fimMs = Date.parse(fim);
  const { nome, janelas } = agrupar(registros, inicioMs, fimMs);
  const metadados = metadadosDe(
    registros.find((item) => item?.capturadoEm && !Number.isNaN(Date.parse(item.capturadoEm)))
  );

  let truncado = false;
  let janelasExibidas = janelas;

  if (janelas.length > LIMITE_PONTOS) {
    truncado = true;
    const passo = Math.ceil(janelas.length / LIMITE_PONTOS);
    janelasExibidas = janelas.filter((_, indice) => indice % passo === 0);
  }

  const primeiro = registros.find(
    (item) => item?.capturadoEm && !Number.isNaN(Date.parse(item.capturadoEm))
  );
  const mineradora = primeiro?.torre?.mineradora ?? "";
  const porDia = new Map();

  janelasExibidas.forEach((janela) => {
    const chave = dataIso(janela.timestamp);
    if (!porDia.has(chave)) porDia.set(chave, []);
    porDia.get(chave).push(janela);
  });

  const desempenhoPorDia = [...porDia.entries()].map(([iso, lista]) => ({
    data: dataBr(lista[0].timestamp),
    dataIso: iso,
    horarios: lista.map((janela) => horaUtc(janela.timestamp)),
    horas: [...new Set(lista.map((janela) => horaUtc(janela.timestamp).slice(0, 2)))],
    janelasPorHora: janelasPorHora(lista, metadados, nome),
    componentes: converterComponentes(lista, metadados, nome),
    granularidade: nome,
    exemplo: false,
    inicio: new Date(lista[0].timestamp).toISOString(),
    fim: new Date(lista[lista.length - 1].fim).toISOString(),
    totalAmostras: lista.reduce((total, janela) => total + janela.totalAmostras, 0)
  }));

  const datas = desempenhoPorDia.map((dia) => dia.data);
  const serieAlertas = { cpu: [], ram: [], disco: [] };
  const totaisAlertas = { cpu: 0, ram: 0, disco: 0 };

  janelasExibidas.forEach((janela) => {
    CHAVES.forEach((chave) => {
      if ((janela.componentes.get(chave)?.nivel ?? 0) >= 2) totaisAlertas[chave] += 1;
    });
  });

  desempenhoPorDia.forEach((dia) => {
    const janelasDoDia = porDia.get(dia.dataIso) ?? [];

    CHAVES.forEach((chave) => {
      serieAlertas[chave].push(
        janelasDoDia.filter((janela) => (janela.componentes.get(chave)?.nivel ?? 0) >= 2).length,
      );
    });
  });

  const ultimoTimestamp = janelasExibidas.length
    ? janelasExibidas[janelasExibidas.length - 1].timestamp
    : null;

  return {
    geradoEm: ultimoTimestamp ? new Date(ultimoTimestamp).toISOString() : null,
    identificador: primeiro?.identificador ?? null,
    hostname: primeiro?.hostname ?? primeiro?.torre?.hostname ?? null,
    torre: primeiro?.torre ?? null,
    horarios: janelasExibidas.map((janela) => horaUtc(janela.timestamp)),
    componentes: converterComponentes(janelasExibidas, metadados, nome),
    desempenhoPorDia,
    barrasAlertas: {
      totais: CHAVES.map((chave) => totaisAlertas[chave]),
      ...(Array.isArray(primeiro?.barrasAlertas?.limites)
        ? { limites: primeiro.barrasAlertas.limites }
        : {}),
      periodo: `${dataBr(inicioMs)} a ${dataBr(fimMs)}`,
      inicio: new Date(inicioMs).toISOString(),
      fim: new Date(fimMs).toISOString()
    },
    alertasDiarios: {
      datas,
      exemplo: datas.map(() => false),
      serie: serieAlertas,
      ...(primeiro?.alertasDiarios?.limites
        ? { limites: primeiro.alertasDiarios.limites }
        : {}),
      ...(primeiro?.alertasDiarios?.cores
        ? { cores: primeiro.alertasDiarios.cores }
        : {})
    },
    historico: montarHistorico(janelasExibidas, mineradora, metadados),
    granularidade: nome,
    truncado
  };
}

module.exports = { agregarDashboard, contarAlertasDoDia };
