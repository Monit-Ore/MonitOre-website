const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const paginas = fs.readdirSync('public').filter(file => /^dashboard.*\.html$/.test(file));

function montar(pagina, cargoSalvo = 'Administrador', resposta = 'Operador') {
  const dados = new Map([['NOME_USUARIO', 'Ana Silva'], ['CARGO_USUARIO', cargoSalvo]]);
  const elementos = new Map();
  const lateral = { innerHTML: '' };
  elementos.set('navegacao_lateral', lateral);
  const corpo = { dataset: {}, style: {} };
  const document = {
    body: corpo,
    getElementById(id) {
      if (!elementos.has(id)) elementos.set(id, { textContent: '' });
      return elementos.get(id);
    },
    addEventListener() {},
    querySelectorAll() { return links; },
  };
  const context = vm.createContext({
    document,
    window: { location: { pathname: '/' + pagina, replace(destino) { corpo.destino = destino; } } },
    sessionStorage: {
      getItem: key => dados.get(key),
      setItem: (key, value) => dados.set(key, value),
      clear: () => dados.clear(),
    },
    fetch: async () => ({ ok: true, json: async () => ({ cargo: resposta }) }),
  });
  vm.runInContext(fs.readFileSync('public/js/sidebar.js', 'utf8'), context);
  const links = Array.from(lateral.innerHTML.matchAll(/<a id="([^"]+)"[\s\S]*?data-permissao="([^"]+)"[\s\S]*?<\/a>/g), match => ({
    id: match[1], dataset: { permissao: match[2] }, style: { display: 'none' }, html: match[0],
  }));
  vm.runInContext(fs.readFileSync('public/js/permissao.js', 'utf8'), context);
  return { lateral, links, context, corpo, elementos };
}

test('Cada dashboard usa a navegação compartilhada e destaca seu destino', () => {
  for (const pagina of paginas) {
    const html = fs.readFileSync('public/' + pagina, 'utf8');
    assert.match(html, /class="container_responsivo dashboard-padronizada"/);
    for (const arquivo of ['css/global.css', 'css/sidebar.css', 'js/sidebar.js', 'js/global.js', 'js/permissao.js', 'js/sair.js']) {
      assert.ok(html.includes(arquivo), `${pagina}: ${arquivo}`);
    }
    const { links } = montar(pagina);
    const ativos = links.filter(link => /class="item_menu ativo"/.test(link.html));
    assert.equal(ativos.length, 1, pagina);
    if (pagina !== 'dashboard_torre.html') assert.match(ativos[0].html, /aria-current="page"/);
    assert.ok(links.every(link => link.style.display === 'none'));
  }
});

test('Operador recebe apenas os destinos operacionais, mesmo com Administrador salvo no navegador', async () => {
  const { context, links, elementos } = montar('dashboard_capacidade_tendencias.html');
  await vm.runInContext('aplicarPermissoes()', context);
  assert.deepEqual(links.filter(link => link.style.display !== 'none').map(link => link.id), ['dashboard-capacidade', 'processos', 'torres']);
  assert.equal(elementos.get('cargo_usuario').textContent, 'Operador');
});

test('Administrador recebe a navegação gerencial sem a central de suporte', async () => {
  const { context, links } = montar('dashboard-mineradoras.html', 'Operador', 'Administrador');
  await vm.runInContext('aplicarPermissoes()', context);
  assert.deepEqual(links.filter(link => link.style.display !== 'none').map(link => link.id), [
    'dashboard-capacidade', 'processos', 'torres', 'usuarios', 'menu_mineradora', 'dashboard-mineradoras',
  ]);
});

test('Suporte vê somente sua central e não recebe um link de perfil indisponível', async () => {
  const { context, links, lateral } = montar('dashboard-suporte.html', 'Administrador', 'Suporte');
  await vm.runInContext('aplicarPermissoes()', context);
  assert.deepEqual(links.filter(link => link.style.display !== 'none').map(link => link.id), ['dashboard-suporte']);
  assert.doesNotMatch(lateral.innerHTML, /href=".\/meu_perfil.html"/);
});

test('Operador não permanece na dashboard gerencial ao acessar o endereço diretamente', async () => {
  const { context, corpo } = montar('dashboard-mineradoras.html');
  corpo.dataset.permissaoPagina = 'dashboard-mineradoras';
  await vm.runInContext('aplicarPermissoes()', context);
  assert.equal(corpo.destino, '/selecao_torre.html');
  assert.equal(corpo.style.display, 'none');
});
