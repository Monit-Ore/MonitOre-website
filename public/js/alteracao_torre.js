

const COMPONENTES = MonitOre.COMPONENTES;

// Pega o ID salvo no sessionStorage (se existir, estamos editando)
const idTorre = sessionStorage.getItem("idTorreEmEdicao");

const metricasAdicionadas = [];

async function inicializarCadastro() {
  const idUsuario = sessionStorage.getItem("ID_USUARIO");

  if (!idUsuario) {
    window.location.href = "./login.html";
    return;
  }

  await carregarOpcoes(idUsuario);
  MonitOre.preencherSelectEstatico("componente_ipt", COMPONENTES, "Selecione uma opção");

  document.getElementById("btn-add-metrica").addEventListener("click", adicionarMetrica);
  document.getElementById("form-cadastro-torre").addEventListener("submit", (evento) => salvarOuAtualizarTorre(evento));

  // SE TIVER ID NO SESSIONSTORAGE -> MODO EDIÇÃO (GET para preencher)
  // if (idTorre) {
  //   document.querySelector(".titulo-cabecalho h1").textContent = "Alteração da Torre";
  //   document.querySelector(".titulo-cabecalho span").textContent = "Atualize as informações da torre selecionada.";
  //   document.querySelector(".btn-salvar span").textContent = "Salvar Alterações";
    
  // }
  await carregarDadosTorre(idTorre);
}

// FUNÇÃO GET: Busca os dados da torre e preenche os campos automaticamente
async function carregarDadosTorre(id) {
  try {
    const resposta = await fetch(`/torres/${id}?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`);
    if (!resposta.ok) throw new Error("Erro ao buscar dados da torre.");

    const torre = await resposta.json();

    // Preenche campos gerais
    document.getElementById("nome_ipt").value = torre.nome || "";
    document.getElementById("codigo_ipt").value = torre.codigo || "";
    document.getElementById("mineradora_ipt").value = torre.fk_mineradora || "";

    // Preenche endereço
    if (torre.endereco) {
      document.getElementById("cep_ipt").value = torre.endereco.cep || "";
      document.getElementById("uf_ipt").value = torre.endereco.estado || "";
      document.getElementById("cidade_ipt").value = torre.endereco.cidade || "";
      document.getElementById("logradouro_ipt").value = torre.endereco.logradouro || "";
      document.getElementById("bairro_ipt").value = torre.endereco.bairro || "";
      document.getElementById("numero_ipt").value = torre.endereco.numero || "";
      document.getElementById("complemento_ipt").value = torre.endereco.complemento || "";
    }

    // Preenche PC Industrial
    if (torre.pc_industrial) {
      document.getElementById("identificador_ipt").value = torre.pc_industrial.identificador || "";
      document.getElementById("uuid_ipt").value = torre.pc_industrial.uuid || "";
      document.getElementById("hostname_ipt").value = torre.pc_industrial.hostname || "";
    }

    // Preenche métricas existentes
    if (Array.isArray(torre.componentes)) {
      torre.componentes.forEach(comp => {
        const componenteInfo = COMPONENTES.find(c => c.id === comp.fk_componente);
        if (componenteInfo) {
          metricasAdicionadas.push({
            fk_componente: comp.fk_componente,
            alerta_critico: comp.critico,
            alerta_atencao: comp.atencao,
            nome: componenteInfo.nome
          });
        }
      });
      renderizarMetricas();
    }
  } catch (erro) {
    console.error("Erro ao carregar torre:", erro);
    alert("Não foi possível carregar as informações para alteração.");
  }
}

async function carregarOpcoes(idUsuario) {
  try {
    const resposta = await fetch(`/torres/opcoes?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`);
    if (resposta.status === 401) {
      window.location.href = "./login.html";
      return;
    }
    if (!resposta.ok) throw new Error(`Falha ao buscar opções: ${resposta.status}`);

    const { mineradoras } = await resposta.json();
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
  const inputAlertaCritico = document.getElementById("alerta_critico_ipt");
  const inputAlertaAtencao = document.getElementById("alerta_atencao_ipt");

  const fkComponente = Number(selectComponente.value);
  const alertaCritico = Number(inputAlertaCritico.value);
  const alertaAtencao = Number(inputAlertaAtencao.value);

  const jaAdicionado = metricasAdicionadas.some((m) => m.fk_componente === fkComponente);
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
  inputAlertaCritico.value = "";
  inputAlertaAtencao.value = "";
}

function renderizarMetricas() {
  const lista = document.getElementById("lista-metricas");
  lista.innerHTML = "";

  metricasAdicionadas.forEach((metrica, indice) => {
    const linha = document.createElement("div");
    linha.classList.add("metrica-item");
    linha.innerHTML = `
      <span class="metrica-nome">${MonitOre.rotuloComponente(metrica.nome)}</span>
      <span class="metrica-valor">Crítico: ${metrica.alerta_critico}%</span>
      <span class="metrica-valor">Atenção: ${metrica.alerta_atencao}%</span>
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

// FUNÇÃO UNIFICADA: Decide se envia POST (Criar) ou PUT (Atualizar)
async function salvarOuAtualizarTorre(evento) {
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
    })),
  };

  // Define dinamicamente o método HTTP e a rota com base na existência do ID
  // const metodo = idTorre ? "PUT" : "POST";
  // const rota = idTorre 
  //   ? `/torres/atualizar-torres/${idTorre}?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`
  //   : `/torres/cadastrar-torres?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`;

  try {
    const resposta = await fetch(`/torres/atualizar-torres/${idTorre}?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      alert(dados.mensagem || "Erro ao salvar a torre.");
      return;
    }

    // Limpa o ID da sessão após o sucesso para resetar o comportamento da tela
    sessionStorage.removeItem("idTorreEmEdicao");

    alert( "Torre atualizada com sucesso!");
    window.location.href = "./selecao_torre.html";
  } catch (erro) {
    console.error("Erro ao salvar torre:", erro);
    alert("Erro ao salvar a torre. Tente novamente.");
  }
}

// Funções de menu e navegação
function ativarMenu(idAtivo) {
  MonitOre.ativarMenu(idAtivo);
}

function ativarTorres() { ativarMenu("torres"); }
function ativarUsuarios() { ativarMenu("usuarios"); }
function ativarCargos() { ativarMenu("cargos"); }
function ativarAlertas() { ativarMenu("alertas"); }
function ativarManual() { ativarMenu("manual"); }

MonitOre.instalarChrome({
  identity: true,
  menu: true,
  logout: true,
  profileId: 'usuario_logado',
  onReady: function () {
    // Se o usuário clicar em "Cancelar", limpa o storage para evitar loop de edição
    const btnCancelar = document.querySelector(".btn-cancelar");
    btnCancelar?.addEventListener("click", () => {
      sessionStorage.removeItem("idTorreEmEdicao");
    });
  },
});

inicializarCadastro();
