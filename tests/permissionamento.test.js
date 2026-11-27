const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Não carregar configurações nem acessar serviços reais.
require.cache[require.resolve('dotenv')] = { exports: { config() {} } };
const model = require('../src/models/usuarioModel');
const usuarios = new Map([
  [1, { id_usuario: 1, cargo: 'Suporte', fk_empresa: 1 }],
  [2, { id_usuario: 2, cargo: 'Administrador', fk_empresa: 1 }],
  [3, { id_usuario: 3, cargo: 'Operador', fk_empresa: 1 }],
  [4, { id_usuario: 4, cargo: 'Operador', fk_empresa: 2 }],
]);
model.buscarSessaoPorId = async id => usuarios.has(Number(id)) ? [usuarios.get(Number(id))] : [];
model.buscarPorEmail = async email => {
  const u = usuarios.get(Number(email.split('@')[0]));
  return u ? [{ ...u, nome: 'Teste', email, senha: 'teste123' }] : [];
};
model.atualizarUltimoAcesso = async () => {};
model.buscarPorCpf = async () => [];
let cadastro, acessos = 0;
model.cadastrar = async (...args) => { cadastro = args; return { insertId: 5 }; };
model.validarTorresFabricante = async () => {};
model.salvarAcessosTorres = async () => { acessos++; return {}; };
model.atualizarCargo = async (id, cargo) => { usuarios.get(Number(id)).cargo = cargo; return {}; };
require('../src/controllers/suporteController').buscarCaptura = (req, res) => res.json({ captura: 'simulada' });
const app = require('../app');

async function iniciar() {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const pedir = (url, cookie, options = {}) => fetch(base + url, { redirect: 'manual', ...options, headers: { ...(cookie ? { cookie } : {}), ...options.headers } });
  const login = async id => {
    const res = await pedir('/usuarios/autenticar', null, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@teste.com', senha: 'teste123' }) });
    assert.equal(res.status, 200);
    return res.headers.get('set-cookie').split(';')[0];
  };
  return { server, pedir, login };
}

test('Isolamento HTTP por cargo, atualização de sessão e logout', async () => {
  const { server, pedir, login } = await iniciar();
  try {
    const suporte = await login(1), admin = await login(2), operador = await login(3);
    assert.equal((await pedir('/suporte/buscar')).status, 401);
    const paginas = fs.readdirSync('public').filter(n => n.endsWith('.html') && !['index.html','sobre.html','equipe.html','login.html'].includes(n));
    for (const pagina of paginas) {
      const anon = await pedir('/' + pagina);
      assert.equal(anon.headers.get('location'), '/login.html', pagina);
      const res = await pedir('/' + pagina, suporte);
      assert.equal(res.status, pagina === 'dashboard-suporte.html' ? 200 : 302, pagina);
      if (pagina !== 'dashboard-suporte.html') assert.equal(res.headers.get('location'), '/dashboard-suporte.html');
    }
    for (const cookie of [admin, operador]) {
      assert.equal((await pedir('/suporte/buscar', cookie)).status, 403);
      assert.equal((await pedir('/dashboard-suporte.html', cookie)).headers.get('location'), '/selecao_torre.html');
      assert.equal((await pedir('/selecao_torre.html', cookie)).status, 200);
    }
    assert.equal((await pedir('/suporte/buscar', suporte)).status, 200);
    for (const rota of ['/usuarios/listar','/torres/listarTorres','/empresas/cadastrar']) {
      assert.equal((await pedir(rota, suporte)).status, 403);
    }
    assert.equal((await pedir('/%64ashboard_torre.html', suporte)).status, 302);
    assert.equal((await pedir('/dashboard_torre.html.', suporte)).status, 302);
    assert.equal((await pedir('/dashboard_torre.html::$DATA', suporte)).status, 400);
    const post = (rota, cookie, body, method = 'POST') => pedir(rota, cookie, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/usuarios/cadastrar', operador, {})).status, 403);
    assert.equal((await post('/usuarios/atualizarCargo', admin, { userServer: 1, senhaNovaServer: 'invalido' })).status, 400);
    assert.equal((await post('/usuarios/atualizarCargo', admin, { userServer: 4, senhaNovaServer: 'Suporte' })).status, 403);
    assert.equal((await post('/usuarios/torres/acessos/1', admin, { torres: [1] }, 'PUT')).status, 403);
    assert.equal(acessos, 0);
    const cargos = await (await pedir('/usuarios/cargos', admin)).json();
    assert.ok(cargos.some(c => c.cargo === 'Suporte'));
    assert.equal((await post('/usuarios/cadastrar', admin, { nome: 'Novo Suporte', email: 'novo@teste.com', cpf: '52998224725', senha: 'teste123', cargo: 'Suporte', torres: [999] })).status, 201);
    assert.equal(cadastro[6], 'Suporte');
    assert.equal((await post('/usuarios/atualizarCargo', admin, { userServer: 3, senhaNovaServer: 'Suporte' })).status, 200);
    assert.equal((await pedir('/selecao_torre.html', operador)).headers.get('location'), '/dashboard-suporte.html');
    assert.equal((await pedir('/usuarios/sessao', operador)).status, 200);
    assert.equal((await pedir('/suporte/buscar', operador)).status, 200);
    assert.equal((await post('/usuarios/sair', suporte, {})).status, 204);
    assert.equal((await pedir('/suporte/buscar', suporte)).status, 401);
    assert.equal((await pedir('/index.html')).status, 200);
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});

test('Scripts dos formulários e HTML inline possuem sintaxe válida', () => {
  for (const file of ['cadastro','login','permissao','sair','sessao']) new vm.Script(fs.readFileSync('public/js/' + file + '.js','utf8'));
  for (const file of fs.readdirSync('public').filter(n => n.endsWith('.html'))) {
    const html = fs.readFileSync('public/' + file, 'utf8');
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[1].includes('type="module"')) new vm.Script(match[2], { filename: file });
    }
  }
});
