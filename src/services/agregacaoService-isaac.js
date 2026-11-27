/**
 * Serviço de Agregação de Métricas e Processos
 * MonitOre - Beeling (Isaac)
 */

const FORMATADOR_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatarHoraSp(data) {
  if (!data) return "--:--";
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return "--:--";
  return FORMATADOR_HORA_SP.format(d);
}

const CONFIG_JANELAS = {
  "24h": { minutosJanela: 1440, minutosBucket: 10 },
  "12h": { minutosJanela: 720, minutosBucket: 5 },
  "6h":  { minutosJanela: 360, minutosBucket: 2 }
};

const CONFIG_HORIZONTES = {
  "2h": 120,
  "6h": 360,
  "24h": 1440
};

/**
 * Retorna as configurações de tempo para histórico e horizonte.
 */
function obterConfiguracaoJanela(historico = "24h", horizonte = "6h") {
  const cfgHistorico = CONFIG_JANELAS[historico] || CONFIG_JANELAS["24h"];
  const minutosHorizonte = CONFIG_HORIZONTES[horizonte] || CONFIG_HORIZONTES["6h"];

  return {
    historico,
    horizonte,
    minutosJanela: cfgHistorico.minutosJanela,
    minutosBucket: cfgHistorico.minutosBucket,
    minutosHorizonte
  };
}

/**
 * Agrega leituras de hardware em buckets temporais regulares.
 * 
 * @param {Array<Object>} leituras - Leituras ordenadas cronologicamente
 * @param {number} minutosJanela - Tamanho da janela em minutos
 * @param {number} minutosBucket - Tamanho de cada bucket em minutos
 * @returns {{ buckets: Array, resumo: Object }}
 */
