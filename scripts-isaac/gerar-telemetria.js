#!/usr/bin/env node
/**
 * MonitOre — Gerador de telemetria sintética
 *
 * Gera CSV (formato padrão) ou JSON Gold (contrato da camada Ouro do S3).
 *
 * USO:
 *   node scripts/gerar-telemetria.js                          # CSV, 24h, terminando agora
 *   node scripts/gerar-telemetria.js --formato gold-json      # JSON Gold, saída ./fixtures/gold-dev
 *   node scripts/gerar-telemetria.js --ao-vivo                # CSV ao vivo (requer histórico gerado)
 *   node scripts/gerar-telemetria.js --horas 48 --intervalo 30 --seed 7
 *   node scripts/gerar-telemetria.js --cenario PC-CSN-01=ram_critica
 *   node scripts/gerar-telemetria.js --listar                 # lista cenários
 *   node scripts/gerar-telemetria.js --formato gold-json --saida ./fixtures/gold-dev
 *
 * Depois, no .env.dev:  PREDITIVA_FONTE=local  PREDITIVA_PASTA_GOLD=./fixtures/gold-dev
 */

"use strict";

var fs   = require("fs");
var path = require("path");

// ============================================================================
// 1. CADASTRO (espelho de monitore_V5.sql: PC_Industrial → torre → empresa)
// ============================================================================
var MINERADORAS = [
  "Vale S.A.", "CSN Mineracao S.A.", "Samarco Mineracao S.A.",
  "Anglo American Minerio de Ferro Brasil S.A.", "Gerdau Acos Longos S.A.",
  "Mineracao Usiminas S.A.", "Companhia Brasileira de Metalurgia e Mineracao",
  "Nexa Recursos Minerais S.A.", "Mineracao Rio do Norte S.A.", "ArcelorMittal Brasil S.A."
];
var SIGLAS = ["Vale", "CSN", "Samarco", "Anglo", "Gerdau", "Usiminas", "CBMM", "Nexa", "MRN", "ArcelorMittal"];
var HOSTS  = ["VALE", "CSN", "SAMARCO", "ANGLO", "GERDAU", "USIMINAS", "CBMM", "NEXA", "MRN", "ARCELOR"];

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
// ============================================================================
var CENARIOS = {
  estavel: {
    descricao: "Operação normal, sem tendência",
    cpu:   { agora: 45, slope: 0, desde: 0, amp: 1.5 },
    ram:   { agora: 58, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 52, slope: 0.02, desde: 24, amp: 0 },
    culpado: null
  },
  cpu_subindo: {
    descricao: "CPU em alta: cruza o limite de atenção nas próximas horas",
    cpu:   { agora: 70, slope: 2.5, desde: 14, amp: 0 },
    ram:   { agora: 60, slope: 0, desde: 0, amp: 0 },
    disco: { agora: 55, slope: 0.02, desde: 24, amp: 0 },
    culpado: "java-extracao"
  },
  ram_critica: {
    descricao: "Vazamento de memória: RAM já acima da atenção, caminhando para crítico",
    cpu:   { agora: 48, slope: 0, desde: 0, amp: 1.5 },
    ram:   { agora: 86, slope: 0.9, desde: 12, amp: 0 },
    disco: { agora: 58, slope: 0.02, desde: 24, amp: 0 },
    culpado: "mysqld"
  },
  disco_enchendo: {
    descricao: "Logs crescendo: disco enche rápido (atenção só aparece com horizonte de 24h)",
    cpu:   { agora: 40, slope: 0, desde: 0, amp: 1.5 },
    ram:   { agora: 55, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 71, slope: 1.2, desde: 24, amp: 0 },
    culpado: "scada-supervisorio"
  },
  pico_intermitente: {
    descricao: "Rajadas de CPU a cada 3h (frenagens de emergência/ciclos de içamento)",
    cpu:   { agora: 50, slope: 0, desde: 0, amp: 0 },
    ram:   { agora: 62, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 50, slope: 0.02, desde: 24, amp: 0 },
    culpado: null,
    rajada: { periodoMin: 180, duracaoMin: 18, altura: 38 }
  },
  offline: {
    descricao: "Parou de enviar telemetria há 3h",
    cpu:   { agora: 44, slope: 0, desde: 0, amp: 1.5 },
    ram:   { agora: 57, slope: 0, desde: 0, amp: 1 },
    disco: { agora: 51, slope: 0.02, desde: 24, amp: 0 },
    culpado: null,
    paraHaHoras: 3
  },
  sem_dados: {
    descricao: "Nenhuma captura enviada (tela 'torre sem dados')",
    cpu:   { agora: 0, slope: 0, desde: 0, amp: 0 },
    ram:   { agora: 0, slope: 0, desde: 0, amp: 0 },
    disco: { agora: 0, slope: 0, desde: 0, amp: 0 },
    culpado: null,
    semDados: true
  }
};

