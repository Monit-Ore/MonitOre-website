// É SO TROCAR OS DADOS AQUI PRA DASHBOARD COM DADOS REAIS DO BACK

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
      iniciais.push(nomeUsuario[i + 1]);
      break;
    }
  }
  avatar_usuario.textContent = iniciais.join('');
}

const dadosIniciais = {
  
  kpis: {
    monitoradas: 12,
    online: "10 / 12",
    alerta: 2,
    offline: 0,
    alertasTotal: 7,
  },
  statusIpc: {
    online: 10,
    alerta: 2,
    offline: 0,
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
    dados: [10, 7, 5, 2, 1],
  },
  alertasRecentes: [
    { data: "14/04/2025 14:32", torre: "Torre 07", mineradora: "Vale", componente: "CPU", valor: "94%", limite: "90%", status: "ALERTA" },
    { data: "14/04/2025 12:50", torre: "Torre 03", mineradora: "CSN", componente: "RAM", valor: "92%", limite: "90%", status: "ALERTA" },
    { data: "14/04/2025 12:17", torre: "Torre 12", mineradora: "Samarco", componente: "CPU", valor: "81%", limite: "90%", status: "NORMAL" },
    { data: "14/04/2025 10:03", torre: "Torre 01", mineradora: "Anglo American", componente: "Disco", valor: "87%", limite: "90%", status: "NORMAL" },
    { data: "14/04/2025 09:45", torre: "Torre 09", mineradora: "Vale", componente: "CPU", valor: "82%", limite: "85%", status: "NORMAL" },
  ]

  
};

// 1. GRAFICO ROSCA
function criarGraficoStatus(status) {
  const ctx = document.getElementById("graficoStatus").getContext("2d");
  new Chart(ctx, {
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

// 2. BARRAS HORIZONTAIS: ALERTA por mineradora
function criarGraficoMineradoras(mineradoras) {
  const ctx = document.getElementById("graficoMineradoras").getContext("2d");
  new Chart(ctx, {
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
          max: 2.5,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#ffffff", font: { size: 11 } },
        },
      },
    },
  });
}

// 3. BARRAS HORIZONTAIS: ALERTA por torre
function criarGraficoTorres(torres) {
  const ctx = document.getElementById("graficoTorres").getContext("2d");
  new Chart(ctx, {
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
          max: 12,
        },
        y: {
          grid: { display: false },
          ticks: { color: "#ffffff", font: { size: 11 } },
        },
      },
    },
  });
}

// 4. PREENCHER TABELA DE ALERTAS
function renderizarTabelaAlertas(alertas) {
  const corpo = document.getElementById("tabela_alertas_corpo");
  corpo.innerHTML = alertas
    .map((item) => {
      const isAlerta = item.status === "ALERTA";
      const badgeClasse = isAlerta ? "alerta" : "normal";
      const icone = isAlerta ? "⚠" : "✓";

      return `
      <tr>
        <td>${item.data}</td>
        <td>${item.torre}</td>
        <td>${item.mineradora}</td>
        <td>${item.componente}</td>
        <td>${item.valor}</td>
        <td>${item.limite}</td>
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

// 5. QUANDO FOR CRIAR AS ROTAS NO BACKEND, PODEMOS USAR ESSA FUNÇÃO PARA CARREGAR OS DADOS REAIS
async function carregarDadosDashboard() {
  const fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");
  if (!fkEmpresa) return;

  try {
    const res = await fetch(`/dashboard/visao-executiva?fkEmpresa=${fkEmpresa}`);
    if (res.ok) {
      const dados = await res.json();
      // ATUALIZAR OS GRÁFICOS E TABEL
      console.log("Dados do backend carregados:", dados);
    }
  } catch (err) {
    console.warn("Rota do backend ainda não configurada, usando dados do Figma:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {

  carregarUsuarioMenu();
  carregarIniciais();
  criarGraficoStatus(dadosIniciais.statusIpc);
  criarGraficoMineradoras(dadosIniciais.mineradoras);
  criarGraficoTorres(dadosIniciais.torres);
  renderizarTabelaAlertas(dadosIniciais.alertasRecentes);

  
  criarGraficoPicosProcesso(dadosIniciais.historicoPicos);
  renderizarTabelaPicos(dadosIniciais.historicoPicos.registros);

  // Logout
  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";

    const botaoMenu = document.querySelector(".btn-notificacao");

botaoMenu?.addEventListener("click", () =>
  document.body.classList.toggle("menu-aberto"),
);
  });

  
  carregarDadosDashboard();
});

// 6. GRÁFICO DE PICOS DE PROCESSO
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

// 7. PREENCHER TABELA DE HISTÓRICO DE PICOS
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


//BOTAO SAIR    
document.addEventListener("DOMContentLoaded", () => {
 
  const botaoMenu = document.querySelector(".btn-notificacao");

  botaoMenu?.addEventListener("click", () =>
    document.body.classList.toggle("menu-aberto")
  );

});