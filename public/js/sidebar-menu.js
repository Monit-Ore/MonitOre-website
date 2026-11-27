/* Carregado após o <nav>, antes da inicialização da sidebar em global.js. */
(function () {
  const menu = document.querySelector("[data-menu-compartilhado]");
  if (!menu) return;

  const itens = [
    ["dashboard-mineradoras", "Dashboard Mineradora", "dashboard-mineradoras.html", "industry", "dashboard-mineradoras"],
    ["dashboard-processos-gerais", "Dashboard Processos Gerais", "dashboard_proc_geral.html", "chart-line", "dashboard-processos-gerais"],
    ["mineradoras", "Cadastro de Mineradora", "cadastro_mineradora.html", "hammer", "menu_mineradora"],
    ["torres", "Torres", "selecao_torre.html", "tower-broadcast", "torres"],
    ["usuarios", "Usuários", "visualizacao_usuarios.html", "users", "usuarios"],
  ];
  const paginasRelacionadas = {
    "dashboard-torre": "torres",
    "gerenciar-torres": "torres",
    "visualizacao_torre": "torres",
    "dashboard-capacidade": "torres",
  };
  const pagina = document.body.dataset.permissaoPagina;
  const ativo = paginasRelacionadas[pagina] || pagina;
  const lista = document.createElement("ul");

  itens.forEach(function ([permissao, nome, destino, icone, id]) {
    const li = document.createElement("li");
    li.dataset.permissao = permissao;
    // A sessão validada em permissao.js libera os itens autorizados.
    li.style.display = "none";
    const link = document.createElement("a");
    link.id = id;
    link.href = "./" + destino;
    link.className = "item_menu" + (ativo === permissao ? " ativo" : "");
    link.setAttribute("aria-label", nome);
    if (ativo === permissao) link.setAttribute("aria-current", "page");
    const simbolo = document.createElement("i");
    simbolo.className = "fa-solid fa-" + icone + " icone_menu";
    simbolo.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span");
    texto.textContent = nome;
    link.append(simbolo, texto);
    li.appendChild(link);
    lista.appendChild(li);
  });
  menu.setAttribute("aria-label", "Menu principal");
  menu.replaceChildren(lista);
})();