function agregarHardware(leituras, minutosJanela, minutosBucket) {
  if (!leituras || leituras.length === 0) {
    return {
      buckets: [],
      resumo: null
    };
  }

  const ultimaLeitura = leituras[leituras.length - 1];
  const dataFim = ultimaLeitura.dataHora instanceof Date ? ultimaLeitura.dataHora : new Date(ultimaLeitura.dataHora);
  const dataInicio = new Date(dataFim.getTime() - minutosJanela * 60000);

  // Filtra leituras dentro da janela solicitada
  const leiturasJanela = leituras.filter(l => {
    const d = l.dataHora instanceof Date ? l.dataHora : new Date(l.dataHora);
    return d >= dataInicio && d <= dataFim;
  });

  const baseLeituras = leiturasJanela.length > 0 ? leiturasJanela : leituras;

  const tempoInicioMs = (leiturasJanela.length > 0 ? dataInicio : baseLeituras[0].dataHora).getTime();
  const bucketMs = minutosBucket * 60000;

  const mapaBuckets = new Map();

  for (const l of baseLeituras) {
    const lData = l.dataHora instanceof Date ? l.dataHora : new Date(l.dataHora);
    const offset = lData.getTime() - tempoInicioMs;
    const indiceBucket = Math.max(0, Math.floor(offset / bucketMs));

    if (!mapaBuckets.has(indiceBucket)) {
      mapaBuckets.set(indiceBucket, {
        indice: indiceBucket,
        timestampReferencia: new Date(tempoInicioMs + (indiceBucket + 1) * bucketMs),
        cpus: [],
        rams: [],
        discos: [],
        processos: []
      });
    }

    const b = mapaBuckets.get(indiceBucket);
    if (typeof l.cpuTotalPct === "number") b.cpus.push(l.cpuTotalPct);
    if (typeof l.ramTotalPct === "number") b.rams.push(l.ramTotalPct);
    if (typeof l.discoTotalPct === "number") b.discos.push(l.discoTotalPct);
    if (typeof l.qtdProcessos === "number") b.processos.push(l.qtdProcessos);
  }

  // Gera lista ordenada de buckets consolidados
  const indicesOrdenados = Array.from(mapaBuckets.keys()).sort((a, b) => a - b);
  const buckets = [];

  for (const idx of indicesOrdenados) {
    const b = mapaBuckets.get(idx);
    const media = arr => (arr.length ? arr.reduce((acc, v) => acc + v, 0) / arr.length : null);

    // Formatação de fuso horário estritamente em America/Sao_Paulo
    const labelHora = formatarHoraSp(b.timestampReferencia);

    buckets.push({
      indice: idx,
      dataHora: b.timestampReferencia,
      label: labelHora,
      cpu: media(b.cpus),
      ram: media(b.rams),
      disco: media(b.discos),
      qtdProcessos: Math.round(media(b.processos) || 0)
    });
  }

  // Estatísticas do período
  const todasCpus = baseLeituras.map(l => l.cpuTotalPct).filter(v => typeof v === "number");
  const todasRams = baseLeituras.map(l => l.ramTotalPct).filter(v => typeof v === "number");
  const todosDiscos = baseLeituras.map(l => l.discoTotalPct).filter(v => typeof v === "number");
  const todosProcessos = baseLeituras.map(l => l.qtdProcessos).filter(v => typeof v === "number");

  const mediaGeral = arr => arr.length ? Math.round((arr.reduce((acc, v) => acc + v, 0) / arr.length) * 10) / 10 : 0;
  const picoGeral = arr => arr.length ? Math.round(Math.max(...arr) * 10) / 10 : 0;

  const resumo = {
    ultimaLeitura,
    processos: {
      atual: ultimaLeitura.qtdProcessos || 0,
      media: Math.round(mediaGeral(todosProcessos)),
      pico: picoGeral(todosProcessos),
      variacaoPct: mediaGeral(todosProcessos) > 0
        ? Math.round((((ultimaLeitura.qtdProcessos || 0) - mediaGeral(todosProcessos)) / mediaGeral(todosProcessos)) * 1000) / 10
        : 0
    },
    cpu: {
      atual: Math.round((ultimaLeitura.cpuTotalPct || 0) * 10) / 10,
      media: mediaGeral(todasCpus),
      pico: picoGeral(todasCpus)
    },
    ram: {
      atual: Math.round((ultimaLeitura.ramTotalPct || 0) * 10) / 10,
      media: mediaGeral(todasRams),
      pico: picoGeral(todasRams),
      usadoMb: ultimaLeitura.ramTotalMb || null,
      usadoGb: ultimaLeitura.ramTotalMb ? Math.round((ultimaLeitura.ramTotalMb / 1024) * 10) / 10 : null,
      totalGb: (ultimaLeitura.ramTotalMb && ultimaLeitura.ramTotalPct > 0)
        ? Math.round((ultimaLeitura.ramTotalMb / (ultimaLeitura.ramTotalPct / 100) / 1024) * 10) / 10
        : null
    },
    disco: {
      atual: Math.round((ultimaLeitura.discoTotalPct || 0) * 10) / 10,
      media: mediaGeral(todosDiscos),
      pico: picoGeral(todosDiscos),
      usadoGb: null,
      totalGb: null
    }
  };

  return { buckets, resumo };
}

/**
 * Agrupamento de processos por nome (individual) - mantido para compatibilidade e testes
 */
