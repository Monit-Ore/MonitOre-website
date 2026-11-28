#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..", "fixtures", "gold-dev");

const PERFIS = {
  normal: {
    cpu:   { base: 42, amp: 8,  min: 20, max: 65 },
    ram:   { base: 58, amp: 5,  min: 45, max: 72 },
    disco: { base: 55, amp: 1.5,min: 40, max: 70 },
  },
  alerta: {
    cpu:   { base: 84, amp: 3,  min: 78, max: 89 },
    ram:   { base: 76, amp: 4,  min: 68, max: 86 },
    disco: { base: 72, amp: 2,  min: 65, max: 80 },
  },
  critico: {
    cpu:   { base: 94, amp: 2.5,min: 90, max: 99 },
    ram:   { base: 91, amp: 2.5,min: 88, max: 97 },
    disco: { base: 88, amp: 2,  min: 82, max: 95 },
  },
};

// Distribuição solicitada
const MAPA = {
  "PC-VALE-01": "normal",
  "PC-VALE-02": "normal",
  "PC-USIMINAS-01": "normal",
  "PC-USIMINAS-02": "normal",
  "PC-GERDAU-01": "normal",
  "PC-GERDAU-02": "normal",
  "PC-CSN-01": "normal",
  "PC-ARCELOR-01": "alerta",
  "PC-ARCELOR-02": "alerta",
  "PC-CBMM-01": "alerta",
  "PC-CBMM-02": "alerta",
  "PC-MRN-01": "alerta",
  "PC-NEXA-01": "alerta",
  "PC-ANGLO-02": "critico",
  "PC-CSN-02": "critico",
  "PC-MRN-02": "critico",
  "PC-NEXA-02": "critico",
  "PC-SAMARCO-01": "critico",
  "PC-SAMARCO-02": "critico",
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function gerarValor(perfil, rnd, rodada, total) {
  // leve tendência ao longo do tempo + ruído suave para parecer realista
  const t = total > 1 ? rodada / total : 0;
  const onda = Math.sin(t * Math.PI * 4) * perfil.amp * 0.4;
  const ruido = (rnd() - 0.5) * perfil.amp * 1.2;
  const drift = (t - 0.5) * perfil.amp * 0.3;
  return round1(clamp(perfil.base + onda + ruido + drift, perfil.min, perfil.max));
}

function ajustarFixture(hostname, estado) {
  const file = path.join(BASE, hostname, "ultimas-24h.json");
  if (!fs.existsSync(file)) {
    console.log(`  SKIP ${hostname} (arquivo não encontrado)`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  const perfil = PERFIS[estado];
  const rnd = mulberry32(hashStr(hostname + ":" + estado));
  const hw = Array.isArray(data.hardware) ? data.hardware : [];
  const total = hw.length || 1;

  // Mapa rodada -> novos totais para ajustar processos
  const porRodada = new Map();

  for (let i = 0; i < hw.length; i++) {
    const h = hw[i];
    const rodada = Number(h.rodada) || i + 1;
    const cpu = gerarValor(perfil.cpu, rnd, rodada, total);
    const ram = gerarValor(perfil.ram, rnd, rodada, total);
    const disco = gerarValor(perfil.disco, rnd, rodada, total);

    // mantém ramTotalMb coerente se existir
    if (typeof h.ramTotalMb === "number" && typeof h.ramTotalPct === "number" && h.ramTotalPct > 0) {
      const ramTotalMbEstimada = h.ramTotalMb / (h.ramTotalPct / 100);
      h.ramTotalMb = Math.round(ramTotalMbEstimada * (ram / 100));
    }

    h.cpuTotalPct = cpu;
    h.ramTotalPct = ram;
    h.discoTotalPct = disco;
    porRodada.set(rodada, { cpu, ram, disco });
  }

  // Ajusta processos para ficarem coerentes com os totais
  if (Array.isArray(data.processos)) {
    for (const p of data.processos) {
      const alvo = porRodada.get(Number(p.rodada));
      if (!alvo) continue;

      // Escala CPU do processo em torno do novo total, preservando peso relativo com ruído leve
      if (typeof p.procCpuGlobalPct === "number") {
        // Mantém proporção aproximada: processos somam ~total cpu (com folga)
        const fator = 0.85 + rnd() * 0.3; // 0.85..1.15
        // Reancora pelo total: usa valor atual como peso relativo em cima de uma base 60
        const pesoRel = clamp(p.procCpuGlobalPct / 60, 0.01, 0.6);
        p.procCpuGlobalPct = round1(clamp(alvo.cpu * pesoRel * fator, 0, alvo.cpu));
        p.procCpuAbsolutaPct = round1(p.procCpuGlobalPct * 100);
      } else if (typeof p.procCpuAbsolutaPct === "number") {
        const pesoRel = clamp(p.procCpuAbsolutaPct / 6000, 0.01, 0.6);
        p.procCpuGlobalPct = round1(clamp(alvo.cpu * pesoRel * (0.85 + rnd() * 0.3), 0, alvo.cpu));
        p.procCpuAbsolutaPct = round1(p.procCpuGlobalPct * 100);
      }

      if (typeof p.procRamPct === "number") {
        const pesoRel = clamp(p.procRamPct / 60, 0.005, 0.5);
        p.procRamPct = round1(clamp(alvo.ram * pesoRel * (0.85 + rnd() * 0.3), 0, alvo.ram));
        if (typeof p.procRamMb === "number") {
          // recalcula MB a partir da proporção anterior aproximada: mantém coerência simples
          const mbPorPct = p.procRamMb / Math.max(pesoRel * 60, 1);
          p.procRamMb = round1(clamp(p.procRamPct * (mbPorPct / 1), 0, 50000));
        }
      }

      if (typeof p.procDiscoIoMbs === "number") {
        const mult = estado === "critico" ? 2.2 : estado === "alerta" ? 1.5 : 1.0;
        p.procDiscoIoMbs = round1(clamp(p.procDiscoIoMbs * mult * (0.85 + rnd() * 0.3), 0, 500));
      }
    }
  }

  data.origem = data.origem || "ajuste-estados-fixtures";
  data.ajusteEstado = { estado, ajustadoEm: new Date().toISOString() };

  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");

  const ultimo = hw[hw.length - 1] || {};
  console.log(
    `  OK ${hostname.padEnd(16)} ${estado.padEnd(7)} -> CPU ${ultimo.cpuTotalPct}% RAM ${ultimo.ramTotalPct}% Disco ${ultimo.discoTotalPct}%`
  );
}

function main() {
  const hosts = fs.existsSync(BASE)
    ? fs.readdirSync(BASE).filter((d) => fs.statSync(path.join(BASE, d)).isDirectory()).sort()
    : [];

  console.log(`Encontrados ${hosts.length} hosts em fixtures/gold-dev`);
  for (const host of hosts) {
    const estado = MAPA[host] || "normal";
    ajustarFixture(host, estado);
  }
}

main();
