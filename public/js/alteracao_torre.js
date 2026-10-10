const { createTimeline, stagger, spring } = anime;

const COMPONENTES = [
  { id: 1, nome: "CPU" },
  { id: 2, nome: "RAM" },
  { id: 3, nome: "Disco" },
  { id: 4, nome: "Rede" },
];

// Pega o ID salvo no sessionStorage (se existir, estamos editando)
const idTorre = sessionStorage.getItem("idTorreEmEdicao");

async function buscarCEP(cep) {
  try {
    if (!/^\d{8}$/.test(cep)) {
      throw new Error("CEP inválido. Use apenas 8 dígitos numéricos.");
    }
    
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);

    const data = await response.json();
    if (data.erro) throw new Error("CEP não encontrado.");

    document.getElementById('cidade_ipt').value = data.localidade;
    document.getElementById('cidade_ipt').readOnly = true;
    document.getElementById('uf_ipt').value = data.uf;
    document.getElementById('uf_ipt').readOnly = true;
    document.getElementById('bairro_ipt').value = data.bairro;
    document.getElementById('bairro_ipt').readOnly = true;
    document.getElementById('logradouro_ipt').value = data.logradouro;
    document.getElementById('logradouro_ipt').readOnly = true;    
  } catch (error) {
    console.error("Erro:", error.message);
  }
}

const metricasAdicionadas = [];

async function inicializarCadastro() {
  const idUsuario = sessionStorage.getItem("ID_USUARIO");

  if (!idUsuario) {
    window.location.href = "./login.html";
    return;
  }

  await carregarOpcoes(idUsuario);
  preencherSelectEstatico("componente_ipt", COMPONENTES, "componentes");

  document.getElementById("btn-add-metrica").addEventListener("click", adicionarMetrica);
  document.getElementById("form-cadastro-torre").addEventListener("submit", (evento) => salvarOuAtualizarTorre(evento));

  // SE TIVER ID NO SESSIONSTORAGE -> MODO EDIÇÃO (GET para preencher)
  if (idTorre) {
    document.querySelector(".titulo-cabecalho h1").textContent = "Alteração da Torre";
    document.querySelector(".titulo-cabecalho span").textContent = "Atualize as informações da torre selecionada.";
    document.querySelector(".btn-salvar span").textContent = "Salvar Alterações";
    
    await carregarDadosTorre(idTorre);
  }
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
            valor_limite: comp.valor_limite,
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
    preencherSelect("mineradora_ipt", mineradoras, "id_mineradora", "razao_social", "Selecione a mineradora");
  } catch (erro) {
    console.error("Erro ao carregar opções de cadastro:", erro);
  }
}

function preencherSelect(idSelect, itens, chaveValor, chaveTexto, textoPadrao) {
  const select = document.getElementById(idSelect);
  select.innerHTML = `<option value="" disabled selected>${textoPadrao}</option>`;
  itens.forEach((item) => {
    const option = document.createElement("option");
    option.value = item[chaveValor];
    option.textContent = item[chaveTexto];
    select.appendChild(option);
  });
}

function preencherSelectEstatico(idSelect, itens, _naoUsado, textoPadrao = "Selecione uma opção") {
  const select = document.getElementById(idSelect);
  select.innerHTML = `<option value="" selected>${textoPadrao}</option>`;
  itens.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.nome;
    select.appendChild(option);
  });
}

function adicionarMetrica() {
  const selectComponente = document.getElementById("componente_ipt");
  const inputPorcentagem = document.getElementById("porcentagem_ipt");

  const fkComponente = Number(selectComponente.value);
  const valorLimite = Number(inputPorcentagem.value);

  if (!fkComponente) {
    alert("Selecione um componente.");
    return;
  }
  if (!valorLimite || valorLimite <= 0 || valorLimite > 100) {
    alert("Informe uma porcentagem válida (1 a 100).");
    return;
  }

  const jaAdicionado = metricasAdicionadas.some((m) => m.fk_componente === fkComponente);
  if (jaAdicionado) {
    alert("Esse componente já foi adicionado.");
    return;
  }

  const componente = COMPONENTES.find((c) => c.id === fkComponente);
  metricasAdicionadas.push({
    fk_componente: fkComponente,
    valor_limite: valorLimite,
    nome: componente.nome,
  });

  renderizarMetricas();
  selectComponente.value = "";
  inputPorcentagem.value = "";
}

function renderizarMetricas() {
  const lista = document.getElementById("lista-metricas");
  lista.innerHTML = "";

  metricasAdicionadas.forEach((metrica, indice) => {
    const linha = document.createElement("div");
    linha.classList.add("metrica-item");
    linha.innerHTML = `
      <span class="metrica-nome">${tituloMetrica(metrica.nome)}</span>
      <span class="metrica-valor">${metrica.valor_limite}%</span>
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

function tituloMetrica(nomeComponente) {
  const rotulos = {
    CPU: "Porcentagem CPU",
    RAM: "Uso da Memória RAM",
    Disco: "Disponibilidade do Disco",
    Rede: "Disponibilidade de Rede",
  };
  return rotulos[nomeComponente] || nomeComponente;
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
    componentes: metricasAdicionadas.map(({ fk_componente, valor_limite }) => ({
      fk_componente,
      valor_limite
    })),
  };

  // Define dinamicamente o método HTTP e a rota com base na existência do ID
  const metodo = idTorre ? "PUT" : "POST";
  const rota = idTorre 
    ? `/torres/atualizar-torres/${idTorre}?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`
    : `/torres/cadastrar-torres?fkEmpresa=${sessionStorage.getItem("FK_EMPRESA_USUARIO")}`;

  try {
    const resposta = await fetch(rota, {
      method: metodo,
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

    alert(idTorre ? "Torre atualizada com sucesso!" : "Torre cadastrada com sucesso!");
    window.location.href = "./selecao_torre.html";
  } catch (erro) {
    console.error("Erro ao salvar torre:", erro);
    alert("Erro ao salvar a torre. Tente novamente.");
  }
}

// Funções de menu e navegação
function ativarMenu(idAtivo) {
  document.querySelectorAll(".menu_navegacao .item_menu").forEach((item) => {
    item.classList.toggle("ativo", item.id === idAtivo);
  });
}

function ativarTorres() { ativarMenu("torres"); }
function ativarUsuarios() { ativarMenu("usuarios"); }
function ativarCargos() { ativarMenu("cargos"); }
function ativarAlertas() { ativarMenu("alertas"); }
function ativarManual() { ativarMenu("manual"); }

function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) return;
  nome_usuario.textContent = nomeUsuario;

  const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO");
  if (!cargoUsuario) return;
  cargo_usuario.textContent = cargoUsuario;
}

function carregarIniciais() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) return;
  const iniciais = [];

  for (let i = 0; i < nomeUsuario.length; i++) {
    if (i == 0) iniciais.push(nomeUsuario[i]);
    if (nomeUsuario[i] == " ") {
      iniciais.push(nomeUsuario[i + 1]);
      break;
    }
  }
  avatar_usuario.textContent = iniciais.join('');
}

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();
  carregarIniciais();
  const botaoMenu = document.querySelector(".btn-notificacao");

  botaoMenu?.addEventListener("click", () => document.body.classList.toggle("menu-aberto"));

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  // Se o usuário clicar em "Cancelar", limpa o storage para evitar loop de edição
  const btnCancelar = document.querySelector(".btn-cancelar");
  btnCancelar?.addEventListener("click", () => {
    sessionStorage.removeItem("idTorreEmEdicao");
  });
});

inicializarCadastro();