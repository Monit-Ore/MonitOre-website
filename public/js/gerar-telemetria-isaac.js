#!/usr/bin/env node
/**
 * MonitOre - Gerador de telemetria sintética (sem dependências)
 *
 * Gera CSVs no MESMO layout que o pipeline produz (tratamento.py):
 *   <dd-MM-yyyy_HH-mm-ss>_HISTORICO_HARDWARE.csv   (14 colunas, lido também pelo LeitorSilver.java)
 *   <dd-MM-yyyy_HH-mm-ss>_HISTORICO_PROCESSOS.csv
 * para os 20 PCs industriais cadastrados em monitore_V5.sql, cada um com um
 * "cenário" diferente para exercitar todos os estados da dashboard preditiva.
 *
 * USO (na raiz do projeto, ex.: MonitOre-website/scripts/gerar-telemetria.js):
 *   node scripts/gerar-telemetria.js                      # 24h de histórico terminando agora
 *   node scripts/gerar-telemetria.js --ao-vivo            # continua enviando 1 rodada por intervalo
 *   node scripts/gerar-telemetria.js --horas 48 --intervalo 30 --seed 7
 *   node scripts/gerar-telemetria.js --cenario PC-CSN-01=ram_critica --cenario PC-NEXA-01=sem_dados
 *   node scripts/gerar-telemetria.js --listar             # só mostra os cenários disponíveis
 *
 * Depois, no .env.dev:  PREDITIVA_PASTA_CSV=./fixtures/telemetria
 */

var fs = require("fs");
var path = require("path");

// ============================================================================
// 1. CADASTRO (espelho de monitore_V5.sql: PC_Industrial -> torre -> empresa)
// ============================================================================
var MINERADORAS = [
  "Vale S.A.", "CSN Mineracao S.A.", "Samarco Mineracao S.A.",
  "Anglo American Minerio de Ferro Brasil S.A.", "Gerdau Acos Longos S.A.",
  "Mineracao Usiminas S.A.", "Companhia Brasileira de Metalurgia e Mineracao",
  "Nexa Recursos Minerais S.A.", "Mineracao Rio do Norte S.A.", "ArcelorMittal Brasil S.A."
];
var SIGLAS = ["Vale", "CSN", "Samarco", "Anglo", "Gerdau", "Usiminas", "CBMM", "Nexa", "MRN", "ArcelorMittal"];
var HOSTS = ["VALE", "CSN", "SAMARCO", "ANGLO", "GERDAU", "USIMINAS", "CBMM", "NEXA", "MRN", "ARCELOR"];

function montarPcs() {
  var pcs = [];
  for (var i = 0; i < 20; i++) {
    var m = Math.floor(i / 2);
    var n = "0" + ((i % 2) + 1);
    pcs.push({
      idPc: i + 1,
      idTorre: i + 1,
      hostname: "PC-" + HOSTS[m] + "-" + n,
      codigoTorre: "Torre-" + SIGLAS[m] + "-" + n,
      nomeTorre: "Torre " + SIGLAS[m] + " " + n,
      mineradora: MINERADORAS[m]
    });
  }
  return pcs;
}

