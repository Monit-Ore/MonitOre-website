const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { criarLeitorGold, montarPanorama } = require("../src/services/goldService_dashCapacidade");

function resumo(id = 1, extra = {}) {
  return { ID_TORRE: id, ID_PC: id, MONITORAMENTO_ATIVO: true, STATUS_GERAL: "CRITICO", ...extra };
}
function componente(id = 1, extra = {}) {
  return {
    ID_TORRE: id, ID_PC: id, COMPONENTE: "RAM", LIMITE_ATENCAO_PCT: 80, LIMITE_CRITICO_PCT: 90,
    ULTIMO_CONSUMO_PCT: 97.5, DATA_HORA_ULTIMA_LEITURA: "2026-11-26 23:32:55", STATUS_ATUAL: "CRITICO",
    VARIACAO_PP: null, CRESCIMENTO_PREOCUPANTE: null, SOB_PRESSAO: null,
    DADOS_SUFICIENTES: false, PREVISAO_ATENCAO_15D: false, PREVISAO_CRITICO_15D: false,
    SITUACAO_PREVISAO: "JA_CRITICO", EXIBIR_TABELA: true, PRIORIDADE: 1, ...extra,
  };
}
function cadastro(id = 1, extra = {}) {
  return {
    id_torre: id, nome: `Torre ${id}`, monitoramentoAtivo: true,
    componentes: [{ id_pc: id, pc: `PC-${id}`, nome: "Memória RAM", atencao: 80, critico: 90 }],
    ...extra,
  };
}
function gold(torres = [resumo()], componentes = [componente()]) {
  return { torres, componentes, fuso: "-03:00" };
}

test("lê os dois JSONs locais e relê após atualização, sem transformar null em zero", async (t) => {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "monitore-gold-"));
  t.after(() => fs.rm(pasta, { recursive: true, force: true }));
  await fs.writeFile(path.join(pasta, "PANORAMA_TORRES.json"), JSON.stringify([resumo()]));
  const arquivo = path.join(pasta, "PANORAMA_ANALISE_COMPONENTES.json");
  await fs.writeFile(arquivo, "\uFEFF" + JSON.stringify([componente()]));
  const ler = criarLeitorGold({ fonte: "local", pasta });
  assert.equal((await ler()).componentes[0].VARIACAO_PP, null);
  await fs.writeFile(arquivo, JSON.stringify([componente(1, { VARIACAO_PP: -12.5 })]));
  assert.equal((await ler()).componentes[0].VARIACAO_PP, -12.5);
});

test("S3 usa bucket e prefixo configurados e consome o corpo dos dois objetos", async () => {
  const pedidos = [];
  const ler = criarLeitorGold({ fonte: "s3", bucket: "monitore-ouro-2026", prefixo: "panorama", regiao: "us-east-1" }, {
    s3Client: { async send(comando) {
      pedidos.push(comando.input);
      return { Body: { transformToString: async () => JSON.stringify(
        comando.input.Key.endsWith("PANORAMA_TORRES.json") ? [resumo()] : [componente()]) } };
    } },
  });
  const dados = await ler();
  assert.equal(dados.componentes.length, 1);
  assert.deepEqual(pedidos, [
    { Bucket: "monitore-ouro-2026", Key: "panorama/PANORAMA_TORRES.json" },
    { Bucket: "monitore-ouro-2026", Key: "panorama/PANORAMA_ANALISE_COMPONENTES.json" },
  ]);
});

test("rejeita arquivo ausente, JSON inválido, schema inválido e pares incompatíveis", async () => {
  const config = { fonte: "local", pasta: os.tmpdir() };
  await assert.rejects(criarLeitorGold(config, { readFile: async () => { throw Error("ENOENT"); } })(), /ENOENT/);
  await assert.rejects(criarLeitorGold(config, { readFile: async () => "{inválido" })(), SyntaxError);
  for (const dados of [{}, [{ ID_TORRE: "1", ID_PC: 1 }]]) {
    await assert.rejects(criarLeitorGold(config, { readFile: async () => JSON.stringify(dados) })());
  }
  const lerPar = (torres, componentes) => criarLeitorGold(config, { readFile: async (nome) =>
    JSON.stringify(nome.endsWith("PANORAMA_TORRES.json") ? torres : componentes) });
  await assert.rejects(lerPar([resumo()], [componente(), componente()])(), /duplicado/);
  await assert.rejects(lerPar([resumo()], [componente(2)])(), /incompatíveis/);
  await assert.rejects(lerPar([resumo()], [componente(1, { ULTIMO_CONSUMO_PCT: 101 })])(), /percentual/);
  await assert.rejects(lerPar([resumo()], [componente(1, { PREVISAO_CRITICO_15D: true, DIAS_EXIBICAO_CRITICO: 16 })])(), /prazo/);
});

test("filtra torres e PCs pelo cadastro, mantém null e converte o horário local para ISO", () => {
  const dados = montarPanorama([cadastro()], gold([resumo(), resumo(2)], [componente(), componente(2)]));
  assert.equal(dados.torres.length, 1);
  assert.equal(dados.torres[0].componentes.length, 1);
  assert.equal(dados.torres[0].componentes[0].variacao, null);
  assert.equal(dados.torres[0].componentes[0].atual, 97.5);
  assert.equal(dados.torres[0].situacao, "critico");
  assert.equal(dados.ultimaAtualizacao, "2026-11-27T02:32:55.000Z");
  assert.equal(montarPanorama([cadastro(3)], gold()).torres[0].situacao, "sem_dados");
  assert.equal(montarPanorama([cadastro(1, { monitoramentoAtivo: false })], gold()).torres[0].componentes.length, 0);
});

