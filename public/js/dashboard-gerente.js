// ==========================================
// DADOS INICIAIS (MOCK)
// ==========================================
const dadosIniciais = {
  kpis: {
    monitoradas: 12,
    online: "10 / 12",
    alerta: 2,
    offline: 0,
    alertasTotal: 25,
  },
  statusIpc: {
    online: 7,
    alerta: 3,
    offline:2,
  },
  historicoPicos: {
    horas: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
    picosCpu: [48, 62, 94, 73, 89, 55],
    registros: [
      { hora: "14:32:10", processo: "java (extrator)", torre: "Torre 07", pid: "4192", cpu: "94%", ram: "6.2 GB" },
      { hora: "16:15:02", processo: "mysqld", torre: "Torre 03", pid: "1024", cpu: "89%", ram: "4.8 GB" },
      { hora: "13:58:44", processo: "ffmpeg_stream", torre: "Torre 01", pid: "8831", cpu: "85%", ram: "3.1 GB" },
      { hora: "12:04:19", processo: "python_analyzer", torre: "Torre 12", pid: "6720", cpu: "78%", ram: "2.4 GB" },
      { hora: "10:22:30", processo: "docker_engine", torre: "Torre 09", pid: "2201", cpu: "62%", ram: "5.0 GB" }
    ]
  },
  mineradoras: {
    labels: ["Vale", "CSN", "Samarco", "Anglo American"],
    dados: [2, 1, 1, 1],
  },
  torres: {
    labels: [
      "Torre 07 (Vale)",
      "Torre 03 (CSN)",
      "Torre 12 (Samarco)",
      "Torre 01 (Anglo American)",
      "Torre 09 (Vale)",
    ],
    dados: [3, 1, 1, 1, 1],
  },
  alertasRecentes: [
    { 
      data: "14/04/2026 14:32", 
      torre: "Torre 07", 
      mineradora: "Vale", 
      usoCpu: "94%", 
      usoRam: "88%", 
      usoDisco: "76%", 
      status: "CRÍTICO" 
    },
    { 
      data: "14/04/2026 12:50", 
      torre: "Torre 03", 
      mineradora: "CSN", 
      usoCpu: "75%", 
      usoRam: "92%", 
      usoDisco: "65%", 
      status: "CRÍTICO" 
    },
    { 
      data: "14/04/2026 12:17", 
      torre: "Torre 12", 
      mineradora: "Samarco", 
      usoCpu: "81%", 
      usoRam: "68%", 
      usoDisco: "50%", 
      status: "ALERTA" 
    },
    { 
      data: "14/04/2026 10:03", 
      torre: "Torre 01", 
      mineradora: "Anglo American", 
      usoCpu: "62%", 
      usoRam: "71%", 
      usoDisco: "87%", 
      status: "ALERTA" 
    },
    { 
      data: "14/04/2026 09:45", 
      torre: "Torre 09", 
      mineradora: "Vale", 
      usoCpu: "82%", 
      usoRam: "59%", 
      usoDisco: "44%", 
      status: "ALERTA" 
    },
  ]
};

// ==========================================
// FUNÇÕES DE UTILIZADOR E MENU
// ==========================================
function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) return;
  const elNome = document.getElementById("nome_usuario");
  if (elNome) elNome.textContent = nomeUsuario;

  const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO");
  if (!cargoUsuario) return;
  const elCargo = document.getElementById("cargo_usuario");
  if (elCargo) elCargo.textContent = cargoUsuario;
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
  const elAvatar = document.getElementById("avatar_usuario");
  if (elAvatar) elAvatar.textContent = iniciais.join('').toUpperCase();
}

// ==========================================
// FORMATAÇÃO DE CORES (Regra < 70 verde, < 80 amarelo, >= 90 vermelho)
// ==========================================
function formatarUsoComCor(valorStr) {
  const valor = parseInt(valorStr, 10);
  if (isNaN(valor)) return valorStr;

  let classe = "verde";
  if (valor >= 90) {
    classe = "vermelho";
  } else if (valor >= 70) {
    classe = "amarelo";
  }

  return `<span class="tag_uso ${classe}">${valorStr}</span>`;
}

// ==========================================
// CRIAÇÃO DOS GRÁFICOS (Chart.js)
// ==========================================
function criarGraficoStatus(status) {
  const el = document.getElementById("graficoStatus");
  if (!el) return;

  new Chart(el.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Online", "Em alerta", "Offline"],
      datasets: [
        {
          data: [status.online, status.alerta, status.offline],
          backgroundColor: ["#3ddc57", "#ffd741", "#ff4d4d"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      cutout: "75%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    },
  });
}

function criarGraficoMineradoras(mineradoras) {
  const el = document.getElementById("graficoMineradoras");
  if (!el) return;

  new Chart(el.getContext("2d"), {
    type: "bar",
    data: {
      labels: mineradoras.labels,
      datasets: [
        {
          data: mineradoras.dados,
          backgroundColor: "#ffd741",
          borderRadius: 4,
          barThickness: 12,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: "#262626" },
          ticks: { color: "#8f8e8e", stepSize: 1 },
          max: 3,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#ffffff", font: { size: 11 } },
        },
      },
    },
  });
}

function criarGraficoTorres(torres) {
  const el = document.getElementById("graficoTorres");
  if (!el) return;

  new Chart(el.getContext("2d"), {
    type: "bar",
    data: {
      labels: torres.labels,
      datasets: [
        {
          data: torres.dados,
          backgroundColor: "#ffd741",
          borderRadius: 4,
          barThickness: 12,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: "#262626" },
          ticks: { color: "#8f8e8e" },
          max: 3,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#ffffff", font: { size: 11 } },
        },
      },
    },
  });
}