function agregarProcessos(leiturasProcessos) {
  if (!leiturasProcessos || leiturasProcessos.length === 0) {
    return [];
  }

  const rodadas = Array.from(new Set(leiturasProcessos.map(p => p.rodada))).sort((a, b) => a - b);
  const ultimaRodada = rodadas[rodadas.length - 1];

  const leiturasUltima = leiturasProcessos.filter(p => p.rodada === ultimaRodada);

  const metade = Math.floor(rodadas.length / 2);
  const rodadasPrimeiraMetade = new Set(rodadas.slice(0, metade));
  const rodadasSegundaMetade = new Set(rodadas.slice(metade));

  const cpusPrimeiraMetade = new Map();
  const cpusSegundaMetade = new Map();

  for (const p of leiturasProcessos) {
    const nome = p.processo;
    const cpu = p.procCpuGlobalPct || 0;

    if (rodadasPrimeiraMetade.has(p.rodada)) {
      if (!cpusPrimeiraMetade.has(nome)) cpusPrimeiraMetade.set(nome, []);
      cpusPrimeiraMetade.get(nome).push(cpu);
    } else if (rodadasSegundaMetade.has(p.rodada)) {
      if (!cpusSegundaMetade.has(nome)) cpusSegundaMetade.set(nome, []);
      cpusSegundaMetade.get(nome).push(cpu);
    }
  }

  const mapaProcessos = new Map();

  for (const p of leiturasUltima) {
    const nome = p.processo;
    if (!mapaProcessos.has(nome)) {
      mapaProcessos.set(nome, {
        nome,
        pids: new Set(),
        cpu: 0,
        ramMb: 0
      });
    }

    const reg = mapaProcessos.get(nome);
    if (p.pid) reg.pids.add(p.pid);
    reg.cpu += p.procCpuGlobalPct || 0;
    reg.ramMb += p.procRamMb || 0;
  }

  const resultado = [];

  for (const [nome, reg] of mapaProcessos.entries()) {
    const cpus1 = cpusPrimeiraMetade.get(nome) || [];
    const cpus2 = cpusSegundaMetade.get(nome) || [];

    const media1 = cpus1.length ? cpus1.reduce((a, b) => a + b, 0) / cpus1.length : 0;
    const media2 = cpus2.length ? cpus2.reduce((a, b) => a + b, 0) / cpus2.length : 0;

    let tendencia = "estavel";
    if (media1 === 0 && media2 > 0) {
      tendencia = "crescimento";
    } else if (media1 > 0) {
      const variacao = (media2 - media1) / media1;
      if (variacao > 0.10) {
        tendencia = "crescimento";
      } else if (variacao < -0.10) {
        tendencia = "queda";
      }
    }

    resultado.push({
      nome,
      instancias: reg.pids.size || 1,
      cpu: Math.round(reg.cpu * 10) / 10,
      ramGb: Math.round((reg.ramMb / 1024) * 10) / 10,
      tendencia
    });
  }

  resultado.sort((a, b) => b.cpu - a.cpu);
  return resultado;
}

/**
 * Definição dos grupos de processos conforme Figma
 */
const DEFINICAO_GRUPOS = [
  {
    id: "mysql",
    regex: /mysql/i,
    nome: "mysqld",
    descricao: "Banco de dados",
    icone: "fa-database"
  },
  {
    id: "java",
    regex: /^java/i,
    nome: "Java · motor de extração",
    descricao: "Processamento",
    icone: "fa-gears"
  },
  {
    id: "docker",
    regex: /docker|containerd/i,
    nome: "Containers Docker",
    descricao: "Serviços de integração",
    icone: "fa-box"
  },
  {
    id: "demais",
    regex: /.*/,
    nome: "Demais processos",
    descricao: "Sistema e aplicações",
    icone: "fa-layer-group"
  }
];

function identificarGrupo(nomeProcesso) {
  const nomeLimpo = (nomeProcesso || "").trim();
  for (const g of DEFINICAO_GRUPOS) {
    if (g.regex.test(nomeLimpo)) {
      return g;
    }
  }
  return DEFINICAO_GRUPOS[3]; // Demais processos
}

/**
 * Agrupa processos por grupos de aplicação (tabela do Figma)
 * 
 * Saída: Array<{ id, nome, descricao, icone, instancias, cpu, ramGb, discoMbs, tendencia }>
 */
