import { estado } from "./suporte-estado.js";

// Sem destruir, cada recarregamento deixaria um gráfico antigo preso no canvas.
function destruirGraficos() {
  [estado.graficoTendencia, estado.graficoSla, estado.graficoCapacidade].forEach((grafico) => {
    if (grafico && typeof grafico.destroy === "function") grafico.destroy();
  });

  estado.graficoTendencia = null;
  estado.graficoSla = null;
  estado.graficoCapacidade = null;
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

  estado.graficoTendencia = new Chart(document.getElementById("grafico_tendencia"), {
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

  estado.graficoSla = new Chart(document.getElementById("grafico_sla"), {
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
  estado.equipeDoGraficoCapacidade = equipe;
  estado.graficoCapacidade = new Chart(document.getElementById("grafico_capacidade"), {
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

function alternarPrioridadesCriticas() {
  const botao = document.getElementById("botao_so_criticos");
  const mostrarSoAltaECritica = botao.getAttribute("aria-pressed") !== "true";

  botao.setAttribute("aria-pressed", mostrarSoAltaECritica);
  botao.classList.toggle("ativo", mostrarSoAltaECritica);

  const equipeVisivel = mostrarSoAltaECritica
    ? estado.equipeDoGraficoCapacidade.filter((item) =>
        item.chamados_prioridade_critica + item.chamados_prioridade_alta > 0
      )
    : estado.equipeDoGraficoCapacidade;

  estado.graficoCapacidade.data.labels = equipeVisivel.map((item) => item.responsavel);
  estado.graficoCapacidade.data.datasets[0].data = equipeVisivel.map((item) => item.chamados_prioridade_critica);
  estado.graficoCapacidade.data.datasets[1].data = equipeVisivel.map((item) => item.chamados_prioridade_alta);
  estado.graficoCapacidade.data.datasets[2].hidden = mostrarSoAltaECritica;
  estado.graficoCapacidade.update();
}

export {
  destruirGraficos,
  criarGraficos,
  alternarPrioridadesCriticas,
};