var CENARIOS_FIXOS = [
  "cpu_subindo", "ram_critica", "estavel", "disco_enchendo",
  "pico_intermitente", "offline", "sem_dados"
];
var CENARIOS_RESTO = ["estavel", "estavel", "cpu_subindo", "estavel", "ram_critica", "estavel", "disco_enchendo", "estavel"];

var PROCESSOS = [
  ["mysqld",            0.22, 0.20, 1, 1],
  ["java-extracao",     0.26, 0.24, 1, 3],
  ["dockerd",           0.08, 0.10, 1, 2],
  ["node",              0.07, 0.06, 1, 1],
  ["python-captura",    0.05, 0.03, 1, 1],
  ["scada-supervisorio",0.15, 0.14, 1, 2],
  ["svchost.exe",       0.10, 0.15, 3, 5],
  ["System",            0.07, 0.08, 1, 1]
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

function ruido(seed, chave, k) {
  var r = mulberry32(hashStr(seed + "|" + chave + "|" + k));
  return (r() + r() + r() + r() - 2) * 1.7;
}

function limitar(v, min, max) { return Math.max(min, Math.min(max, v)); }
function arred(v, casas)     { var f = Math.pow(10, casas); return Math.round(v * f) / f; }
function pad(n)              { return String(n).padStart(2, "0"); }
function fmtData(d)          { return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
function fmtHora(d)          { return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
function fmtNomeArquivo(d) {
  return pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + d.getFullYear() +
    "_" + pad(d.getHours()) + "-" + pad(d.getMinutes()) + "-" + pad(d.getSeconds());
}
function fmtIso(d)           { return new Date(d).toISOString(); }

function cenarioPc(pc, indice, seed, mapaCen) {
  if (mapaCen && mapaCen[pc.hostname]) return mapaCen[pc.hostname];
  if (indice < CENARIOS_FIXOS.length) return CENARIOS_FIXOS[indice];
  return CENARIOS_RESTO[(hashStr(seed + pc.hostname) + indice) % CENARIOS_RESTO.length];
}

function perfilPc(pc) {
  var instancias = {};
  PROCESSOS.forEach(function (p) {
    var nome = p[0];
    instancias[nome] = Math.floor(p[3] + Math.random() * (p[4] - p[3] + 1));
  });
  return { instancias: instancias };
}

function calcValor(cfg, hRelativo) {
  var base = cfg.agora + cfg.slope * Math.max(hRelativo, -cfg.desde);
  return limitar(base, 0, 100);
}

function gerarLinhasRodada(pc, cen, estado, k, t, gerarProcessos) {
  var seed = estado.seed;
  var hRel = -(estado.t0 - t) / 3600000;
  var cpuBase = calcValor(cen.cpu, hRel);
  var ramBase = calcValor(cen.ram, hRel);
  var discoBase = calcValor(cen.disco, hRel);

  if (cen.rajada) {
    var minRel = (t - estado.tInicio) / 60000;
    var fase   = minRel % cen.rajada.periodoMin;
    if (fase < cen.rajada.duracaoMin) {
      cpuBase = limitar(cpuBase + cen.rajada.altura * Math.sin(Math.PI * fase / cen.rajada.duracaoMin), 0, 100);
    }
  }

  var cpu   = arred(limitar(cpuBase  + cen.cpu.amp  * ruido(seed, pc.hostname + "_cpu",   k), 0, 100), 1);
  var ram   = arred(limitar(ramBase  + cen.ram.amp  * ruido(seed, pc.hostname + "_ram",   k), 0, 100), 1);
  var disco = arred(limitar(discoBase + 0 * ruido(seed, pc.hostname + "_disco", k), 0, 100), 1);
  var ramMb = arred(ram * 163.84, 0); // ~16 GB total
  var qtdPr = PROCESSOS.length;
  var d     = new Date(t);

  var hwRow = {
    rodada: k, hostname: pc.hostname, dataHora: fmtIso(d),
    cpuTotalPct: cpu, ramTotalPct: ram, ramTotalMb: ramMb,
    discoTotalPct: disco, qtdProcessos: qtdPr
  };

  var prRows = [];
  if (gerarProcessos) {
    var perfil = estado.perfil[pc.hostname] || (estado.perfil[pc.hostname] = perfilPc(pc));
    PROCESSOS.forEach(function (p) {
      var nome     = p[0];
      var fatCpu   = p[1];
      var fatRam   = p[2];
      var inst     = perfil.instancias[nome] || 1;
      var procCpu  = arred(limitar(cpu * fatCpu + ruido(seed, nome + "_c" + k, k), 0, cpu), 1);
      var procRam  = arred(limitar(ram * fatRam + ruido(seed, nome + "_r" + k, k), 0, ram), 1);
      var procRamMb = arred(procRam * 163.84 / 100, 1);
      var discoIo   = nome === "mysqld" ? arred(0.5 + Math.abs(ruido(seed, nome + "_d" + k, k)), 2) : null;
      for (var i = 0; i < inst; i++) {
        prRows.push({
          rodada: k, hostname: pc.hostname, dataHora: fmtIso(d),
          pid: 1000 + i * 100 + hashStr(nome) % 100,
          processo: nome,
          procCpuAbsolutaPct: procCpu,
          procCpuGlobalPct: arred(procCpu / 100, 3),
          procRamPct: procRam,
          procRamMb: procRamMb,
          procDiscoIoMbs: discoIo
        });
      }
    });
  }

  return { hw: hwRow, pr: prRows };
}

function gravarManifesto(caminho, manifesto) {
  fs.writeFileSync(caminho, JSON.stringify(manifesto, null, 2), "utf-8");
}

// ============================================================================
// 4. LEITURA DE ARGUMENTOS
// ============================================================================
function lerArgs(argv) {
  var args = {
    horas: 24, intervalo: 60, seed: "monitore",
    procCada: 1, cenarios: {}, aoVivo: false,
    listar: false, saida: null, formato: "csv"
  };
  for (var i = 2; i < argv.length; i++) {
    if (argv[i] === "--horas")     args.horas    = Number(argv[++i]);
    else if (argv[i] === "--intervalo") args.intervalo = Number(argv[++i]);
    else if (argv[i] === "--seed")      args.seed     = argv[++i];
    else if (argv[i] === "--saida")     args.saida    = argv[++i];
    else if (argv[i] === "--formato")   args.formato  = argv[++i];
    else if (argv[i] === "--ao-vivo")   args.aoVivo   = true;
    else if (argv[i] === "--listar")    args.listar   = true;
    else if (argv[i] === "--cenario") {
      var par = argv[++i].split("=");
      if (par.length === 2) args.cenarios[par[0]] = par[1];
    }
  }
  return args;
}

// ============================================================================
// 5. MODO CSV (original)
// ============================================================================
var BOM = "\uFEFF";
var CABECALHO_HW = "RODADA;PC_INDUSTRIAL;DATA;HORA;CPU_TOTAL_PCT;RAM_TOTAL_PCT;RAM_TOTAL_MB;DISCO_TOTAL_PCT;QTD_PROCESSOS;ID_PC_INDUSTRIAL;ID_TORRE;CODIGO_TORRE;NOME_TORRE;MINERADORA";
var CABECALHO_PR = "RODADA;PC_INDUSTRIAL;DATA;HORA;PID;PROCESSO;PROC_CPU_ABSOLUTA_PCT;PROC_CPU_GLOBAL_PCT;PROC_RAM_PCT;PROC_RAM_MB;ID_PC_INDUSTRIAL;ID_TORRE;CODIGO_TORRE;NOME_TORRE;MINERADORA";

function hwParaCsv(pc, r, d) {
  return [
    r.rodada, pc.hostname, fmtData(d), fmtHora(d),
    r.cpuTotalPct, r.ramTotalPct, r.ramTotalMb, r.discoTotalPct, r.qtdProcessos,
    pc.idPc, pc.idTorre, pc.codigoTorre, pc.nomeTorre, pc.mineradora
  ].join(";");
}

function prParaCsv(pc, r, d) {
  return [
    r.rodada, pc.hostname, fmtData(d), fmtHora(d),
    r.pid, r.processo, r.procCpuAbsolutaPct, r.procCpuGlobalPct, r.procRamPct, r.procRamMb,
    pc.idPc, pc.idTorre, pc.codigoTorre, pc.nomeTorre, pc.mineradora
  ].join(";");
}

function gerarHistorico(args, pcs, pastaSaida) {
  if (!fs.existsSync(pastaSaida)) fs.mkdirSync(pastaSaida, { recursive: true });

  var t0     = Date.now();
  var passoMs = args.intervalo * 1000;
  var totalRodadas = Math.ceil((args.horas * 3600) / args.intervalo);
  var tInicio = t0 - totalRodadas * passoMs;
  var t0Ms   = t0;

  var mapaCen = {};
  pcs.forEach(function (pc, idx) {
    mapaCen[pc.hostname] = cenarioPc(pc, idx, args.seed, args.cenarios);
  });

  var d0     = new Date(t0);
  var arqHw  = fmtNomeArquivo(d0) + "_HISTORICO_HARDWARE.csv";
  var arqPr  = fmtNomeArquivo(d0) + "_HISTORICO_PROCESSOS.csv";
  var caminhoManifesto = path.join(pastaSaida, "manifesto.json");

  var linhasHw = [CABECALHO_HW];
  var linhasPr = [CABECALHO_PR];
  var resumo   = [];

  var estado = { seed: args.seed, t0: t0Ms, tInicio: tInicio, perfil: {} };
  pcs.forEach(function (pc) { estado.perfil[pc.hostname] = perfilPc(pc); });

  pcs.forEach(function (pc, idx) {
    var cen = CENARIOS[mapaCen[pc.hostname]];
    if (cen.semDados) return;
    var kFim = totalRodadas - 1;
    var ultimo = null;
    for (var k = 0; k <= kFim; k++) {
      var t = tInicio + k * passoMs;
      if (cen.paraHaHoras && t > t0 - cen.paraHaHoras * 3600000) continue;
      var r = gerarLinhasRodada(pc, cen, estado, k, t, k % args.procCada === 0);
      var d = new Date(t);
      linhasHw.push(hwParaCsv(pc, r.hw, d));
      for (var j = 0; j < r.pr.length; j++) linhasPr.push(prParaCsv(pc, r.pr[j], d));
      ultimo = hwParaCsv(pc, r.hw, d);
    }
    resumo.push({ pc: pc, cen: mapaCen[pc.hostname], rodadas: kFim + 1, ultimo: ultimo });
  });

  fs.writeFileSync(path.join(pastaSaida, arqHw), BOM + linhasHw.join("\r\n") + "\r\n", "utf-8");
  fs.writeFileSync(path.join(pastaSaida, arqPr), BOM + linhasPr.join("\r\n") + "\r\n", "utf-8");

  var manifesto = {
    geradoEm: new Date().toISOString(), seed: args.seed,
    t0: t0Ms, tInicio: tInicio, intervaloSeg: args.intervalo,
    procCada: args.procCada, ultimoK: totalRodadas,
    arquivos: [arqHw, arqPr, "manifesto.json"],
    arquivoHardware: arqHw, arquivoProcessos: arqPr, cenarios: mapaCen
  };
  gravarManifesto(caminhoManifesto, manifesto);

  console.log("\nTelemetria CSV gerada em: " + pastaSaida);
  console.log("  " + arqHw + "  (" + (linhasHw.length - 1) + " linhas)");
  console.log("  " + arqPr + "  (" + (linhasPr.length - 1) + " linhas)");
  console.log("\nNo .env.dev:  PREDITIVA_PASTA_CSV=" + path.relative(process.cwd(), pastaSaida).replace(/\\/g, "/") + "\n");
  return manifesto;
}

// ============================================================================
// 6. MODO AO VIVO (CSV)
// ============================================================================
function modoAoVivo(args, pcs, pastaSaida) {
  var caminhoManifesto = path.join(pastaSaida, "manifesto.json");
  if (!fs.existsSync(caminhoManifesto)) {
    console.error("Manifesto não encontrado em " + pastaSaida + ". Rode antes sem --ao-vivo para gerar o histórico.");
    process.exit(1);
  }
  var man    = JSON.parse(fs.readFileSync(caminhoManifesto, "utf-8"));
  var passoMs = man.intervaloSeg * 1000;
  var estado = { seed: man.seed, t0: man.t0, tInicio: man.tInicio, perfil: {} };
  pcs.forEach(function (pc) { estado.perfil[pc.hostname] = perfilPc(pc); });

  var arqHw  = path.join(pastaSaida, man.arquivoHardware);
  var arqPr  = path.join(pastaSaida, man.arquivoProcessos);

  function tick() {
    var kAgora = Math.floor((Date.now() - man.tInicio) / passoMs);
    if (kAgora <= man.ultimoK) return;
    var hwRows = [], prRows = [];
    for (var k = man.ultimoK + 1; k <= kAgora; k++) {
      var t = man.tInicio + k * passoMs;
      pcs.forEach(function (pc) {
        var cen = CENARIOS[man.cenarios[pc.hostname]];
        if (cen.semDados || cen.paraHaHoras) return;
        var r = gerarLinhasRodada(pc, cen, estado, k, t, k % man.procCada === 0);
        var d = new Date(t);
        hwRows.push(hwParaCsv(pc, r.hw, d));
        for (var j = 0; j < r.pr.length; j++) prRows.push(prParaCsv(pc, r.pr[j], d));
      });
    }
    if (hwRows.length) fs.appendFileSync(arqHw, hwRows.join("\r\n") + "\r\n", "utf-8");
    if (prRows.length) fs.appendFileSync(arqPr, prRows.join("\r\n") + "\r\n", "utf-8");
    man.ultimoK = kAgora;
    gravarManifesto(caminhoManifesto, man);
    console.log("[" + new Date().toLocaleTimeString("pt-BR") + "] +" + (kAgora - man.ultimoK + 1) + " rodada(s)");
  }

  console.log("Modo ao vivo: 1 rodada a cada " + man.intervaloSeg + "s. Ctrl+C para parar.");
  tick();
  setInterval(tick, Math.min(passoMs, 5000));
}

// ============================================================================
// 7. MODO GOLD-JSON (contrato camada Ouro)
// ============================================================================
function gerarGoldJson(args, pcs, pastaSaida) {
  var intervaloSeg = args.intervalo || 60;
  var passoMs      = intervaloSeg * 1000;
  var t0           = Date.now();
  var totalRodadas = Math.ceil((args.horas * 3600) / intervaloSeg);
  var tInicio      = t0 - totalRodadas * passoMs;

  var mapaCen = {};
  pcs.forEach(function (pc, idx) {
    mapaCen[pc.hostname] = cenarioPc(pc, idx, args.seed, args.cenarios);
  });

  var estado = { seed: args.seed, t0: t0, tInicio: tInicio, perfil: {} };
  pcs.forEach(function (pc) { estado.perfil[pc.hostname] = perfilPc(pc); });

  var geradosCount = 0;
  pcs.forEach(function (pc, idx) {
    var nomeCen = mapaCen[pc.hostname];
    var cen     = CENARIOS[nomeCen];

    // sem_dados → não gera arquivo
    if (cen.semDados) {
      console.log("  PULADO  " + pc.hostname + " (cenário sem_dados)");
      return;
    }

    var hwList  = [];
    var prList  = [];

    for (var k = 0; k <= totalRodadas - 1; k++) {
      var t = tInicio + k * passoMs;
      // offline: para de enviar após paraHaHoras
      if (cen.paraHaHoras && t > t0 - cen.paraHaHoras * 3600000) continue;

      var r = gerarLinhasRodada(pc, cen, estado, k + 1, t, true);
      var hwRow = r.hw;
      var prRows = r.pr;

      hwList.push({
        rodada: hwRow.rodada,
        hostname: hwRow.hostname,
        dataHora: hwRow.dataHora,
        cpuTotalPct: hwRow.cpuTotalPct,
        ramTotalPct: hwRow.ramTotalPct,
        ramTotalMb: hwRow.ramTotalMb,
        discoTotalPct: hwRow.discoTotalPct,
        qtdProcessos: hwRow.qtdProcessos
      });

      prRows.forEach(function (p) {
        var prItem = {
          rodada: p.rodada,
          hostname: p.hostname,
          dataHora: p.dataHora,
          pid: p.pid,
          processo: p.processo,
          procCpuAbsolutaPct: p.procCpuAbsolutaPct,
          procCpuGlobalPct: p.procCpuGlobalPct,
          procRamPct: p.procRamPct,
          procRamMb: p.procRamMb
        };
        if (p.procDiscoIoMbs !== null && p.procDiscoIoMbs !== undefined) {
          prItem.procDiscoIoMbs = p.procDiscoIoMbs;
        }
        prList.push(prItem);
      });
    }

    var payload = {
      schemaVersion: 1,
      origem: "gerar-telemetria-dev",
      geradoEm: new Date(t0).toISOString(),
      hostname: pc.hostname,
      intervaloSegundos: intervaloSeg,
      hardware: hwList,
      processos: prList
    };

    var pastaHost = path.join(pastaSaida, pc.hostname);
    if (!fs.existsSync(pastaHost)) fs.mkdirSync(pastaHost, { recursive: true });
    var caminhoArquivo = path.join(pastaHost, "ultimas-24h.json");
    fs.writeFileSync(caminhoArquivo, JSON.stringify(payload, null, 2), "utf-8");
    geradosCount++;
    console.log("  GERADO  " + pc.hostname + " (" + hwList.length + " rodadas hw, " + prList.length + " linhas proc) → " + caminhoArquivo);
  });

  console.log("\n" + geradosCount + " arquivo(s) JSON Gold gerado(s) em: " + pastaSaida);
  console.log("\nNo .env.dev:");
  console.log("  PREDITIVA_FONTE=local");
  console.log("  PREDITIVA_PASTA_GOLD=" + path.relative(process.cwd(), pastaSaida).replace(/\\/g, "/") + "\n");
}

// ============================================================================
// 8. MAIN
// ============================================================================
function main() {
  var args = lerArgs(process.argv);

  if (args.listar) {
    console.log("\nCenários disponíveis (use --cenario PC-HOST=nome):\n");
    Object.keys(CENARIOS).forEach(function (n) {
      console.log("  " + n.padEnd(20) + CENARIOS[n].descricao);
    });
    console.log("");
    return;
  }

  var pcs = montarPcs();

  if (args.formato === "gold-json") {
    var pastaSaida = path.resolve(args.saida || path.join(__dirname, "..", "fixtures", "gold-dev"));
    console.log("\nGerando JSON Gold (formato camada Ouro)...\n");
    gerarGoldJson(args, pcs, pastaSaida);
  } else {
    var pastaCsv = path.resolve(args.saida || path.join(__dirname, "..", "fixtures", "telemetria"));
    if (args.aoVivo) modoAoVivo(args, pcs, pastaCsv);
    else gerarHistorico(args, pcs, pastaCsv);
  }
}

main();