function criarGraficoPicosProcesso(picos) {
  const elementoCanvas = document.getElementById("graficoPicosProcesso");
  if (!elementoCanvas) return;

  const ctx = elementoCanvas.getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: picos.horas,
      datasets: [
        {
          label: "Pico de CPU (%)",
          data: picos.picosCpu,
          borderColor: "#ffd741",
          backgroundColor: "rgba(255, 215, 65, 0.15)",
          borderWidth: 2,
          pointBackgroundColor: "#ffd741",
          pointRadius: 4,
          tension: 0.35,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` Pico: ${context.raw}% CPU`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#262626" },
          ticks: { color: "#8f8e8e" },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "#262626" },
          ticks: {
            color: "#8f8e8e",
            callback: (val) => val + "%"
          },
        },
      },
    },
  });
}

// ==========================================
// RENDERIZAÇÃO DAS TABELAS (Alinhadas com o HTML)
// ==========================================
function renderizarTabelaAlertas(alertas) {
  const corpo = document.getElementById("tabela_alertas_corpo");
  if (!corpo) return;

  corpo.innerHTML = alertas
    .map((item) => {
      let badgeClasse = "normal";
      let icone = "✓";

      const statusUpper = item.status.toUpperCase();

      if (statusUpper === "CRÍTICO" || statusUpper === "CRITICO") {
        badgeClasse = "critico";
        icone = "⚠";
      } else if (statusUpper === "ALERTA") {
        badgeClasse = "alerta";
        icone = "⚠";
      }

      return `
      <tr>
        <td>${item.data}</td>
        <td>${item.torre}</td>
        <td>${item.mineradora}</td>
        <td>${formatarUsoComCor(item.usoCpu)}</td>
        <td>${formatarUsoComCor(item.usoRam)}</td>
        <td>${formatarUsoComCor(item.usoDisco)}</td>
        <td>
          <span class="tag_status ${badgeClasse}">
            <span>${icone}</span> ${item.status}
          </span>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderizarTabelaPicos(registros) {
  const corpo = document.getElementById("tabela_picos_corpo");
  if (!corpo) return;

  corpo.innerHTML = registros
    .map((item) => {
      const valorCpu = parseInt(item.cpu, 10);
      const tagClasse = valorCpu >= 85 ? "alto" : "medio";

      return `
      <tr>
        <td>${item.hora}</td>
        <td><strong>${item.processo}</strong></td>
        <td>${item.torre}</td>
        <td style="color: #888;">${item.pid}</td>
        <td><span class="tag_pico ${tagClasse}">${item.cpu}</span></td>
        <td>${item.ram}</td>
      </tr>
    `;
    })
    .join("");
}

// ==========================================
// CHAMADAS AO BACKEND (MOCK)
// ==========================================
async function carregarDadosDashboard() {
  const fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");
  if (!fkEmpresa) return;

  try {
    const res = await fetch(`/dashboard/visao-executiva?fkEmpresa=${fkEmpresa}`);
    if (res.ok) {
      const dados = await res.json();
      console.log("Dados do backend carregados:", dados);
    }
  } catch (err) {
    console.warn("Rota do backend ainda não configurada, usando dados simulados:", err);
  }
}

// ==========================================
// INICIALIZAÇÃO ÚNICA DA PÁGINA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();
  carregarIniciais();

  // Gráficos
  criarGraficoStatus(dadosIniciais.statusIpc);
  criarGraficoMineradoras(dadosIniciais.mineradoras);
  criarGraficoTorres(dadosInSessions = dadosIniciais.torres); // correção segura
  if (typeof criarGraficoPicosProcesso === "function") {
    criarGraficoPicosProcesso(dadosIniciais.historicoPicos);
  }

  // Tabelas
  renderizarTabelaAlertas(dadosIniciais.alertasRecentes);
  renderizarTabelaPicos(dadosIniciais.historicoPicos.registros);

  // Botão Menu Responsivo (Hambúrguer)
  const botaoMenu = document.querySelector(".btn-notificacao");
  botaoMenu?.addEventListener("click", () => {
    document.body.classList.toggle("menu-aberto");
  });

  // Botão Sair
  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  carregarDadosDashboard();
});