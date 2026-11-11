const caminhoDadosSuporte = "./data/modelo_dashboard_suporte.json";
let dadosDosChamados = [];
let filtroSelecionado = "todos";
let responsavelSelecionado = "todos";
let graficoCapacidade = null;
let dadosEquipeCapacidade = [];

// Busca os dados demonstrativos que vieram da ETL.
async function carregarDashboardSuporte() {
  const corpoTabela = document.getElementById("tabela_chamados");

  try {
    const resposta = await fetch(caminhoDadosSuporte);
    if (!resposta.ok) throw new Error("Não foi possível carregar o arquivo JSON.");

    const dados = await resposta.json();
    dadosDosChamados = dados.chamados_que_precisam_de_atencao || [];

    mostrarIndicadores(dados);
    criarGraficos(dados);
    prepararFiltros(dados.capacidade_da_equipe);
    mostrarChamados();
  } catch (erro) {
    console.error(erro);
    corpoTabela.innerHTML = '<tr><td colspan="7">Não consegui carregar os dados. Confira o arquivo JSON.</td></tr>';
    document.getElementById("texto_aviso_sla").textContent = "Não foi possível carregar os dados do suporte.";
  }
}

function mostrarIndicadores(dados) {
  const indicadores = dados.indicadores;
  const dataAtualizacao = new Date(dados.metadados.extraido_em);
  const horaAtualizacao = dataAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  document.getElementById("data_atualizacao").textContent = "Atualizado às " + horaAtualizacao;
  document.getElementById("chamados_abertos").textContent = indicadores.chamados_abertos;
  document.getElementById("chamados_criticos").textContent = String(indicadores.chamados_criticos).padStart(2, "0");
  document.getElementById("sla_em_risco").textContent = String(indicadores.sla_em_risco).padStart(2, "0");
  document.getElementById("sla_vencido").textContent = String(indicadores.sla_vencido).padStart(2, "0");
  document.getElementById("tempo_medio").textContent = formatarTempo(indicadores.tempo_medio_resolucao_segundos);

  const variacao = indicadores.variacao_tempo_resolucao_percentual;
  document.getElementById("variacao_tempo").textContent = variacao + "% em relação ao período anterior";
  document.getElementById("texto_aviso_sla").textContent =
    (indicadores.sla_vencido + indicadores.sla_em_risco) +
    " chamados precisam de atenção. " + indicadores.sla_vencido + " vencidos e " +
    indicadores.sla_em_risco + " com vencimento nas próximas 4 horas.";
}

function formatarTempo(segundos) {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return horas + "h " + String(minutos).padStart(2, "0") + "min";
}

function criarGraficos(dados) {
  if (typeof Chart === "undefined") return;

  Chart.defaults.color = "#999999";
  Chart.defaults.font.family = "Barlow, Segoe UI, sans-serif";
  criarGraficoStatus(dados.distribuicao_por_status);
  criarGraficoTendencia(dados.serie_temporal);
  criarGraficoCapacidade(dados.capacidade_da_equipe);
  criarGraficoFaixas(dados.tempo_de_resolucao.faixas);
}

function criarGraficoStatus(status) {
  const total = status.reduce((soma, item) => soma + item.quantidade, 0);
  document.getElementById("total_status").textContent = total + " no total";

  new Chart(document.getElementById("grafico_status"), {
    type: "bar",
    data: {
      labels: status.map((item) => item.status),
      datasets: [{
        data: status.map((item) => item.quantidade),
        backgroundColor: ["#ffd000", "#4199ed", "#555d66", "#2bbd72"],
        borderRadius: 4,
        barThickness: 13
      }]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: "#303030" }, ticks: { stepSize: 12 } },
        y: { grid: { display: false }, ticks: { color: "#ddd", font: { size: 10 } } }
      }
    }
  });
}

function criarGraficoTendencia(serie) {
  const datas = serie.map((item) =>
    new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  );
  const entradas = serie.map((item) => item.chamados_recebidos);
  const resolvidos = serie.map((item) => item.chamados_resolvidos);

  document.getElementById("total_recebidos").textContent =
    entradas.reduce((a, b) => a + b, 0) + " entradas";
  document.getElementById("total_resolvidos").textContent =
    resolvidos.reduce((a, b) => a + b, 0) + " resoluções";

  new Chart(document.getElementById("grafico_tendencia"), {
    type: "line",
    data: {
      labels: datas,
      datasets: [
        { label: "Entradas", data: entradas, borderColor: "#ffd000", backgroundColor: "#ffd000", tension: 0, pointRadius: 2 },
        { label: "Resoluções", data: resolvidos, borderColor: "#4199ed", backgroundColor: "#4199ed", tension: 0, pointRadius: 2 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true, pointStyle: "line" } } },
      scales: {
        x: { grid: { color: "#303030" } },
        y: { beginAtZero: true, grid: { color: "#303030" } }
      }
    }
  });
}

