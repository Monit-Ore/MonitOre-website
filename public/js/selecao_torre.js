async function carregarTorres() {
  try {
    const resposta = await fetch(
      `/torres/listarTorres?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`,
    );

    if (!resposta.ok) {
      throw new Error(`Falha ao buscar torres: ${resposta.status}`);
    }

    const grupos = await resposta.json();

    const gruposOrdenados = grupos.map((grupo) => ({
      mineradora: grupo.mineradora,
      torres: ordenarTorres(grupo.torres),
    }));

    console.log("Grupos de torres recebidos:", grupos);
    renderizarMineradoras(gruposOrdenados);
  } catch (erro) {
    console.error("Erro ao carregar torres:", erro);
  }
}

function ordenarTorres(lista) {
  const prioridade = {
    Alerta: 1,
    Regular: 2,
  };

  return lista.sort((a, b) => prioridade[a.status] - prioridade[b.status]);
}

function renderizarMineradoras(grupos) {
  const container = document.getElementById("mineradora-group");
  container.innerHTML = "";

  if (grupos.length === 0) {
    container.innerHTML =
      '<p class="lista-vazia">Nenhuma torre cadastrada ainda.</p>';
    return;
  }

  grupos.forEach(({ mineradora, torres }) => {
    const grupoEl = document.createElement("div");
    grupoEl.classList.add("mineradora-group");

    grupoEl.innerHTML = `
      <span class="mineradora-nome">${mineradora}</span>
      <div class="torres-scroll">
        ${torres.map(criarCardTorre).join("")}
      </div>
    `;

    container.appendChild(grupoEl);
  });
}

function criarCardTorre(torre) {
  const statusClasse = torre.status.toLowerCase();

  return `
    <div class="torre-div">
        <div class="torre-card" data-id-torre="${torre.id_torre}">
            <img src="./imgs/institucional/LogoBanner.png" class="torre-icon" alt="Logo" />
            <span class="torre-status ${statusClasse}">${torre.status}</span>
        </div>
        <span class="torre-codigo">${torre.codigo}</span>
    </div>
  `;
}

function ativarMenu(idAtivo) {
  document.querySelectorAll(".menu_navegacao .item_menu").forEach((item) => {
    item.classList.toggle("ativo", item.id === idAtivo);
  });
}

function ativarTorres() {
  ativarMenu("torres");
}

function ativarUsuarios() {
  ativarMenu("usuarios");
}

function ativarCargos() {
  ativarMenu("cargos");
}

function ativarAlertas() {
  ativarMenu("alertas");
}

function ativarManual() {
  ativarMenu("manual");
}

function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) {
    return;
  }
  nome_usuario.textContent = nomeUsuario;
}

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });
});

carregarTorres();
