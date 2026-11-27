const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const usuarioModel = require("../src/models/usuarioModel");
const { protegerAcesso } = require("../src/middleware/autorizacao");
const { filtrarDashboard } = require("../src/services/escopoDashboardMineradoras");

const raiz = path.join(__dirname, "..");
function permissoes() {
  const contexto = vm.createContext({ document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync(path.join(raiz, "public/js/permissao.js"), "utf8") + "\nthis.resultado = permissoes;", contexto);
  return contexto.resultado;
}

// DOM mínimo para verificar o resultado acessível da composição do menu.
function elemento(tag) {
  return {
    tag, children: [], dataset: {}, style: {}, atributos: {},
    append(...itens) { this.children.push(...itens); },
    appendChild(item) { this.children.push(item); },
    replaceChildren(...itens) { this.children = itens; },
    setAttribute(nome, valor) { this.atributos[nome] = valor; },
  };
}
function menu(pagina) {
  const nav = elemento("nav");
  const contexto = vm.createContext({ document: {
    body: { dataset: { permissaoPagina: pagina } },
    querySelector() { return nav; }, createElement: elemento,
  } });
  vm.runInContext(fs.readFileSync(path.join(raiz, "public/js/sidebar-menu.js"), "utf8"), contexto);
  return nav.children[0].children;
}

test("sidebar tem a ordem e os destinos por perfil, com nomes e IDs únicos", () => {
  const regras = permissoes();
  const itens = menu("dashboard-processos-gerais");
  const nomes = (cargo) => itens.filter((li) => regras[cargo].includes(li.dataset.permissao))
    .map((li) => li.children[0].children[1].textContent);
  assert.deepEqual(nomes("administrador"), ["Dashboard Mineradora", "Dashboard Processos Gerais", "Cadastro de Mineradora", "Torres", "Usuários"]);
  assert.deepEqual(nomes("operador"), ["Dashboard Mineradora", "Torres"]);
  assert.deepEqual(Array.from(regras.suporte), ["dashboard-suporte"]);
  assert.equal(new Set(itens.map((li) => li.children[0].id)).size, 5);
  const ativo = itens.filter((li) => li.children[0].atributos["aria-current"] === "page");
  assert.equal(ativo.length, 1);
  assert.equal(ativo[0].children[0].href, "./dashboard_proc_geral.html");
  assert.ok(itens.every((li) => li.style.display === "none"));
  for (const pagina of ["gerenciar-torres", "dashboard-torre", "usuarios", "mineradoras"]) {
    const selecionado = menu(pagina).find((li) => li.children[0].atributos["aria-current"] === "page");
    assert.equal(selecionado.dataset.permissao, ["gerenciar-torres", "dashboard-torre"].includes(pagina) ? "torres" : pagina);
  }
});

test("todas as páginas abrangidas usam o menu compartilhado e validam a sessão", () => {
  for (const nome of fs.readdirSync(path.join(raiz, "public")).filter((nome) => nome.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(raiz, "public", nome), "utf8");
    if (!html.includes('class="menu_navegacao"') || nome === "dashboard-suporte.html") continue;
    assert.ok(html.includes("data-menu-compartilhado"), nome);
    assert.equal((html.match(/js\/sidebar-menu.js/g) || []).length, 1, nome);
    assert.ok(html.includes("js/permissao.js"), nome);
    assert.ok(!html.includes('href="./dashboard-gerente.html"'), nome);
    assert.ok(!/<a\b[^>]*>\s*<a\b/.test(html), nome);
  }
  const suporte = fs.readFileSync(path.join(raiz, "public/dashboard-suporte.html"), "utf8");
  assert.ok(!suporte.includes("sidebar-menu.js"));
});

test("servidor valida acesso direto às páginas e APIs, preservando o perfil Suporte", async (t) => {
  t.mock.method(usuarioModel, "buscarSessaoPorId", async (cargo) => [{ cargo, id_usuario: 7, fk_empresa: 2 }]);
  const app = express();
  app.use((req, res, next) => {
    req.session = req.headers["x-cargo"] ? { ID_USUARIO: req.headers["x-cargo"] } : {};
    next();
  });
  app.use(protegerAcesso);
  app.use((req, res) => res.sendStatus(200));
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  await new Promise((resolve) => servidor.on("listening", resolve));
  const consultar = (rota, cargo) => fetch(`http://127.0.0.1:${servidor.address().port}${rota}`, {
    headers: cargo ? { "x-cargo": cargo } : {}, redirect: "manual",
  });
  for (const cargo of ["Administrador", "Operador"]) {
    assert.equal((await consultar("/dashboard-mineradoras.html", cargo)).status, 200);
    assert.equal((await consultar("/dashboard/mineradoras", cargo)).status, 200);
    const antiga = await consultar("/dashboard-gerente.html", cargo);
    assert.equal(antiga.headers.get("location"), "/selecao_torre.html");
  }
  assert.equal((await consultar("/dashboard_proc_geral.html", "Administrador")).status, 200);
  assert.equal((await consultar("/dashboard-processos/processos", "Administrador")).status, 200);
  for (const rota of ["/dashboard_proc_geral.html", "/cadastro_mineradora.html", "/visualizacao_usuarios.html", "/cadastro.html"]) {
    assert.equal((await consultar(rota, "Operador")).headers.get("location"), "/selecao_torre.html");
  }
  for (const rota of ["/dashboard-processos/processos", "/dashboard/visao-executiva"]) {
    assert.equal((await consultar(rota, "Operador")).status, 403);
  }
  assert.equal((await consultar("/dashboard/mineradoras")).status, 401);
  assert.equal((await consultar("/dashboard_proc_geral.html")).headers.get("location"), "/login.html");
  assert.equal((await consultar("/dashboard-suporte.html", "Suporte")).status, 200);
  assert.equal((await consultar("/suporte/exemplo", "Suporte")).status, 200);
  assert.equal((await consultar("/dashboard_proc_geral.html", "Suporte")).headers.get("location"), "/dashboard-suporte.html");
  assert.equal((await consultar("/dashboard-suporte.html", "Administrador")).headers.get("location"), "/selecao_torre.html");
});

test("aplicação real não entrega HTML protegido antes da autenticação", async (t) => {
  const app = require("../app");
  const servidor = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  await new Promise((resolve) => servidor.on("listening", resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  for (const pagina of ["dashboard_proc_geral.html", "dashboard-mineradoras.html", "dashboard-gerente.html"]) {
    const resposta = await fetch(`${base}/${pagina}`, { redirect: "manual" });
    assert.equal(resposta.headers.get("location"), "/login.html");
  }
  assert.equal((await fetch(`${base}/login.html`)).status, 200);
  assert.equal((await fetch(`${base}/js/sidebar-menu.js`)).status, 200);
});

function dados() {
  return {
    kpis: { ALERTAS_HOJE: 999 },
    mineradoras: [1, 2].map((id) => ({ ID_MINERADORA: id, MINERADORA: `M${id}`, TOTAL_TORRES: 2, ALERTAS_HOJE: 99, ALERTAS_ONTEM: 88, OBSERVACAO: "global" })),
    status_torres: [1, 2, 3, 4].map((id) => ({ ID_TORRE: id, ID_MINERADORA: id <= 2 ? 1 : 2, STATUS_TORRE: id === 1 ? "Normal" : "Crítico" })),
    status_pcs: [{ ID_TORRE: 1 }, { ID_TORRE: 2 }],
    processos_destaque: [{ ID_TORRE: 2 }],
  };
}
const acesso = (id) => ({ id_torre: id, id_mineradora: 1, mineradora_nome: "M1" });

test("operador com acesso parcial não recebe agregados nem detalhes de torres não autorizadas", () => {
  const resultado = filtrarDashboard(dados(), [{ ID_MINERADORA: 1, QUANTIDADE: 99 }], [acesso(1)]);
  assert.equal(resultado.dashboard.mineradoras.length, 1);
  const mineradora = resultado.dashboard.mineradoras[0];
  assert.equal(mineradora.TOTAL_TORRES, 1);
  assert.equal(mineradora.ESTADO, "Normal");
  assert.equal(mineradora.ALERTAS_HOJE, null);
  assert.equal(mineradora.OBSERVACAO, undefined);
  assert.equal(resultado.dashboard.kpis.ALERTAS_HOJE, null);
  assert.deepEqual(resultado.dashboard.status_pcs, [{ ID_TORRE: 1 }]);
  assert.deepEqual(resultado.dashboard.processos_destaque, []);
  assert.deepEqual(resultado.alertasDiarios, []);
  assert.deepEqual(resultado.mineradorasGrafico, []);
  assert.ok(resultado.mensagem);
});

test("acesso completo inclui somente agregados da mineradora autorizada; sem acessos retorna vazio", () => {
  const resultado = filtrarDashboard(dados(), [{ ID_MINERADORA: 1 }, { ID_MINERADORA: 2 }], [acesso(1), acesso(2), acesso(2)]);
  assert.equal(resultado.dashboard.kpis.ALERTAS_HOJE, 99);
  assert.equal(resultado.dashboard.kpis.TOTAL_TORRES_MONITORADAS, 2);
  assert.deepEqual(resultado.alertasDiarios, [{ ID_MINERADORA: 1 }]);
  const vazio = filtrarDashboard(dados(), [{ ID_MINERADORA: 1 }], []);
  assert.deepEqual(vazio.dashboard.mineradoras, []);
  assert.deepEqual(vazio.dashboard.status_torres, []);
  assert.deepEqual(vazio.dashboard.status_pcs, []);
  assert.deepEqual(vazio.dashboard.processos_destaque, []);
  assert.equal(vazio.dashboard.kpis.ALERTAS_HOJE, 0);
});

test("API usa a identidade da sessão para filtrar o operador e mantém os dados do administrador", async (t) => {
  const mineradoraModel = require("../src/models/mineradoraModel");
  const torresModel = require("../src/models/torresModel");
  const controller = require("../src/controllers/dashboardController");
  t.mock.method(mineradoraModel, "buscarJson", async (arquivo) => arquivo === "dashboard.json" ? dados() : []);
  const consulta = t.mock.method(torresModel, "listarTorresPorUsuario", async () => [acesso(1)]);
  const consultar = async (cargo) => {
    let corpo;
    await controller.dashboardMineradoras({
      session: { ID_USUARIO: 7, FK_EMPRESA_USUARIO: 2, CARGO_USUARIO: cargo },
      query: { idUsuario: 999, fkEmpresa: 999 },
    }, { status(codigo) { assert.equal(codigo, 200); return this; }, json(valor) { corpo = valor; } });
    return corpo;
  };
  const operador = await consultar("Operador");
  assert.deepEqual(consulta.mock.calls[0].arguments, [7, 2]);
  assert.equal(operador.mineradoras.length, 1);
  assert.equal(operador.kpis.TOTAL_TORRES_MONITORADAS, 1);
  assert.equal(operador.kpis.ALERTAS_HOJE, null);
  const administrador = await consultar("Administrador");
  assert.equal(administrador.mineradoras.length, 2);
  assert.equal(administrador.kpis.ALERTAS_HOJE, 999);
  assert.equal(consulta.mock.callCount(), 1);
});
