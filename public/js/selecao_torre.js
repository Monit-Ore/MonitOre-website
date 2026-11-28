const cargoUsuario = (sessionStorage.getItem("CARGO_USUARIO") || "")
  .trim()
  .toLowerCase();

const podeEditar = cargoUsuario === "administrador";


document.addEventListener("click", (evento) => {

  const btnEditar = evento.target.closest(".btn-editar");
  if (btnEditar) {
    const cardTorre = btnEditar.closest(".torre-card");
    const idTorre = cardTorre.dataset.idTorre;

    // Salva o ID no sessionStorage e redireciona para a tela de alteração
    sessionStorage.setItem("idTorreEmEdicao", idTorre);
    window.location.href = "./alteracao_torre.html";
    return;
  }

  const torreCard = evento.target.closest(".torre-card");
  if (torreCard) {
    const idTorre = torreCard.dataset.idTorre;
    
    // Salva o ID da torre selecionada no sessionStorage
    sessionStorage.setItem("ID_TORRE_SELECIONADA", idTorre);
    
    window.location.href = "./dashboard_torre.html"; 
  }
});

// 2. Quando o usuário clicar no botão de "Cadastrar Nova Torre":
const btnNovaTorre = document.getElementById("btn-cadastrar-nova-torre"); // Ajuste o ID conforme o seu HTML
btnNovaTorre?.addEventListener("click", () => {
  // Limpa para garantir que o sistema saiba que é um cadastro novo (POST)
  sessionStorage.removeItem("idTorreEmEdicao");
  window.location.href = "./alteracao_torre.html";
});




let gruposAtuais = [];

// Tempo máximo de espera pelo status do bucket antes de mostrar "sem dados".
const TEMPO_LIMITE_STATUS_MS = 5000;

