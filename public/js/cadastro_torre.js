

const COMPONENTES = MonitOre.COMPONENTES;

const metricasAdicionadas = [];

async function inicializarCadastro() {
  const idUsuario = sessionStorage.getItem("ID_USUARIO");

  if (!idUsuario) {
    window.location.href = "./login.html";
    return;
  }

  await carregarOpcoes(idUsuario);
  MonitOre.preencherSelectEstatico("componente_ipt", COMPONENTES, "Selecione uma opção");

  document
    .getElementById("btn-add-metrica")
    .addEventListener("click", adicionarMetrica);
  document
    .getElementById("form-cadastro-torre")
    .addEventListener("submit", (evento) => salvarTorre(evento));
}

async function carregarOpcoes(idUsuario) {
  try {
    const resposta = await fetch(
      `/torres/opcoes?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`,
    );

    if (resposta.status === 401) {
      window.location.href = "./login.html";
      return;
    }

    if (!resposta.ok) {
      throw new Error(`Falha ao buscar opções: ${resposta.status}`);
    }

    const { mineradoras} = await resposta.json();

    MonitOre.preencherSelect(
      "mineradora_ipt",
      mineradoras,
      "id_mineradora",
      "razao_social",
      "Selecione a mineradora",
      { placeholderDesabilitado: true },
    );
  } catch (erro) {
    console.error("Erro ao carregar opções de cadastro:", erro);
  }
}

function adicionarMetrica() {
  const selectComponente = document.getElementById("componente_ipt");
  

  const fkComponente = Number(selectComponente.value);
  const alertaCritico = Number(document.getElementById("alerta_critico_ipt").value);
  const alertaAtencao = Number(document.getElementById("alerta_atencao_ipt").value);

  const jaAdicionado = metricasAdicionadas.some(
    (m) => m.fk_componente === fkComponente,
  );
  const erroMetrica = MonitOre.validarMetrica({
    fkComponente,
    alertaCritico,
    alertaAtencao,
    jaAdicionado,
  });

  if (erroMetrica) {
    alert(erroMetrica);
    return;
  }

  const componente = COMPONENTES.find((c) => c.id === fkComponente);

  metricasAdicionadas.push({
    fk_componente: fkComponente,
    alerta_critico: alertaCritico,
    alerta_atencao: alertaAtencao,
    nome: componente.nome,
  });

  renderizarMetricas();

  selectComponente.value = "";
  document.getElementById("alerta_critico_ipt").value = "";
  document.getElementById("alerta_atencao_ipt").value = "";
}

function renderizarMetricas() {
  const lista = document.getElementById("lista-metricas");
  lista.innerHTML = "";

  metricasAdicionadas.forEach((metrica, indice) => {
    const linha = document.createElement("div");
    linha.classList.add("metrica-item");

    linha.innerHTML = `
      <span class="metrica-nome">${MonitOre.rotuloComponente(metrica.nome)}</span>
      <span class="metrica-valor">${metrica.alerta_critico}%</span>
      <span class="metrica-valor">${metrica.alerta_atencao}%</span>
      <button type="button" class="btn-remover-metrica" data-indice="${indice}">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    lista.appendChild(linha);
  });
  lista.querySelectorAll(".btn-remover-metrica").forEach((botao) => {
    botao.addEventListener("click", () => {
      const indice = Number(botao.dataset.indice);
      metricasAdicionadas.splice(indice, 1);
      renderizarMetricas();
    });
  });
}

async function salvarTorre(evento) {
  evento.preventDefault();

  if (metricasAdicionadas.length === 0) {
    alert("Adicione ao menos uma métrica de componente para monitorar.");
    return;
  }

  const corpo = {
    nome: document.getElementById("nome_ipt").value,
    codigo: document.getElementById("codigo_ipt").value,
    fk_mineradora: Number(document.getElementById("mineradora_ipt").value),
    pc_industrial: {
      identificador: document.getElementById("identificador_ipt").value,
      hostname: document.getElementById("hostname_ipt").value || null,
      uuid: document.getElementById("uuid_ipt").value,
    },
    endereco: {
      cep: document.getElementById("cep_ipt").value,
      estado: document.getElementById("uf_ipt").value,
      cidade: document.getElementById("cidade_ipt").value,
      logradouro: document.getElementById("logradouro_ipt").value,
      bairro: document.getElementById("bairro_ipt").value,
      numero: document.getElementById("numero_ipt").value,
      complemento: document.getElementById("complemento_ipt").value,
    },
    componentes: metricasAdicionadas.map(({ fk_componente, alerta_critico, alerta_atencao }) => ({
      fk_componente,
      alerta_critico,
      alerta_atencao
    }
  )),
  };

  try {
    const resposta = await fetch(
      `/torres/cadastrar-torres?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      },
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(dados.mensagem || "Erro ao cadastrar a torre.");
      return;
    }
    alert("Torre cadastrada com sucesso!");
    window.location.href = "./selecao_torre.html";
  } catch (erro) {
    console.error("Erro ao cadastrar torre:", erro);
    alert("Erro ao cadastrar a torre. Tente novamente.");
  }
}

function ativarMenu(idAtivo) {
  MonitOre.ativarMenu(idAtivo);
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

MonitOre.instalarChrome({
  identity: true,
  menu: true,
  logout: true,
  profileId: 'usuario_logado',
});

inicializarCadastro();