function criarGraficoCapacidade(equipe) {
  dadosEquipeCapacidade = equipe;
  graficoCapacidade = new Chart(document.getElementById("grafico_capacidade"), {
    type: "bar",
    data: {
      labels: equipe.map((item) => item.responsavel),
      datasets: [
        { label: "Alta e crítica", data: equipe.map((item) => item.chamados_prioridade_alta_ou_critica), backgroundColor: "#ffd000", borderRadius: 3 },
        { label: "Demais prioridades", data: equipe.map((item) => item.chamados_demais_prioridades), backgroundColor: "#555d66", borderRadius: 3 }
      ]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: "#303030" } },
        y: { stacked: true, grid: { display: false }, ticks: { color: "#ddd", font: { size: 10 } } }
      }
    }
  });

  atualizarGraficoCapacidade();
}

function criarGraficoFaixas(faixas) {
  new Chart(document.getElementById("grafico_faixas"), {
    type: "bar",
    data: {
      labels: faixas.map((item) => item.faixa),
      datasets: [
        { label: "Alta e crítica", data: faixas.map((item) => item.prioridade_alta_ou_critica), backgroundColor: "#ffd000", borderRadius: 3 },
        { label: "Demais prioridades", data: faixas.map((item) => item.demais_prioridades), backgroundColor: "#555d66", borderRadius: 3 }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: "#303030" } }
      }
    }
  });
}

function prepararFiltros(equipe) {
  preencherFiltroResponsaveis(equipe);

  document.querySelectorAll("[data-filtro]").forEach((botao) => {
    botao.addEventListener("click", () => {
      filtroSelecionado = botao.dataset.filtro;
      document.querySelectorAll("[data-filtro]").forEach((item) => item.classList.remove("filtro_ativo"));
      botao.classList.add("filtro_ativo");
      mostrarChamados();
    });
  });

  document.getElementById("busca_chamado").addEventListener("input", mostrarChamados);
  document.getElementById("filtro_responsavel").addEventListener("change", (evento) => {
    responsavelSelecionado = evento.target.value;
    mostrarChamados();
  });
  document.getElementById("filtro_usuario_grafico").addEventListener("change", atualizarGraficoCapacidade);
  document.getElementById("botao_so_criticos").addEventListener("click", alternarPrioridadesCriticas);
}

function preencherFiltroResponsaveis(equipe) {
  const filtros = [
    document.getElementById("filtro_responsavel"),
    document.getElementById("filtro_usuario_grafico")
  ];

  filtros.forEach((filtro) => {
    equipe.forEach((pessoa) => {
      const opcao = document.createElement("option");
      opcao.value = pessoa.responsavel;
      opcao.textContent = pessoa.responsavel;
      filtro.appendChild(opcao);
    });
  });
}

function atualizarGraficoCapacidade() {
  if (!graficoCapacidade) return;

  const selecionado = document.getElementById("filtro_usuario_grafico").value;
  const equipeFiltrada = selecionado === "todos"
    ? dadosEquipeCapacidade
    : dadosEquipeCapacidade.filter((pessoa) => pessoa.responsavel === selecionado);

  graficoCapacidade.data.labels = equipeFiltrada.map((pessoa) => pessoa.responsavel);
  graficoCapacidade.data.datasets[0].data = equipeFiltrada.map((pessoa) => pessoa.chamados_prioridade_alta_ou_critica);
  graficoCapacidade.data.datasets[1].data = equipeFiltrada.map((pessoa) => pessoa.chamados_demais_prioridades);
  graficoCapacidade.update();
}

function alternarPrioridadesCriticas() {
  const botao = document.getElementById("botao_so_criticos");
  const mostrarSoAltaECritica = botao.getAttribute("aria-pressed") !== "true";

  botao.setAttribute("aria-pressed", mostrarSoAltaECritica);
  botao.classList.toggle("ativo", mostrarSoAltaECritica);
  graficoCapacidade.data.datasets[1].hidden = mostrarSoAltaECritica;
  graficoCapacidade.update();
}