// ============================================================================
// 2. CENÁRIOS
// valor(h) = agora + slope * max(h, -desde)   (h = horas relativas ao "agora" T0)
// ============================================================================
var CENARIOS = {
  estavel: {
    descricao: "Operação normal, sem tendência",
    cpu: { agora: 45, slope: 0, desde: 0, amp: 1.5 },
    ram: { agora: 58, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 52, slope: 0.02, desde: 24, amp: 0 },
    culpado: null
  },
  cpu_subindo: {
    descricao: "CPU em alta: cruza o limite de atenção nas próximas horas",
    cpu: { agora: 70, slope: 2.5, desde: 14, amp: 0 },
    ram: { agora: 60, slope: 0, desde: 0, amp: 0 },
    disco: { agora: 55, slope: 0.02, desde: 24, amp: 0 },
    culpado: "java-extracao"
  },
  ram_critica: {
    descricao: "Vazamento de memória: RAM já acima da atenção, caminhando para crítico",
    cpu: { agora: 48, slope: 0, desde: 0, amp: 1.5 },
    ram: { agora: 86, slope: 0.9, desde: 12, amp: 0 },
    disco: { agora: 58, slope: 0.02, desde: 24, amp: 0 },
    culpado: "mysqld"
  },
  disco_enchendo: {
    descricao: "Logs crescendo: disco enche rápido (atenção só aparece com horizonte de 24h)",
    cpu: { agora: 40, slope: 0, desde: 0, amp: 1.5 },
    ram: { agora: 55, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 71, slope: 1.2, desde: 24, amp: 0 },
    culpado: "scada-supervisorio"
  },
  pico_intermitente: {
    descricao: "Rajadas de CPU a cada 3h (frenagens de emergência/ciclos de içamento)",
    cpu: { agora: 50, slope: 0, desde: 0, amp: 0 },
    ram: { agora: 62, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 50, slope: 0.02, desde: 24, amp: 0 },
    culpado: null,
    rajada: { periodoMin: 180, duracaoMin: 18, altura: 38 }
  },
  offline: {
    descricao: "Parou de enviar telemetria há 3h",
    cpu: { agora: 44, slope: 0, desde: 0, amp: 1.5 },
    ram: { agora: 57, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 51, slope: 0.02, desde: 24, amp: 0 },
    culpado: null,
    paraHaHoras: 3
  },
  sem_dados: {
    descricao: "Nenhuma captura enviada (tela 'torre sem dados')",
    cpu: { agora: 0, slope: 0, desde: 0, amp: 0 },
    ram: { agora: 0, slope: 0, desde: 0, amp: 0 },
    disco: { agora: 0, slope: 0, desde: 0, amp: 0 },
    culpado: null,
    semDados: true
  }
};

// PCs 1..7 ficam fixos para facilitar a demonstração; o resto varia de forma determinística
var CENARIOS_FIXOS = [
  "cpu_subindo",       // PC-VALE-01
  "ram_critica",       // PC-VALE-02
  "estavel",           // PC-CSN-01
  "disco_enchendo",    // PC-CSN-02
  "pico_intermitente", // PC-SAMARCO-01
  "offline",           // PC-SAMARCO-02
  "sem_dados"          // PC-ANGLO-01
];
var CENARIOS_RESTO = ["estavel", "estavel", "cpu_subindo", "estavel", "ram_critica", "estavel", "disco_enchendo", "estavel"];

// Processos típicos de um PC supervisor: [nome, fatiaCpu, fatiaRam, instânciasMin, instânciasMax]
var PROCESSOS = [
  ["mysqld", 0.22, 0.20, 1, 1],
  ["java-extracao", 0.26, 0.24, 1, 3],
  ["dockerd", 0.08, 0.10, 1, 2],
  ["node", 0.07, 0.06, 1, 1],
  ["python-captura", 0.05, 0.03, 1, 1],
  ["scada-supervisorio", 0.15, 0.14, 1, 2],
  ["svchost.exe", 0.10, 0.15, 3, 5],
  ["System", 0.07, 0.08, 1, 1]
];

