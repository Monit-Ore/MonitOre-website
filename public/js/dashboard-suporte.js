const caminhoDadosSuporte = "./data/modelo_dashboard_suporte.json";
let dadosDosChamados = [];
let filtroSelecionado = "todos";
let responsavelSelecionado = "todos";
let graficoCapacidade = null;
let equipeDoGraficoCapacidade = [];
let dadosQuebrasSla = {};
let quebraSlaSelecionada = "prioridade";
let metaSla = 95;

// Busca os dados demonstrativos que vieram da ETL.
async function carregarDashboardSuporte() {
  const corpoTabela = document.getElementById("tabela_chamados");

  try {
    const resposta = await fetch(caminhoDadosSuporte);
    if (!resposta.ok) throw new Error("Não foi possível carregar o arquivo JSON.");

    const dados = await resposta.json();
    dadosDosChamados = dados.chamados_que_precisam_de_atencao || [];

    mostrarIndicadores(dados);
    prepararQuebrasSla(dados.quebras_sla);
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
  const sla = indicadores.cumprimento_sla;
  const dataAtualizacao = new Date(dados.metadados.extraido_em);
  const horaAtualizacao = dataAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const percentualSla = calcularPercentual(sla.resolvidos_no_prazo, sla.total_elegiveis);
  const variacaoSla = percentualSla - sla.percentual_anterior;
  const elementoVariacao = document.getElementById("variacao_sla");

  metaSla = sla.meta_percentual;

  document.getElementById("data_atualizacao").textContent = "Atualizado às " + horaAtualizacao;
  document.getElementById("chamados_abertos").textContent = indicadores.chamados_abertos;
  document.getElementById("chamados_criticos").textContent = String(indicadores.chamados_criticos).padStart(2, "0");
  document.getElementById("sla_em_risco").textContent = String(indicadores.sla_em_risco).padStart(2, "0") + " chamados";
  document.getElementById("sla_vencido").textContent = String(indicadores.sla_vencido).padStart(2, "0") + " chamados";

  const variacaoAbertos = indicadores.variacao_chamados_abertos;
  const elementoVariacaoAbertos = document.getElementById("variacao_abertos");
  elementoVariacaoAbertos.textContent = formatarVariacaoQuantidade(variacaoAbertos, dados.metadados.periodo_comparacao);
  elementoVariacaoAbertos.className = "kpi_detalhe variacao " + obterClasseVariacaoAbertos(variacaoAbertos);
  document.getElementById("parados_sete_dias").textContent =
    indicadores.chamados_parados_sete_dias + " parados há mais de 7 dias";
  document.getElementById("criticos_sem_responsavel").textContent =
    indicadores.chamados_criticos_sem_responsavel + " sem responsável";
  document.getElementById("criticos_vencidos").textContent =
    indicadores.chamados_criticos_vencidos + " vencidos";
  document.getElementById("risco_proxima_hora").textContent =
    indicadores.sla_vencem_proxima_hora + " vencem na próxima hora";
  document.getElementById("detalhe_vencido").textContent =
    "Mais antigo há " + formatarHorasAtraso(indicadores.sla_vencido_mais_antigo_horas);

  document.getElementById("cumprimento_sla").textContent = percentualSla + "%";
  const diferencaMeta = sla.meta_percentual - percentualSla;
  const distanciaMeta = document.getElementById("distancia_meta_sla");
  distanciaMeta.textContent = diferencaMeta > 0
    ? diferencaMeta + " p.p. abaixo da meta"
    : diferencaMeta < 0
      ? Math.abs(diferencaMeta) + " p.p. acima da meta"
      : "Meta atingida";
  distanciaMeta.className = "sla_distancia_meta " + obterClasseDesempenhoSla(percentualSla, sla.meta_percentual);
  document.getElementById("progresso_meta_sla").style.width = Math.min(percentualSla, 100) + "%";
  document.getElementById("progresso_meta_sla").className = obterClasseDesempenhoSla(percentualSla, sla.meta_percentual);
  document.getElementById("marcador_meta_sla").style.left = Math.min(sla.meta_percentual, 100) + "%";
  document.getElementById("volume_sla").textContent =
    sla.resolvidos_no_prazo + " de " + sla.total_elegiveis + " chamados";
  document.getElementById("meta_sla").textContent =
    "Meta " + sla.meta_percentual + "% · " + dados.metadados.periodo_consultado;
  elementoVariacao.textContent = formatarVariacaoSla(variacaoSla, dados.metadados.periodo_comparacao);
  elementoVariacao.className = "variacao " + obterClasseVariacaoSla(variacaoSla);

  const prioridadesSla = (dados.quebras_sla && dados.quebras_sla.prioridade) || [];
  const piorPrioridadeSla = prioridadesSla
    .map((item) => ({ ...item, percentual: calcularPercentual(item.resolvidos_no_prazo, item.total_elegiveis) }))
    .sort((a, b) => a.percentual - b.percentual)[0];
  document.getElementById("periodo_sla").textContent =
    dados.metadados.periodo_consultado + " · comparação com " + dados.metadados.periodo_comparacao;
  document.getElementById("periodo_tendencia_sla").textContent = dados.metadados.periodo_consultado;
  document.getElementById("meta_quebra_sla").textContent = piorPrioridadeSla
    ? "Meta " + sla.meta_percentual + "% · pior resultado: " + piorPrioridadeSla.categoria + " (" + piorPrioridadeSla.percentual + "%)"
    : "Meta " + sla.meta_percentual + "% · abaixo da meta aparece em atenção";
  document.getElementById("texto_aviso_sla").textContent =
    (indicadores.sla_vencido + indicadores.sla_em_risco) +
    " chamados abertos precisam de atenção. " + indicadores.sla_vencido + " vencidos e " +
    indicadores.sla_em_risco + " em risco não entram no cálculo de cumprimento do SLA.";
}

function calcularPercentual(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function formatarVariacaoQuantidade(variacao, periodoComparacao) {
  if (variacao > 0) return "↑ " + variacao + " vs. " + periodoComparacao;
  if (variacao < 0) return "↓ " + Math.abs(variacao) + " vs. " + periodoComparacao;
  return "Estável vs. " + periodoComparacao;
}

function obterClasseVariacaoAbertos(variacao) {
  if (variacao > 0) return "negativa";
  if (variacao < 0) return "positiva";
  return "neutra";
}

function formatarHorasAtraso(horas) {
  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  if (dias && horasRestantes) return dias + "d " + horasRestantes + "h";
  if (dias) return dias + "d";
  return horas + "h";
}

function formatarVariacaoSla(variacao, periodoComparacao) {
  if (variacao > 0) return "↑ " + variacao + " p.p. vs. " + periodoComparacao;
  if (variacao < 0) return "↓ " + Math.abs(variacao) + " p.p. vs. " + periodoComparacao;
  return "Estável vs. " + periodoComparacao;
}

function obterClasseVariacaoSla(variacao) {
  if (variacao > 0) return "positiva";
  if (variacao < 0) return "negativa";
  return "neutra";
}

function obterClasseDesempenhoSla(percentual, meta) {
  if (percentual >= meta) return "sla-bom";
  if (meta - percentual <= 10) return "sla-atencao";
  return "sla-critico";
}

function prepararQuebrasSla(quebras) {
  dadosQuebrasSla = quebras || {};

  document.querySelectorAll(".filtro_quebra").forEach((botao) => {
    botao.addEventListener("click", () => {
      quebraSlaSelecionada = botao.dataset.quebra;
      document.querySelectorAll(".filtro_quebra").forEach((item) => {
        item.classList.remove("ativo");
        item.setAttribute("aria-pressed", "false");
      });
      botao.classList.add("ativo");
      botao.setAttribute("aria-pressed", "true");
      desenharQuebrasSla();
    });
  });

  desenharQuebrasSla();
}

function desenharQuebrasSla() {
  const itens = dadosQuebrasSla[quebraSlaSelecionada] || [];
  const lista = document.getElementById("lista_quebras_sla");

  lista.innerHTML = itens.map((item) => {
    const percentual = calcularPercentual(item.resolvidos_no_prazo, item.total_elegiveis);
    const classeDesempenho = obterClasseDesempenhoSla(percentual, metaSla);

    return '<div class="quebra_item">' +
      '<div class="quebra_cabecalho"><span>' + escaparHtml(item.categoria) + '</span>' +
      '<strong class="' + classeDesempenho + '">' + percentual + '%</strong></div>' +
      '<div class="quebra_barra"><span class="' + classeDesempenho + '" style="width:' + percentual + '%"></span></div>' +
      '<div class="quebra_volume">' + item.resolvidos_no_prazo + " de " + item.total_elegiveis +
      " chamados · meta " + metaSla + "%</div></div>";
  }).join("");

  document.getElementById("total_quebra_sla").textContent =
    itens.reduce((soma, item) => soma + item.resolvidos_no_prazo, 0) + " de " +
    itens.reduce((soma, item) => soma + item.total_elegiveis, 0);
}

function criarGraficos(dados) {
  if (typeof Chart === "undefined") return;

  Chart.defaults.color = "#999999";
  Chart.defaults.font.family = "Barlow, Segoe UI, sans-serif";
  criarGraficoTendencia(dados.serie_temporal);
  criarGraficoSla(dados.tendencia_sla, dados.indicadores.cumprimento_sla.meta_percentual);
  criarGraficoCapacidade(dados.capacidade_da_equipe);
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

function criarGraficoSla(tendencia, meta) {
  const pontos = tendencia.map((item) =>
    new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  );
  const percentuais = tendencia.map((item) => item.percentual);
  const media = Math.round(percentuais.reduce((soma, valor) => soma + valor, 0) / percentuais.length);

  document.getElementById("media_sla").textContent = "Média do período: " + media + "%";

  new Chart(document.getElementById("grafico_sla"), {
    type: "line",
    data: {
      labels: pontos,
      datasets: [
        {
          label: "Cumprimento",
          data: percentuais,
          borderColor: "#ffd000",
          backgroundColor: "rgba(255, 208, 0, 0.12)",
          fill: true,
          tension: 0.25,
          pointRadius: 3
        },
        {
          label: "Meta " + meta + "%",
          data: tendencia.map(() => meta),
          borderColor: "#ff5555",
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true, pointStyle: "line" } },
        tooltip: {
          callbacks: {
            label: (contexto) => {
              if (contexto.datasetIndex === 1) return "Meta: " + contexto.parsed.y + "%";
              const ponto = tendencia[contexto.dataIndex];
              return "Cumprimento: " + contexto.parsed.y + "% · " +
                ponto.resolvidos_no_prazo + " de " + ponto.total_elegiveis + " chamados";
            }
          }
        }
      },
      scales: {
        x: { grid: { color: "#303030" } },
        y: {
          min: 0,
          max: 100,
          grid: { color: "#303030" },
          ticks: { callback: (valor) => valor + "%" }
        }
      }
    }
  });
}

function criarGraficoCapacidade(equipe) {
  equipeDoGraficoCapacidade = equipe;
  graficoCapacidade = new Chart(document.getElementById("grafico_capacidade"), {
    type: "bar",
    data: {
      labels: equipe.map((item) => item.responsavel),
      datasets: [
        { label: "Crítica", data: equipe.map((item) => item.chamados_prioridade_critica), backgroundColor: "#ff5555", borderRadius: 3 },
        { label: "Alta", data: equipe.map((item) => item.chamados_prioridade_alta), backgroundColor: "#ffd000", borderRadius: 3 },
        { label: "Demais prioridades", data: equipe.map((item) => item.chamados_demais_prioridades), backgroundColor: "#555d66", borderRadius: 3 }
      ]
    },
    options: {
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: "#303030" } },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: (context) =>
              equipe[context.index]?.responsavel === "Sem responsável" ? "#ffd000" : "#ddd",
            font: { size: 10 }
          }
        }
      }
    }
  });

}