function mostrarChamados() {
  const busca = document.getElementById("busca_chamado").value.trim().toLowerCase();
  let chamadosFiltrados = dadosDosChamados;

  if (filtroSelecionado === "vencidos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => item.sla_vencido);
  } else if (filtroSelecionado === "criticos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => normalizar(item.prioridade) === "critica");
  } else if (filtroSelecionado === "sem-responsavel") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => item.sem_responsavel);
  }

  if (responsavelSelecionado !== "todos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) =>
      (item.responsavel || "Sem responsável") === responsavelSelecionado
    );
  }

  if (busca) {
    chamadosFiltrados = chamadosFiltrados.filter((item) =>
      (item.chave + " " + item.resumo).toLowerCase().includes(busca)
    );
  }

  atualizarContagemFiltros();
  desenharTabela(chamadosFiltrados);
}

function atualizarContagemFiltros() {
  document.getElementById("filtro_total").textContent = dadosDosChamados.length;
  document.getElementById("filtro_vencidos").textContent =
    dadosDosChamados.filter((item) => item.sla_vencido).length;
  document.getElementById("filtro_criticos").textContent =
    dadosDosChamados.filter((item) => normalizar(item.prioridade) === "critica").length;
  document.getElementById("filtro_sem_responsavel").textContent =
    dadosDosChamados.filter((item) => item.sem_responsavel).length;
  document.getElementById("total_chamados").textContent = dadosDosChamados.length + " chamados no JSON";
}

function desenharTabela(chamados) {
  const corpoTabela = document.getElementById("tabela_chamados");
  const linhas = chamados.map((item) => {
    const responsavel = escaparHtml(item.responsavel || "Sem responsável");
    const classeResponsavel = item.sem_responsavel ? "sem_responsavel" : "";
    const classePrioridade = obterClassePrioridade(item.prioridade);
    const classeStatus = obterClasseStatus(item.status);
    return "<tr>" +
      '<td class="chave_chamado">' + escaparHtml(item.chave) + "</td>" +
      '<td class="resumo_chamado">' + escaparHtml(item.resumo) + "<br><small>" + escaparHtml(item.projeto) + " · " + escaparHtml(item.tipo) + "</small></td>" +
      '<td><span class="tag_prioridade ' + classePrioridade + '">' + escaparHtml(item.prioridade) + "</span></td>" +
      '<td><span class="tag_status ' + classeStatus + '">' + escaparHtml(item.status) + "</span></td>" +
      '<td class="' + classeResponsavel + '">' + responsavel + "</td>" +
      '<td><span class="tag_sla">' + formatarPrazoSla(item) + "</span></td>" +
      "<td>" + item.tempo_desde_ultima_atualizacao_horas + "h</td></tr>";
  });

  corpoTabela.innerHTML = linhas.length
    ? linhas.join("")
    : '<tr><td colspan="7">Nenhum chamado encontrado.</td></tr>';
  document.getElementById("rodape_tabela").textContent =
    "Exibindo " + chamados.length + " de " + dadosDosChamados.length + " chamados · Dados demonstrativos do JIRA";
}

function normalizar(texto) {
  return String(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function obterClassePrioridade(prioridade) {
  const nome = normalizar(prioridade);
  if (nome === "baixa") return "prioridade-baixa";
  if (nome === "media") return "prioridade-media";
  if (nome === "alta") return "prioridade-alta";
  if (nome === "critica") return "prioridade-critica";
  return "";
}

function obterClasseStatus(status) {
  const nome = normalizar(status);
  if (nome.includes("fazer")) return "status-a-fazer";
  if (nome.includes("andamento")) return "status-em-andamento";
  if (nome.includes("resolvido")) return "status-resolvido";
  if (nome.includes("cancelado")) return "status-cancelado";
  return "";
}

function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarPrazoSla(chamado) {
  if (!chamado.sla_vencido) return "No prazo";

  const segundosAtraso = Math.abs(chamado.prazo_sla_em);
  const horas = Math.floor(segundosAtraso / 3600);
  const minutos = Math.floor((segundosAtraso % 3600) / 60);
  return "Vencido há " + horas + "h " + String(minutos).padStart(2, "0") + "min";
}

document.addEventListener("DOMContentLoaded", () => {
  const nome = sessionStorage.getItem("NOME_USUARIO");
  const cargo = sessionStorage.getItem("CARGO_USUARIO");

  if (nome) {
    document.getElementById("nome_usuario").textContent = nome;
    document.getElementById("avatar_usuario").textContent =
      nome.split(" ").map((parte) => parte[0]).slice(0, 2).join("").toUpperCase();
  }
  if (cargo) document.getElementById("cargo_usuario").textContent = cargo;

  document.getElementById("botao_sair").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  document.querySelector(".btn-notificacao").addEventListener("click", () => {
    document.body.classList.toggle("menu-aberto");
  });

  carregarDashboardSuporte();
});
