#!/usr/bin/env node
/**
 * MonitOre — Validador de arquivo JSON Gold (contrato camada Ouro)
 *
 * USO:
 *   node scripts/validar-gold.js <arquivo.json>
 *
 * Sai com código 0 se válido, código 1 se inválido.
 * Imprime relatório de problemas encontrados.
 */

"use strict";

var fs   = require("fs");
var path = require("path");

// ============================================================================
// UTILITÁRIOS
// ============================================================================
var erros = [];

function erro(msg) { erros.push("  ERRO: " + msg); }
function aviso(msg) { erros.push("  AVISO: " + msg); }

function isIsoUtc(val) {
  if (typeof val !== "string") return false;
  if (!val.endsWith("Z")) return false;
  var d = new Date(val);
  return !isNaN(d.getTime());
}

function isNaoNegativo(v) {
  return typeof v === "number" && !isNaN(v) && v >= 0;
}

function isPorcentagem(v) {
  return typeof v === "number" && !isNaN(v) && v >= 0 && v <= 100;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================
function validar(arquivo) {
  console.log("\nValidando: " + arquivo + "\n");

  // --- Leitura ---
  if (!fs.existsSync(arquivo)) {
    console.error("ERRO: arquivo não encontrado: " + arquivo);
    process.exit(1);
  }

  var raw;
  try {
    raw = fs.readFileSync(arquivo, "utf-8");
  } catch (e) {
    console.error("ERRO: falha ao ler arquivo: " + e.message);
    process.exit(1);
  }

  var obj;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    console.error("ERRO: JSON inválido: " + e.message);
    process.exit(1);
  }

  // --- Campos de topo ---
  if (typeof obj.schemaVersion !== "number") erro("schemaVersion deve ser number, obtido: " + typeof obj.schemaVersion);
  if (typeof obj.origem !== "string" || !obj.origem) erro("origem deve ser string não vazia");
  if (!isIsoUtc(obj.geradoEm)) erro("geradoEm deve ser ISO-8601 UTC (termina em Z): " + obj.geradoEm);
  if (typeof obj.hostname !== "string" || !obj.hostname.trim()) erro("hostname deve ser string não vazia");
  if (typeof obj.intervaloSegundos !== "number" || obj.intervaloSegundos <= 0) erro("intervaloSegundos deve ser number > 0");
  if (!Array.isArray(obj.hardware)) erro("hardware deve ser array");
  if (!Array.isArray(obj.processos)) erro("processos deve ser array");

  // Para o restante, usar fallbacks seguros
  var hostname = typeof obj.hostname === "string" ? obj.hostname.trim().toUpperCase() : "";
  var hardware = Array.isArray(obj.hardware) ? obj.hardware : [];
  var processos = Array.isArray(obj.processos) ? obj.processos : [];

  // --- Validação de hardware ---
  var chavesHw = new Set();
  hardware.forEach(function (item, idx) {
    var pfx = "hardware[" + idx + "]: ";

    if (typeof item.rodada !== "number" || isNaN(item.rodada)) erro(pfx + "rodada deve ser number");
    if (typeof item.hostname !== "string" || !item.hostname) {
      aviso(pfx + "hostname ausente (será assumido do arquivo)");
    } else if (item.hostname.trim().toUpperCase() !== hostname) {
      aviso(pfx + "hostname '" + item.hostname + "' difere do hostname do arquivo '" + hostname + "'");
    }
    if (!isIsoUtc(item.dataHora)) erro(pfx + "dataHora deve ser ISO-8601 UTC: " + item.dataHora);
    var temMetrica = false;
    ["cpuTotalPct", "ramTotalPct", "discoTotalPct"].forEach(function (campo) {
      var v = item[campo];
      if (v === null || v === undefined) return;
      temMetrica = true;
      if (!isPorcentagem(v)) erro(pfx + campo + " deve ser 0-100 ou null, obtido: " + v);
    });
    if (!temMetrica) erro(pfx + "deve conter ao menos uma métrica de CPU/RAM/Disco");
    if (item.ramTotalMb !== null && item.ramTotalMb !== undefined && !isNaoNegativo(item.ramTotalMb)) {
      erro(pfx + "ramTotalMb deve ser number >= 0 ou null, obtido: " + item.ramTotalMb);
    }
    if (item.qtdProcessos !== null && item.qtdProcessos !== undefined && !isNaoNegativo(item.qtdProcessos)) {
      erro(pfx + "qtdProcessos deve ser number >= 0, obtido: " + item.qtdProcessos);
    }

    // Verificar duplicatas: (hostname, rodada, dataHora)
    var chave = (item.hostname || "") + "_" + item.rodada + "_" + item.dataHora;
    if (chavesHw.has(chave)) erro(pfx + "DUPLICATA detectada (hostname, rodada, dataHora)");
    else chavesHw.add(chave);
  });

  // --- Validação de processos ---
  processos.forEach(function (item, idx) {
    var pfx = "processos[" + idx + "]: ";

    if (typeof item.rodada !== "number" || isNaN(item.rodada)) erro(pfx + "rodada deve ser number");
    if (typeof item.hostname !== "string" || !item.hostname) {
      aviso(pfx + "hostname ausente (será assumido do arquivo)");
    }
    if (!isIsoUtc(item.dataHora)) erro(pfx + "dataHora deve ser ISO-8601 UTC: " + item.dataHora);
    if (typeof item.pid !== "number" || isNaN(item.pid)) erro(pfx + "pid deve ser number");
    if (typeof item.processo !== "string" || !item.processo.trim()) erro(pfx + "processo deve ser string não vazia");
    var temMetricaProc = false;
    if (item.procCpuGlobalPct === null || item.procCpuGlobalPct === undefined) {
      // permitido para componente não configurado
    } else if (!isPorcentagem(item.procCpuGlobalPct)) {
      erro(pfx + "procCpuGlobalPct deve ser 0-100 ou null, obtido: " + item.procCpuGlobalPct);
    } else {
      temMetricaProc = true;
    }
    if (item.procRamPct === null || item.procRamPct === undefined) {
      // permitido para componente não configurado
    } else if (!isPorcentagem(item.procRamPct)) {
      erro(pfx + "procRamPct deve ser 0-100 ou null, obtido: " + item.procRamPct);
    } else {
      temMetricaProc = true;
    }
    if (item.procRamMb !== null && item.procRamMb !== undefined) {
      if (!isNaoNegativo(item.procRamMb)) erro(pfx + "procRamMb deve ser number >= 0, obtido: " + item.procRamMb);
      else temMetricaProc = true;
    }
    if (item.procCpuAbsolutaPct !== null && item.procCpuAbsolutaPct !== undefined) {
      if (!isNaoNegativo(item.procCpuAbsolutaPct)) erro(pfx + "procCpuAbsolutaPct deve ser number >= 0, obtido: " + item.procCpuAbsolutaPct);
      else temMetricaProc = true;
    }
    if (!temMetricaProc) erro(pfx + "deve conter ao menos uma métrica de processo");

    // procDiscoIoMbs é opcional, mas se presente deve ser number >= 0
    if (item.procDiscoIoMbs !== null && item.procDiscoIoMbs !== undefined) {
      if (!isNaoNegativo(item.procDiscoIoMbs)) erro(pfx + "procDiscoIoMbs deve ser number >= 0, obtido: " + item.procDiscoIoMbs);
    }
  });

  // --- Resumo ---
  console.log("  Hostname:          " + (obj.hostname || "(ausente)"));
  console.log("  schemaVersion:     " + obj.schemaVersion);
  console.log("  origem:            " + obj.origem);
  console.log("  geradoEm:          " + obj.geradoEm);
  console.log("  intervaloSegundos: " + obj.intervaloSegundos);
  console.log("  hardware:          " + hardware.length + " registros");
  console.log("  processos:         " + processos.length + " registros");
  console.log("  duplicatas hw:     " + (hardware.length - chavesHw.size));

  if (erros.length > 0) {
    console.log("\nProblemas encontrados (" + erros.length + "):");
    erros.forEach(function (e) { console.log(e); });
    console.log("\nRESULTADO: INVÁLIDO\n");
    process.exit(1);
  } else {
    console.log("\nRESULTADO: VÁLIDO ✔\n");
    process.exit(0);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================
var arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: node scripts/validar-gold.js <arquivo.json>");
  process.exit(1);
}

validar(path.resolve(arquivo));