function prepararFiltros(equipe) {
  preencherFiltroResponsaveis(equipe);

  document.querySelectorAll(".filtros_tabela [data-filtro]").forEach((botao) => {
    botao.addEventListener("click", () => aplicarFiltroTabela(botao.dataset.filtro));
  });

  document.getElementById("busca_chamado").addEventListener("input", mostrarChamados);
  document.getElementById("filtro_responsavel").addEventListener("change", (evento) => {
    responsavelSelecionado = evento.target.value;
    mostrarChamados();
  });
  document.getElementById("botao_so_criticos").addEventListener("click", alternarPrioridadesCriticas);
  document.getElementById("botao_ver_fora_prazo").addEventListener("click", () => aplicarFiltroTabela("vencidos", true));
  document.getElementById("link_aviso_sla").addEventListener("click", (evento) => {
    evento.preventDefault();
    aplicarFiltroTabela("vencidos", true);
  });
}

function aplicarFiltroTabela(filtro, rolarParaTabela = false) {
  filtroSelecionado = filtro;
  document.querySelectorAll(".filtros_tabela [data-filtro]").forEach((item) => item.classList.remove("filtro_ativo"));

  const botaoFiltro = document.querySelector('.filtros_tabela [data-filtro="' + filtro + '"]');
  if (botaoFiltro) botaoFiltro.classList.add("filtro_ativo");

  mostrarChamados();

  if (rolarParaTabela) {
    document.getElementById("chamados_atencao").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function preencherFiltroResponsaveis(equipe) {
  const filtro = document.getElementById("filtro_responsavel");
  const responsaveis = equipe.map((pessoa) => pessoa.responsavel);

  dadosDosChamados.forEach((chamado) => {
    responsaveis.push(chamado.responsavel || "Sem responsável");
  });

  [...new Set(responsaveis)].forEach((responsavel) => {
    const opcao = document.createElement("option");
    opcao.value = responsavel;
    opcao.textContent = responsavel;
    filtro.appendChild(opcao);
  });
}

function alternarPrioridadesCriticas() {
  const botao = document.getElementById("botao_so_criticos");
  const mostrarSoAltaECritica = botao.getAttribute("aria-pressed") !== "true";

  botao.setAttribute("aria-pressed", mostrarSoAltaECritica);
  botao.classList.toggle("ativo", mostrarSoAltaECritica);

  const equipeVisivel = mostrarSoAltaECritica
    ? equipeDoGraficoCapacidade.filter((item) =>
        item.chamados_prioridade_critica + item.chamados_prioridade_alta > 0
      )
    : equipeDoGraficoCapacidade;

  graficoCapacidade.data.labels = equipeVisivel.map((item) => item.responsavel);
  graficoCapacidade.data.datasets[0].data = equipeVisivel.map((item) => item.chamados_prioridade_critica);
  graficoCapacidade.data.datasets[1].data = equipeVisivel.map((item) => item.chamados_prioridade_alta);
  graficoCapacidade.data.datasets[2].hidden = mostrarSoAltaECritica;
  graficoCapacidade.update();
}

function mostrarChamados() {
  const busca = document.getElementById("busca_chamado").value.trim().toLowerCase();
  let chamadosFiltrados = dadosDosChamados;

  if (filtroSelecionado === "vencidos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => item.sla_vencido);
  } else if (filtroSelecionado === "em-risco") {
    chamadosFiltrados = chamadosFiltrados.filter(estaEmRisco);
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
  document.getElementById("filtro_em_risco").textContent =
    dadosDosChamados.filter(estaEmRisco).length;
  document.getElementById("filtro_criticos").textContent =
    dadosDosChamados.filter((item) => normalizar(item.prioridade) === "critica").length;
  document.getElementById("filtro_sem_responsavel").textContent =
    dadosDosChamados.filter((item) => item.sem_responsavel).length;
  document.getElementById("total_chamados").textContent = dadosDosChamados.length + " na amostra";
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
      '<td><span class="tag_sla ' + (item.sla_vencido ? "sla-vencido" : estaEmRisco(item) ? "sla-risco" : "") + '">' + formatarPrazoSla(item) + "</span></td>" +
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
  if (!chamado.sla_vencido) {
    if (!estaEmRisco(chamado)) return "No prazo";

    const minutosRestantes = Math.ceil(chamado.prazo_sla_em / 60);
    const horas = Math.floor(minutosRestantes / 60);
    const minutos = minutosRestantes % 60;
    return horas ? "Vence em " + horas + "h " + String(minutos).padStart(2, "0") + "min" : "Vence em " + minutos + "min";
  }

  const segundosAtraso = Math.abs(chamado.prazo_sla_em);
  const horas = Math.floor(segundosAtraso / 3600);
  const minutos = Math.floor((segundosAtraso % 3600) / 60);
  return "Vencido há " + horas + "h " + String(minutos).padStart(2, "0") + "min";
}

function estaEmRisco(chamado) {
  return !chamado.sla_vencido && chamado.prazo_sla_em > 0 && chamado.prazo_sla_em <= 4 * 60 * 60;
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