function normalizarStatus(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function prioridadeStatus(status) {
  const texto = normalizarStatus(status);

  if (texto.includes("CRIT")) return 1;
  if (texto.includes("ALERT") || texto.includes("ATEN")) return 2;
  if (texto.includes("NORMAL")) return 3;
  return 4;
}

function classeStatus(status) {
  const texto = normalizarStatus(status);

  if (texto.includes("CARREGANDO")) return "carregando";
  if (texto.includes("CRIT")) return "crítico";
  if (texto.includes("ALERT") || texto.includes("ATEN")) return "alerta";
  if (texto.includes("NORMAL")) return "regular";
  return "sem-dados";
}

function textoStatus(status) {
  if (classeStatus(status) === "carregando") return "Carregando...";
  return status ?? "sem dados";
}

async function carregarTorres() {
  try {
    const idUsuario = sessionStorage.getItem("ID_USUARIO");
    const fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");

    const resposta = await fetch(
      `/torres/listarTorres?fkEmpresa=${encodeURIComponent(fkEmpresa)}&idUsuario=${encodeURIComponent(idUsuario)}`
    );

    if (!resposta.ok) {
      throw new Error(`Falha ao buscar torres: ${resposta.status}`);
    }

    const grupos = await resposta.json();

    // Enquanto o bucket não responde, o card mostra "Carregando..." em vez do
    // status antigo derivado de id % 3 / id % 2.
    const gruposOrdenados = grupos.map((grupo) => ({
      mineradora: grupo.mineradora,
      torres: grupo.torres.map((torre) => ({
        ...torre,
        status: "carregando",
        capturadoEm: null,
      })),
    }));

    console.log("Grupos de torres recebidos:", grupos);
    gruposAtuais = gruposOrdenados;
    renderizarMineradoras(gruposAtuais);
    console.log("Grupo de torres ordenadas:", juntarTorres(gruposAtuais));
    criarPrioridade(juntarTorres(gruposAtuais));
    carregarStatuses(juntarTorres(gruposAtuais));
  } catch (erro) {
    console.error("Erro ao carregar torres:", erro);
  }
}

function ordenarTorres(lista) {
  return [...lista].sort(
    (a, b) => prioridadeStatus(a.status) - prioridadeStatus(b.status)
  );
}

function atualizarStatusNosCards(torre) {
  const classe = classeStatus(torre.status);

  document
    .querySelectorAll(`.torre-card[data-id-torre="${torre.id_torre}"] .torre-status`)
    .forEach((elemento) => {
      elemento.textContent = textoStatus(torre.status);
      elemento.className = `torre-status ${classe}`;
    });
}

async function buscarStatusComLimite(url) {
  let controlador = null;
  if (typeof AbortController !== "undefined") {
    controlador = new AbortController();
  }

  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = setTimeout(() => {
      controlador?.abort();
      rejeitar(new Error("Tempo limite ao buscar o status no bucket"));
    }, TEMPO_LIMITE_STATUS_MS);
  });

  const opcoes = controlador ? { signal: controlador.signal } : undefined;

  try {
    return await Promise.race([fetch(url, opcoes), limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

async function carregarStatuses(torres) {
  const fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");

  const consultas = torres.map(async (torre) => {
    try {
      const resposta = await buscarStatusComLimite(
        `/torres/${encodeURIComponent(torre.id_torre)}/status?fkEmpresa=${encodeURIComponent(fkEmpresa)}`
      );

      if (!resposta.ok) {
        throw new Error(`Falha ao buscar status: ${resposta.status}`);
      }

      const dados = await resposta.json();
      torre.status = dados.status ?? "sem dados";
      torre.capturadoEm = dados.capturadoEm ?? null;
    } catch (erro) {
      console.warn("Status indisponível para a torre", torre.id_torre, erro);
      torre.status = "sem dados";
      torre.capturadoEm = null;
    }

    // Cada card é atualizado assim que sua própria resposta chega.
    atualizarStatusNosCards(torre);
  });

  await Promise.allSettled(consultas);

  // Só agora, com os status reais, reordena os cards e a prioridade.
  gruposAtuais.forEach((grupo) => {
    grupo.torres = ordenarTorres(grupo.torres);
  });
  renderizarMineradoras(gruposAtuais);
  criarPrioridade(juntarTorres(gruposAtuais));
}

function juntarTorres(grupos) {
  const todas = [];
  grupos.forEach((grupo) => {
    
    todas.push(...grupo.torres);
  });
  return ordenarTorres(todas);
}

function renderizarMineradoras(grupos) {
  const container = document.getElementById("mineradora-group");
  container.innerHTML = "";

  if (grupos.length === 0) {
    container.innerHTML =
      '<p class="lista-vazia">Nenhuma torre cadastrada ainda.</p>';
    return;
  }
  const tituloMin = document.getElementById("titulo-mineradora");
  tituloMin.classList.add("header-box");
  tituloMin.innerHTML = '<span>Mineradoras Parceiras</span>'
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
  const statusClasse = classeStatus(torre.status);

  return `
    <div class="torre-div">
        <div class="torre-card" data-id-torre="${torre.id_torre}">
            <img src="./imgs/institucional/LogoBanner.png" class="torre-icon" alt="Logo" />
            ${podeEditar ? `<i class="fa-solid fa-pen-to-square btn-editar"></i>` : ""}
            <span class="torre-status ${statusClasse}">${textoStatus(torre.status)}</span>
        </div>
        <span title="${torre.codigo}" class="torre-codigo">${torre.codigo}</span>
    </div>
  `;
}

function criarPrioridade(torres) {
  const container = document.getElementById("prioridade-group");
  container.innerHTML = "";

  const torresPrioridade = torres.filter(
    (torre) => prioridadeStatus(torre.status) <= 2
  );

  if (torresPrioridade.length === 0) return;

  container.innerHTML = `
    <div class="mineradora-group">
      <span class="mineradora-nome">Prioridade de atendimento</span>
      <div class="torres-priority">
        ${torresPrioridade.map(criarCardTorre).join("")}
      </div>
    </div>
  `;
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

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });


});

carregarTorres();
