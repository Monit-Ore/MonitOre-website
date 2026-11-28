// Estrutura única das dashboards. permissao.js libera os links após validar a sessão.
(function () {
  const lateral = document.getElementById("navegacao_lateral");
  const pagina = window.location.pathname.split("/").pop();
  const itens = [
    ["dashboard-capacidade", "dashboard_capacidade_tendencias.html", "Panorama Operacional", "chart-column", "dashboard-capacidade"],
    ["processos", "dashboard_proc_geral.html", "Processos dos PCs", "microchip", "dashboard-torre"],
    ["torres", "selecao_torre.html", "Torres", "tower-broadcast", "torres"],
    ["usuarios", "visualizacao_usuarios.html", "Usuários", "users", "usuarios"],
    ["menu_mineradora", "cadastro_mineradora.html", "Cadastro de Mineradora", "hammer", "mineradoras"],
    ["dashboard-mineradoras", "dashboard-mineradoras.html", "Dashboard Mineradoras", "industry", "dashboard-mineradoras"],
    ["dashboard-suporte", "dashboard-suporte.html", "Visão geral do suporte", "headset", "dashboard-suporte"],
  ];

  lateral.innerHTML = `
    <div class="logo_navegacao">
      <img src="./imgs/LogoHeader.svg" alt="Monit Ore" />
      <img class="logo-reduzida" src="./imgs/logo_icon_yellow.png" alt="Monit Ore" />
    </div>
    <nav class="menu_navegacao" aria-label="Menu principal">
      <ul>${itens.map(([id, destino, rotulo, icone, permissao]) => {
        const atual = pagina === destino;
        const ativo = atual || (id === "torres" && pagina === "dashboard_torre.html");
        return `<li><a id="${id}" href="./${destino}" class="item_menu${ativo ? " ativo" : ""}"
          data-permissao="${permissao}" style="display: none" aria-label="${rotulo}"${atual ? ' aria-current="page"' : ""}>
          <i class="fa-solid fa-${icone} icone_menu" aria-hidden="true"></i><span>${rotulo}</span>
        </a></li>`;
      }).join("")}</ul>
    </nav>
    <div class="rodape_navegacao">
      ${pagina === "dashboard-suporte.html"
        ? '<div class="usuario_navegacao" id="usuario_logado">'
        : '<a class="usuario_navegacao" id="usuario_logado" href="./meu_perfil.html" aria-label="Abrir meu perfil">'}
        <div class="avatar_usuario" id="avatar_usuario">US</div>
        <span class="icone_perfil_recolhido" aria-hidden="true"><i class="fa-solid fa-user"></i></span>
        <div class="info_usuario">
          <span class="nome_usuario" id="nome_usuario">Carregando...</span>
          <span class="cargo_usuario" id="cargo_usuario"></span>
        </div>
      ${pagina === "dashboard-suporte.html" ? "</div>" : "</a>"}
      <button class="botao_sair" id="botao_sair" type="button" aria-label="Sair">
        <i class="fa-solid fa-right-from-bracket icone_menu" aria-hidden="true"></i><span>Sair</span>
      </button>
    </div>`;

  const nome = (sessionStorage.getItem("NOME_USUARIO") || "").trim();
  document.getElementById("nome_usuario").textContent = nome || "Usuário";
  document.getElementById("avatar_usuario").textContent = nome.split(/\s+/)
    .filter(Boolean).slice(0, 2).map(parte => parte[0]).join("").toUpperCase() || "US";
})();
