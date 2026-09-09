const COMPONENTES = [
  { id: 1, nome: "CPU" },
  { id: 2, nome: "RAM" },
  { id: 3, nome: "Disco" },
  { id: 4, nome: "Rede" },
];

const STATUS_SERVIDOR = ["Ativo", "Inativo", "Alerta", "Manutenção"];

const metricasAdicionadas = [];

async function inicializarCadastro() {
  const idUsuario = sessionStorage.getItem("ID_USUARIO");

  if (!idUsuario) {
    window.location.href = "./login.html";
    return;
  }

  await carregarOpcoes(idUsuario);
  preencherSelectEstatico(
    "so_ipt",
    STATUS_SERVIDOR.map((s) => ({ id: s, nome: s })),
    "status_ipt",
  );
  preencherSelectEstatico("componente_ipt", COMPONENTES, "componentes");

  document
    .getElementById("btn-add-metrica")
    .addEventListener("click", adicionarMetrica);
  document
    .getElementById("form-cadastro-torre")
    .addEventListener("submit", (evento) => salvarTorre(evento, idUsuario));
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

    const { mineradoras, estados, sistemasOperacionais } =
      await resposta.json();

    preencherSelect(
      "mineradora_ipt",
      mineradoras,
      "id_mineradora",
      "razao_social",
      "Selecione a mineradora",
    );
    preencherSelectEstatico(
      "estado_ipt",
      estados.map((e) => ({ id: e, nome: e })),
      null,
      "Selecione o estado",
    );
    preencherSelectEstatico(
      "so_ipt",
      sistemasOperacionais.map((s) => ({ id: s, nome: s })),
      null,
      "Selecione o SO",
    );
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

function preencherSelectEstatico(
  idSelect,
  itens,
  _naoUsado,
  textoPadrao = "Selecione uma opção",
) {
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

inicializarCadastro();
