const { createTimeline, stagger, spring } = anime;



document.addEventListener("click", (evento) => {
  const cardTorre = evento.target.closest(".torre-card");
  
  if (cardTorre) {
    const idTorre = cardTorre.dataset.idTorre;
    
    // Salva o ID no sessionStorage e redireciona para a tela de alteração
    sessionStorage.setItem("idTorreEmEdicao", idTorre);
    window.location.href = "./alteracao_torre.html";
  }
});

// 2. Quando o usuário clicar no botão de "Cadastrar Nova Torre":
const btnNovaTorre = document.getElementById("btn-cadastrar-nova-torre"); // Ajuste o ID conforme o seu HTML
btnNovaTorre?.addEventListener("click", () => {
  // Limpa para garantir que o sistema saiba que é um cadastro novo (POST)
  sessionStorage.removeItem("idTorreEmEdicao");
  window.location.href = "./alteracao_torre.html";
});




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

function ativarPerfil() {
  ativarMenu("perfil");
}

function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) {
    return;
  }
  nome_usuario.textContent = nomeUsuario;

  const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO");
  if (!cargoUsuario) {
    return;
  }
  cargo_usuario.textContent = cargoUsuario;
}

function carregarIniciais() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  const iniciais = [];

  for (let i = 0; i < nomeUsuario.length; i++) {
    
    if (i == 0) {
      iniciais.push(nomeUsuario[i]);
    }

    if (nomeUsuario[i] == " ") {
      iniciais.push(nomeUsuario[i + 1])
      break;
    }
    
  }
  avatar_usuario.textContent = iniciais.join('');
}

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();
  carregarIniciais();

  const botaoMenu = document.querySelector(".btn-notificacao");

  botaoMenu?.addEventListener("click", () =>
    document.body.classList.toggle("menu-aberto"),
  );

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  const logo_anime = createTimeline({
    defaults: {
      ease: spring({
      bounce: 0.3,
      duration: 400
      })
    }
  });

  logo_anime.add(
    '#yellow-icon', {
    translateY: [-100, 0],
    translateX: ['-50%', '-50%'],
    opacity: [0, 1],
    duration: 900,

  })
  .add(
    '#letters', {
    
    translateY: [
      { from: 0, to: 20, duration: 300, ease: 'outQuad' },
      { to: 0, duration: 400, ease: 'outBounce' },
    ],
    
    
  }, '-=700');
});

carregarTorres();