function agregarProcessosPorGrupo(leiturasProcessos) {
  if (!leiturasProcessos || leiturasProcessos.length === 0) {
    return [];
  }

  // Identifica rodadas ordenadas
  const rodadasSet = new Set();
  for (const p of leiturasProcessos) {
    if (typeof p.rodada === "number" && !isNaN(p.rodada)) {
      rodadasSet.add(p.rodada);
    }
  }

  const rodadas = Array.from(rodadasSet).sort((a, b) => a - b);
  if (rodadas.length === 0) return [];

  const ultimaRodada = rodadas[rodadas.length - 1];

  // Partição de rodadas em duas metades para tendência
  const metade = Math.floor(rodadas.length / 2);
  const rodadas1 = new Set(rodadas.slice(0, metade));
  const rodadas2 = new Set(rodadas.slice(metade));

  // Mapa de leituras por grupo e por rodada
  // cpuPorGrupoERodada[grupoId][rodada] = somaCpu
  const cpuPorGrupoERodada = {};
  for (const g of DEFINICAO_GRUPOS) {
    cpuPorGrupoERodada[g.id] = {};
  }

  for (const p of leiturasProcessos) {
    const grupo = identificarGrupo(p.processo);
    const rod = p.rodada;
    const cpu = p.procCpuGlobalPct || 0;

    if (!cpuPorGrupoERodada[grupo.id][rod]) {
      cpuPorGrupoERodada[grupo.id][rod] = 0;
    }
    cpuPorGrupoERodada[grupo.id][rod] += cpu;
  }

  // Consolidação da última rodada para cada grupo
  const leiturasUltima = leiturasProcessos.filter(p => p.rodada === ultimaRodada);

  const dadosUltimaGrupo = {};
  for (const g of DEFINICAO_GRUPOS) {
    dadosUltimaGrupo[g.id] = {
      pids: new Set(),
      somaCpu: 0,
      somaRamMb: 0,
      somaDiscoIo: 0,
      temDiscoIo: false
    };
  }

  for (const p of leiturasUltima) {
    const grupo = identificarGrupo(p.processo);
    const reg = dadosUltimaGrupo[grupo.id];

    if (p.pid !== null && p.pid !== undefined) {
      reg.pids.add(p.pid);
    } else {
      reg.pids.add(p.processo); // fallback se pid ausente
    }

    reg.somaCpu += p.procCpuGlobalPct || 0;
    reg.somaRamMb += p.procRamMb || 0;

    if (p.procDiscoIoMbs !== null && p.procDiscoIoMbs !== undefined) {
      reg.somaDiscoIo += p.procDiscoIoMbs;
      reg.temDiscoIo = true;
    }
  }

  const gruposResultado = [];

  for (const g of DEFINICAO_GRUPOS) {
    const dadosUlt = dadosUltimaGrupo[g.id];
    const instancias = dadosUlt.pids.size;

    // Se o grupo não tem nenhum processo ativo na última rodada, não lista na tabela
    if (instancias === 0) continue;

    // Cálculo da tendência
    let tendencia = "estavel";
    if (rodadas.length >= 2 && metade > 0) {
      const cpus1 = [];
      const cpus2 = [];

      for (const r of rodadas) {
        const cpuRod = cpuPorGrupoERodada[g.id][r] || 0;
        if (rodadas1.has(r)) cpus1.push(cpuRod);
        else if (rodadas2.has(r)) cpus2.push(cpuRod);
      }

      const media1 = cpus1.length ? cpus1.reduce((a, b) => a + b, 0) / cpus1.length : 0;
      const media2 = cpus2.length ? cpus2.reduce((a, b) => a + b, 0) / cpus2.length : 0;

      if (media1 === 0 && media2 > 0) {
        tendencia = "crescimento";
      } else if (media1 > 0) {
        const delta = (media2 - media1) / media1;
        if (delta > 0.10) {
          tendencia = "crescimento";
        } else if (delta < -0.10) {
          tendencia = "queda";
        }
      }
    }

    const cpuFinal = Math.round(dadosUlt.somaCpu * 10) / 10;
    const ramGbFinal = Math.round((dadosUlt.somaRamMb / 1024) * 10) / 10;
    const discoFinal = dadosUlt.temDiscoIo ? Math.round(dadosUlt.somaDiscoIo * 10) / 10 : null;

    gruposResultado.push({
      id: g.id,
      nome: g.nome,
      descricao: g.descricao,
      icone: g.icone,
      instancias: instancias,
      cpu: cpuFinal,
      ramGb: ramGbFinal,
      discoMbs: discoFinal,
      tendencia: tendencia
    });
  }

  // Ordena por CPU decrescente por padrão
  gruposResultado.sort((a, b) => b.cpu - a.cpu);
  return gruposResultado;
}

/**
 * Calcula status do KPI conforme limites de alerta.
 */
function calcularStatusLimite(valor, limiteAtencao, limiteCritico) {
  if (valor >= limiteCritico) return "critico";
  if (valor >= limiteAtencao) return "atencao";
  return "normal";
}

module.exports = {
  obterConfiguracaoJanela,
  agregarHardware,
  agregarProcessos,
  agregarProcessosPorGrupo,
  calcularStatusLimite,
  formatarHoraSp,
  CONFIG_JANELAS,
  CONFIG_HORIZONTES
};