// ============================================================================
// 3. UTILITÁRIOS DETERMINÍSTICOS
// ============================================================================
function hashStr(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído ~N(0,1) determinístico por (seed, chave, índice) */
function ruido(seed, chave, k) {
  var r = mulberry32(hashStr(seed + "|" + chave + "|" + k));
  return (r() + r() + r() + r() - 2) * 1.7;
}

function limitar(v, min, max) { return Math.max(min, Math.min(max, v)); }
function arred(v, casas) { var f = Math.pow(10, casas); return Math.round(v * f) / f; }
function pad(n) { return String(n).padStart(2, "0"); }
function fmtData(d) { return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
function fmtHora(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
function fmtNomeArquivo(d) {
  return pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + d.getFullYear() + "_" +
    pad(d.getHours()) + "-" + pad(d.getMinutes()) + "-" + pad(d.getSeconds());
}

// ============================================================================
// 4. MODELO DE SÉRIE: valor de cada métrica de um PC em um instante
// ============================================================================
function valorTendencia(cfg, h) {
  return cfg.agora + cfg.slope * Math.max(h, -cfg.desde);
}

function fatorDiurno(d) {
  // pico de carga ~14h, vale ~02h
  var hora = d.getHours() + d.getMinutes() / 60;
  return Math.sin(((hora - 8) / 24) * 2 * Math.PI);
}

function amostrar(pc, cen, estado, t, k) {
  var d = new Date(t);
  var h = (t - estado.t0) / 3600000;
  var fase1 = (hashStr(pc.hostname) % 628) / 100;
  var fase2 = (hashStr(pc.hostname + "x") % 628) / 100;
  var minutos = t / 60000;
  var lenta = Math.sin((minutos / 47) * 2 * Math.PI + fase1) * 1.6 +
    Math.sin((minutos / 13) * 2 * Math.PI + fase2) * 1.1;

  // CPU
  var cpu = valorTendencia(cen.cpu, h) + cen.cpu.amp * fatorDiurno(d) + lenta + ruido(estado.seed, pc.hostname + "cpu", k) * 1.4;
  if (cen.rajada) {
    var m = ((minutos % cen.rajada.periodoMin) + cen.rajada.periodoMin) % cen.rajada.periodoMin;
    if (m < cen.rajada.duracaoMin) {
      var x = m / cen.rajada.duracaoMin;
      cpu += cen.rajada.altura * Math.sin(Math.PI * x); // sobe e desce suave
    }
  }
  cpu = limitar(cpu, 2, 100);

  // RAM
  var ram = valorTendencia(cen.ram, h) + cen.ram.amp * fatorDiurno(d) + lenta * 0.4 + ruido(estado.seed, pc.hostname + "ram", k) * 0.35;
  ram = limitar(ram, 5, 99.5);

  // Disco (quase sem ruído, não oscila com o dia)
  var disco = valorTendencia(cen.disco, h) + ruido(estado.seed, pc.hostname + "dsk", k) * 0.03;
  disco = limitar(disco, 1, 99.8);

  // Nº de processos acompanha CPU/RAM
  var qtd = Math.round(95 + cpu * 0.7 + ram * 0.25 + ruido(estado.seed, pc.hostname + "qp", k) * 2.5 + (hashStr(pc.hostname) % 20));

  return { cpu: arred(cpu, 1), ram: arred(ram, 1), disco: arred(disco, 2), qtd: qtd };
}

/** Distribui CPU/RAM totais entre os grupos de processos (soma fecha com o total do PC) */
function distribuirProcessos(pc, cen, estado, amostra, t, k) {
  var h = (t - estado.t0) / 3600000;
  var ramMbUsado = (amostra.ram / 100) * estado.perfil[pc.hostname].ramTotalMb;
  var cfg = cen;
  var grupos = [];
  var somaOutrosCpu = 0, somaOutrosRam = 0;

  var baseCpu = cfg.cpu.agora - cfg.cpu.slope * cfg.cpu.desde;  // CPU "de base" antes da tendência
  var baseRam = ((cfg.ram.agora - cfg.ram.slope * cfg.ram.desde) / 100) * estado.perfil[pc.hostname].ramTotalMb;  // RAM de base antes da tendência

  for (var i = 0; i < PROCESSOS.length; i++) {
    var p = PROCESSOS[i];
    var nome = p[0];
    var n = p[3] + (hashStr(pc.hostname + nome) % (p[4] - p[3] + 1));
    var ehCulpado = cfg.culpado === nome;
    var cpu = 0, ram = 0;

    if (cfg.culpado) {
      if (!ehCulpado) {
        cpu = Math.max(0.1, p[1] * baseCpu * (1 + ruido(estado.seed, pc.hostname + nome + "c", k) * 0.04));
        ram = p[2] * baseRam * (1 + ruido(estado.seed, pc.hostname + nome + "r", k) * 0.01);
        somaOutrosCpu += cpu;
        somaOutrosRam += ram;
      }
    } else {
      cpu = p[1] * amostra.cpu * (1 + ruido(estado.seed, pc.hostname + nome + "c", k) * 0.05);
      ram = p[2] * ramMbUsado * (1 + ruido(estado.seed, pc.hostname + nome + "r", k) * 0.01);
    }
    grupos.push({ nome: nome, n: n, cpu: cpu, ram: ram, culpado: ehCulpado });
  }

  if (cfg.culpado) {
    for (var j = 0; j < grupos.length; j++) {
      if (grupos[j].culpado) {
        grupos[j].cpu = Math.max(0.3, amostra.cpu - somaOutrosCpu);
        grupos[j].ram = Math.max(50, ramMbUsado - somaOutrosRam);
      }
    }
  } else {
    // normaliza para fechar exatamente com o total do PC
    var sc = 0, sr = 0;
    grupos.forEach(function (g) { sc += g.cpu; sr += g.ram; });
    grupos.forEach(function (g) { g.cpu = g.cpu / sc * amostra.cpu; g.ram = g.ram / sr * ramMbUsado; });
  }
  return grupos;
}

// ============================================================================
// 5. PERFIL FIXO DE CADA PC (núcleos e RAM instalada)
// ============================================================================
function perfilPc(pc) {
  var h = hashStr(pc.hostname);
  return { nucleos: [4, 8, 8, 16][h % 4], ramTotalMb: [16, 16, 32][h % 3] * 1024 };
}

// ============================================================================
// 6. ESCRITA DOS CSVs
// ============================================================================
var BOM = "\uFEFF";
var CAB_HW = "RODADA;PC_INDUSTRIAL;DATA;HORA;CPU_TOTAL_PCT;RAM_TOTAL_PCT;RAM_TOTAL_MB;DISCO_TOTAL_PCT;QTD_PROCESSOS;ID_PC_INDUSTRIAL;ID_TORRE;CODIGO_TORRE;NOME_TORRE;MINERADORA";
var CAB_PR = "RODADA;PC_INDUSTRIAL;DATA;HORA;PID;PROCESSO;PROC_CPU_ABSOLUTA_PCT;PROC_CPU_GLOBAL_PCT;PROC_RAM_PCT;PROC_RAM_MB;ID_PC_INDUSTRIAL;ID_TORRE;CODIGO_TORRE;NOME_TORRE;MINERADORA";

function sufixoPc(pc) {
  return [pc.idPc, pc.idTorre, pc.codigoTorre, pc.nomeTorre, pc.mineradora].join(";");
}

function gerarLinhasRodada(pc, cen, estado, k, t, incluirProcessos) {
  var d = new Date(t);
  var rodada = k + 1;
  var am = amostrar(pc, cen, estado, t, k);
  var perfil = estado.perfil[pc.hostname];
  var ramMb = arred((am.ram / 100) * perfil.ramTotalMb, 2); // RAM_TOTAL_MB = MB em uso

  var hw = [rodada, pc.hostname, fmtData(d), fmtHora(d),
    am.cpu.toFixed(1), am.ram.toFixed(1), ramMb.toFixed(2), am.disco.toFixed(2), am.qtd, sufixoPc(pc)].join(";");

  var pr = [];
  if (incluirProcessos) {
    var grupos = distribuirProcessos(pc, cen, estado, am, t, k);
    var pidBase = 1000 + (pc.idPc * 7919) % 5000;
    grupos.forEach(function (g, gi) {
      for (var i = 0; i < g.n; i++) {
        var cpuG = g.cpu / g.n;
        var ramMbP = g.ram / g.n;
        var pid = pidBase + gi * 400 + i * 4;
        pr.push([rodada, pc.hostname, fmtData(d), fmtHora(d), pid, g.nome,
          arred(cpuG * perfil.nucleos, 1).toFixed(1), arred(cpuG, 2).toFixed(2),
          arred((ramMbP / perfil.ramTotalMb) * 100, 2).toFixed(2), arred(ramMbP, 2).toFixed(2),
          sufixoPc(pc)].join(";"));
      }
    });
  }
  return { hw: hw, pr: pr };
}

// ============================================================================
// 7. CLI
// ============================================================================
function lerArgs(argv) {
  var a = { horas: 24, intervalo: 60, procCada: 10, seed: "monitore", saida: null, fim: null, aoVivo: false, listar: false, cenarios: {} };
  for (var i = 2; i < argv.length; i++) {
    var x = argv[i];
    if (x === "--horas") a.horas = Number(argv[++i]);
    else if (x === "--intervalo") a.intervalo = Number(argv[++i]);
    else if (x === "--proc-cada") a.procCada = Number(argv[++i]);
    else if (x === "--seed") a.seed = String(argv[++i]);
    else if (x === "--saida") a.saida = argv[++i];
    else if (x === "--fim") a.fim = new Date(argv[++i]);
    else if (x === "--ao-vivo") a.aoVivo = true;
    else if (x === "--listar") a.listar = true;
    else if (x === "--cenario") {
      var par = String(argv[++i]).split("=");
      a.cenarios[par[0].toUpperCase()] = par[1];
    } else {
      console.error("Argumento desconhecido: " + x);
      process.exit(1);
    }
  }
  if (!(a.horas > 0) || !(a.intervalo >= 5) || !(a.procCada >= 1)) {
    console.error("Valores inválidos. Exemplos: --horas 24 --intervalo 60 --proc-cada 10 (intervalo mínimo: 5s)");
    process.exit(1);
  }
  if (a.fim && isNaN(a.fim.getTime())) { console.error("--fim inválido (use ISO, ex.: 2026-11-23T18:00:00)"); process.exit(1); }
  return a;
}

function atribuirCenarios(pcs, sobrescritas) {
  var mapa = {};
  pcs.forEach(function (pc, i) {
    mapa[pc.hostname] = i < CENARIOS_FIXOS.length ? CENARIOS_FIXOS[i] : CENARIOS_RESTO[(i - CENARIOS_FIXOS.length) % CENARIOS_RESTO.length];
  });
  Object.keys(sobrescritas).forEach(function (h) {
    if (!mapa[h]) { console.error("PC desconhecido em --cenario: " + h); process.exit(1); }
    if (!CENARIOS[sobrescritas[h]]) { console.error("Cenário desconhecido: " + sobrescritas[h] + " (use --listar)"); process.exit(1); }
    mapa[h] = sobrescritas[h];
  });
  return mapa;
}

function gravarManifesto(caminho, m) { fs.writeFileSync(caminho, JSON.stringify(m, null, 2), "utf-8"); }

// ----------------------------------------------------------------------------
function gerarHistorico(args, pcs, pastaSaida) {
  fs.mkdirSync(pastaSaida, { recursive: true });
  var caminhoManifesto = path.join(pastaSaida, "manifesto.json");

  // Remove só o que um run anterior gerou (o modelo lê TODOS os CSVs da pasta; sobras duplicariam dados)
  if (fs.existsSync(caminhoManifesto)) {
    try {
      var antigo = JSON.parse(fs.readFileSync(caminhoManifesto, "utf-8"));
      (antigo.arquivos || []).forEach(function (arq) {
        var p = path.join(pastaSaida, arq);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    } catch (e) { /* manifesto corrompido: ignora */ }
  }

  var passoMs = args.intervalo * 1000;
  var fim = args.fim || new Date();
  var t0 = Math.floor(fim.getTime() / passoMs) * passoMs;
  var totalRodadas = Math.floor((args.horas * 3600000) / passoMs);
  var tInicio = t0 - totalRodadas * passoMs;
  var mapaCen = atribuirCenarios(pcs, args.cenarios);

  var estado = { seed: args.seed, t0: t0, perfil: {} };
  pcs.forEach(function (pc) { estado.perfil[pc.hostname] = perfilPc(pc); });

  var nomeBase = fmtNomeArquivo(new Date(tInicio));
  var arqHw = nomeBase + "_HISTORICO_HARDWARE.csv";
  var arqPr = nomeBase + "_HISTORICO_PROCESSOS.csv";

  var linhasHw = [CAB_HW];
  var linhasPr = [CAB_PR];
  var resumo = [];

  pcs.forEach(function (pc) {
    var cen = CENARIOS[mapaCen[pc.hostname]];
    if (cen.semDados) { resumo.push({ pc: pc, cen: mapaCen[pc.hostname], rodadas: 0 }); return; }

    var kFim = totalRodadas;
    if (cen.paraHaHoras) kFim = totalRodadas - Math.round((cen.paraHaHoras * 3600000) / passoMs);

    var ultimo = null;
    for (var k = 0; k <= kFim; k++) {
      var t = tInicio + k * passoMs;
      var r = gerarLinhasRodada(pc, cen, estado, k, t, k % args.procCada === 0);
      linhasHw.push(r.hw);
      for (var j = 0; j < r.pr.length; j++) linhasPr.push(r.pr[j]);
      ultimo = r.hw;
    }
    resumo.push({ pc: pc, cen: mapaCen[pc.hostname], rodadas: kFim + 1, ultimo: ultimo });
  });

  fs.writeFileSync(path.join(pastaSaida, arqHw), BOM + linhasHw.join("\r\n") + "\r\n", "utf-8");
  fs.writeFileSync(path.join(pastaSaida, arqPr), BOM + linhasPr.join("\r\n") + "\r\n", "utf-8");

  var manifesto = {
    geradoEm: new Date().toISOString(),
    seed: args.seed,
    t0: t0,
    tInicio: tInicio,
    intervaloSeg: args.intervalo,
    procCada: args.procCada,
    ultimoK: totalRodadas,
    arquivos: [arqHw, arqPr, "manifesto.json"],
    arquivoHardware: arqHw,
    arquivoProcessos: arqPr,
    cenarios: mapaCen
  };
  gravarManifesto(caminhoManifesto, manifesto);

  console.log("\nTelemetria gerada em: " + pastaSaida);
  console.log("  " + arqHw + "  (" + (linhasHw.length - 1) + " linhas)");
  console.log("  " + arqPr + "  (" + (linhasPr.length - 1) + " linhas)");
  console.log("  janela: " + new Date(tInicio).toLocaleString("pt-BR") + "  ->  " + new Date(t0).toLocaleString("pt-BR") + "\n");

  console.log("PC".padEnd(16) + "Torre".padEnd(8) + "Cenário".padEnd(20) + "CPU".padEnd(8) + "RAM".padEnd(8) + "DISCO");
  resumo.forEach(function (x) {
    var c = x.ultimo ? x.ultimo.split(";") : null;
    console.log(
      x.pc.hostname.padEnd(16) + String(x.pc.idTorre).padEnd(8) + x.cen.padEnd(20) +
      (c ? (c[4] + "%").padEnd(8) + (c[5] + "%").padEnd(8) + c[7] + "%" : "-"));
  });
  console.log("\nNo .env.dev:  PREDITIVA_PASTA_CSV=" + path.relative(process.cwd(), pastaSaida).replace(/\\/g, "/") + "\n");
  return manifesto;
}

// ----------------------------------------------------------------------------
function modoAoVivo(args, pcs, pastaSaida) {
  var caminhoManifesto = path.join(pastaSaida, "manifesto.json");
  if (!fs.existsSync(caminhoManifesto)) {
    console.error("Manifesto não encontrado em " + pastaSaida + ". Rode antes sem --ao-vivo para gerar o histórico.");
    process.exit(1);
  }
  var man = JSON.parse(fs.readFileSync(caminhoManifesto, "utf-8"));
  var passoMs = man.intervaloSeg * 1000;
  var estado = { seed: man.seed, t0: man.t0, perfil: {} };
  pcs.forEach(function (pc) { estado.perfil[pc.hostname] = perfilPc(pc); });

  var arqHw = path.join(pastaSaida, man.arquivoHardware);
  var arqPr = path.join(pastaSaida, man.arquivoProcessos);

  function tick() {
    var kAgora = Math.floor((Date.now() - man.tInicio) / passoMs);
    if (kAgora <= man.ultimoK) return;

    var hw = [], pr = [];
    for (var k = man.ultimoK + 1; k <= kAgora; k++) {
      var t = man.tInicio + k * passoMs;
      pcs.forEach(function (pc) {
        var cen = CENARIOS[man.cenarios[pc.hostname]];
        if (cen.semDados || cen.paraHaHoras) return; // offline/sem dados continuam calados
        var r = gerarLinhasRodada(pc, cen, estado, k, t, k % man.procCada === 0);
        hw.push(r.hw);
        for (var j = 0; j < r.pr.length; j++) pr.push(r.pr[j]);
      });
    }
    if (hw.length) fs.appendFileSync(arqHw, hw.join("\r\n") + "\r\n", "utf-8");
    if (pr.length) fs.appendFileSync(arqPr, pr.join("\r\n") + "\r\n", "utf-8");

    var rodadasNovas = kAgora - man.ultimoK;
    man.ultimoK = kAgora;
    gravarManifesto(caminhoManifesto, man);
    console.log("[" + new Date().toLocaleTimeString("pt-BR") + "] +" + rodadasNovas + " rodada(s) enviada(s) para " +
      Object.keys(man.cenarios).filter(function (h) { var c = CENARIOS[man.cenarios[h]]; return !c.semDados && !c.paraHaHoras; }).length + " PCs");
  }

  console.log("Modo ao vivo: 1 rodada a cada " + man.intervaloSeg + "s. Ctrl+C para parar.");
  tick();
  setInterval(tick, Math.min(passoMs, 5000));
}

// ----------------------------------------------------------------------------
function main() {
  var args = lerArgs(process.argv);

  if (args.listar) {
    console.log("\nCenários disponíveis (use --cenario PC-HOST=nome):\n");
    Object.keys(CENARIOS).forEach(function (n) { console.log("  " + n.padEnd(20) + CENARIOS[n].descricao); });
    console.log("");
    return;
  }

  var pcs = montarPcs();
  var pastaSaida = path.resolve(args.saida || path.join(__dirname, "..", "fixtures", "telemetria"));

  if (args.aoVivo) modoAoVivo(args, pcs, pastaSaida);
  else gerarHistorico(args, pcs, pastaSaida);
}

main();