test("mantém as previsões, pressão e variação prontas da Gold sem exigir histórico bruto", () => {
  const item = componente(1, {
    STATUS_ATUAL: "NORMAL", ULTIMO_CONSUMO_PCT: 70, VARIACAO_PP: 12.25,
    SOB_PRESSAO: true, CRESCIMENTO_PREOCUPANTE: true, DADOS_SUFICIENTES: true,
    PREVISAO_ATENCAO_15D: true, DIAS_EXIBICAO_ATENCAO: 4, PRIORIDADE: 4,
    SITUACAO_PREVISAO: "ATENCAO_PREVISTA",
  });
  const dados = montarPanorama([cadastro()], gold([resumo(1, { STATUS_GERAL: "NORMAL" })], [item]));
  assert.equal(dados.torres[0].atencaoPrevista, true);
  assert.equal(dados.torres[0].componentes[0].variacao, 12.25);
  assert.deepEqual(dados.torres[0].componentes[0].previsoes, [{ nivel: "atencao", dias: 4 }]);
  assert.equal(dados.torres[0].componentes[0].sobPressao, true);
});

test("agrega vários PCs em uma torre e respeita SEM_DADOS do resumo Gold", () => {
  const primeiro = cadastro();
  primeiro.componentes.push({ ...cadastro(2).componentes[0] });
  const dados = montarPanorama([primeiro], gold(
    [resumo(1, { STATUS_GERAL: "NORMAL" }), resumo(1, { ID_PC: 2, STATUS_GERAL: "SEM_DADOS" })],
    [componente(1, { STATUS_ATUAL: "NORMAL" }), componente(1, { ID_PC: 2, STATUS_ATUAL: "SEM_DADOS", ULTIMO_CONSUMO_PCT: null })],
  ));
  assert.equal(dados.torres.length, 1);
  assert.equal(dados.torres[0].componentes.length, 2);
  assert.equal(dados.torres[0].situacao, "sem_dados");
});

test("frontend mostra p.p., ausência de histórico e previsões sem recalcular os dados", async () => {
  const elementos = new Map();
  const contexto = vm.createContext({ Intl, document: { getElementById(id) {
    if (!elementos.has(id)) elementos.set(id, { value: "todas" });
    return elementos.get(id);
  } } });
  const publicJs = path.join(__dirname, "../public/js");
  vm.runInContext(await fs.readFile(path.join(publicJs, "dashboard_capacidade_dados.js"), "utf8"), contexto);
  const codigo = await fs.readFile(path.join(publicJs, "dashboard_capacidade_tendencias.js"), "utf8");
  vm.runInContext(codigo.split('// Menu controlado por global.js.')[0], contexto);
  for (const [valor, esperado] of [[null, "—"], [12.25, "+12,25 p.p."], [-10, "-10 p.p."], [0, "0 p.p."]]) {
    const dados = montarPanorama([cadastro()], gold([resumo()], [componente(1, { VARIACAO_PP: valor })]));
    contexto.renderizarDashboard(dados.torres, dados.ultimaAtualizacao);
    assert.ok(elementos.get("lista-prioridades").innerHTML.includes(`<td>${esperado}</td>`));
    assert.match(elementos.get("lista-prioridades").innerHTML, /97,5% na última leitura/);
  }
  const dados = montarPanorama([cadastro()], gold([resumo(1, { STATUS_GERAL: "NORMAL" })], [componente(1, {
    STATUS_ATUAL: "NORMAL", SOB_PRESSAO: true, PRIORIDADE: 5, SITUACAO_PREVISAO: "SEM_RISCO_PREVISTO",
  })]));
  contexto.renderizarDashboard(dados.torres, dados.ultimaAtualizacao);
  elementos.get("filtro-situacao").value = "pressao";
  elementos.get("filtro-situacao").onchange();
  assert.match(elementos.get("lista-prioridades").innerHTML, /Sob pressão/);
});

test("controller exige sessão, evita leitura sem torres e responde 503 em falha da Gold", async (t) => {
  const model = require("../src/models/dashboardCapacidadeModel");
  const service = require("../src/services/goldService_dashCapacidade");
  const controller = require("../src/controllers/dashboardCapacidadeController");
  const consulta = t.mock.method(model, "buscarTorres", async () => []);
  const leitura = t.mock.method(service, "carregarGold", async () => { throw Error("NoSuchKey"); });
  t.mock.method(console, "error", () => {});
  const resposta = () => ({ set() {}, status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } });
  const semSessao = resposta();
  await controller.buscarPanorama({}, semSessao);
  assert.equal(semSessao.codigo, 401);
  assert.equal(consulta.mock.callCount(), 0);
  const req = { session: { ID_USUARIO: 1, FK_EMPRESA_USUARIO: 2 } };
  const vazio = resposta();
  await controller.buscarPanorama(req, vazio);
  assert.equal(vazio.codigo, 200);
  assert.equal(leitura.mock.callCount(), 0);
  consulta.mock.mockImplementation(async () => [cadastro()]);
  const falha = resposta();
  await controller.buscarPanorama(req, falha);
  assert.equal(falha.codigo, 503);
  leitura.mock.mockImplementation(async () => gold([resumo(), resumo(2)], [componente(), componente(2)]));
  const sucesso = resposta();
  await controller.buscarPanorama(req, sucesso);
  assert.equal(sucesso.codigo, 200);
  assert.equal(sucesso.dados.torres.length, 1);
  assert.equal("billing" in sucesso.dados, false);
});
