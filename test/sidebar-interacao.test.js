const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function preparar() {
  const ouvintes = () => ({ eventos: {}, addEventListener(tipo, fn) { this.eventos[tipo] = fn; }, removeEventListener() {} });
  const classes = new Set();
  const body = Object.assign(ouvintes(), {
    classList: { contains: (nome) => classes.has(nome), remove: (nome) => classes.delete(nome),
      toggle(nome, ativo) { if (ativo) classes.add(nome); else classes.delete(nome); } },
    appendChild() {},
  });
  let hover = false;
  let focoTeclado = false;
  const nav = Object.assign(ouvintes(), {
    matches: () => hover,
    contains: (alvo) => alvo === link,
  });
  const link = { matches: () => focoTeclado };
  const botao = Object.assign(ouvintes(), {
    atributos: {}, setAttribute(nome, valor) { this.atributos[nome] = valor; },
    contains: () => false, focus() {},
  });
  const mq = Object.assign(ouvintes(), { matches: true });
  const root = { dataset: {} };
  const timers = new Map();
  let proximoTimer = 0;
  const document = Object.assign(ouvintes(), {
    documentElement: root, body, readyState: "complete", activeElement: null,
    querySelector(seletor) {
      if (seletor === ".navegacao") return nav;
      if (seletor === ".container_responsivo") return body;
      return null;
    },
    querySelectorAll: (seletor) => seletor === "[data-menu-toggle]" ? [botao] : [],
    getElementById: () => null,
    createElement: () => Object.assign(ouvintes(), { style: {}, setAttribute() {} }),
  });
  const window = {
    matchMedia: (consulta) => consulta === "(width > 900px)" ? mq : { matches: false },
    setTimeout(fn, ms) { const id = ++proximoTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const contexto = vm.createContext({ document, window, queueMicrotask });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/js/global.js"), "utf8"), contexto);
  return {
    root, body, botao,
    passarMouse(ativo) { hover = ativo; nav.eventos[ativo ? "mouseenter" : "mouseleave"](); },
    focar(ativo) { focoTeclado = ativo; document.activeElement = ativo ? link : null; nav.eventos.focusin(); },
    mudarDesktop(ativo) { mq.matches = ativo; mq.eventos.change(); },
    executarRecolhimento() {
      for (const [id, timer] of timers) if (timer.ms === 150) { timers.delete(id); timer.fn(); }
    },
  };
}

test("desktop inicia recolhido, expande ao passar o mouse e recolhe ao sair", () => {
  const ui = preparar();
  assert.equal(ui.root.dataset.sidebar, "collapsed");
  ui.passarMouse(true);
  assert.equal(ui.root.dataset.sidebar, "expanded");
  ui.passarMouse(false);
  ui.executarRecolhimento();
  assert.equal(ui.root.dataset.sidebar, "collapsed");
});

test("reentrada cancela o recolhimento e foco do teclado mantém o menu aberto", () => {
  const ui = preparar();
  ui.passarMouse(true);
  ui.passarMouse(false);
  ui.passarMouse(true);
  ui.executarRecolhimento();
  assert.equal(ui.root.dataset.sidebar, "expanded");
  ui.focar(true);
  ui.passarMouse(false);
  ui.executarRecolhimento();
  assert.equal(ui.root.dataset.sidebar, "expanded");
  ui.focar(false);
  ui.executarRecolhimento();
  assert.equal(ui.root.dataset.sidebar, "collapsed");
});

test("celular mantém abertura pelo botão e ignora a passagem do mouse", () => {
  const ui = preparar();
  ui.mudarDesktop(false);
  assert.equal(ui.root.dataset.sidebar, undefined);
  ui.passarMouse(true);
  assert.equal(ui.body.classList.contains("menu-aberto"), false);
  ui.botao.eventos.click();
  assert.equal(ui.body.classList.contains("menu-aberto"), true);
  assert.equal(ui.botao.atributos["aria-expanded"], "true");
  ui.botao.eventos.click();
  assert.equal(ui.body.classList.contains("menu-aberto"), false);
  ui.mudarDesktop(true);
  ui.passarMouse(false);
  ui.executarRecolhimento();
  assert.equal(ui.root.dataset.sidebar, "collapsed");
});
