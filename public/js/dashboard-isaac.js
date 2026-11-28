/**
 * MonitOre - Dashboard Preditiva de Processos (Beeling)
 * Script dinâmico individual do integrante Isaac
 */

// ==========================================
// ESTADO GLOBAL DA DASHBOARD
// ==========================================
const estado = {
  dados: null,
  recursoAtivo: "CPU",
  historico: "24h",
  horizonte: "6h",
  idTorre: null,
  carregando: false,
  timerAutoRefresh: null
};

let chartPrincipal = null;
let chartProcessos = null;

// Formatadores de data e hora estritamente em America/Sao_Paulo (UTC-3)
const FORMATADOR_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

const FORMATADOR_HORA_CURTA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatarHoraSp(data, comSegundos = false) {
  if (!data) return "--:--";
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return "--:--";
  return comSegundos ? FORMATADOR_HORA_SP.format(d) : FORMATADOR_HORA_CURTA_SP.format(d);
}

// Mapa de ícones e descrições amigáveis por nome de processo
const MAPA_PROCESSOS = {
  mysqld: { icone: "fa-database", descricao: "Banco de dados relacional" },
  mysql: { icone: "fa-database", descricao: "Serviço de banco de dados" },
  java: { icone: "fa-gears", descricao: "Aplicação Java / Extração" },
  docker: { icone: "fa-box", descricao: "Containers Docker" },
  dockerd: { icone: "fa-box", descricao: "Daemon do Docker" },
  python: { icone: "fa-code", descricao: "Script de telemetria / automação" },
  python3: { icone: "fa-code", descricao: "Pipeline de dados" },
  node: { icone: "fa-server", descricao: "Servidor web Node.js" },
  nginx: { icone: "fa-network-wired", descricao: "Servidor Proxy / Nginx" },
  svchost: { icone: "fa-shield-halved", descricao: "Processo Host de Serviços" },
  system: { icone: "fa-microchip", descricao: "Núcleo do Sistema Operacional" },
  explorer: { icone: "fa-folder-open", descricao: "Gerenciador do Sistema" }
};

function obterMetaProcesso(nome) {
  const chave = (nome || "").toLowerCase().trim();
  for (const [termo, meta] of Object.entries(MAPA_PROCESSOS)) {
    if (chave.includes(termo)) {
      return meta;
    }
  }
  return {
    icone: "fa-microchip",
    descricao: "Processo do sistema industrial"
  };
}

// ==========================================
// PLUGIN DE LINHA DE LIMITE E MARCADOR "AGORA"
// ==========================================
const pluginReferenciaBeeling = {
  id: "pluginReferenciaBeeling",
  afterDatasetsDraw(chart, _args, pluginOpts) {
    if (chart.canvas.id !== "graficoProjecaoPrincipal") return;

    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x || !scales.y) return;

    ctx.save();

    // Linha horizontal de limite operacional
    if (typeof pluginOpts.limite === "number") {
      const yLimite = scales.y.getPixelForValue(pluginOpts.limite);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255, 77, 77, 0.45)";
      ctx.lineWidth = 1;
      ctx.moveTo(chartArea.left, yLimite);
      ctx.lineTo(chartArea.right, yLimite);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 115, 115, 0.85)";
      ctx.font = "600 10px Barlow, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Limite ${pluginOpts.limite}%`, chartArea.right - 6, yLimite - 4);
    }

    // Linha vertical "Agora" no índice dinâmico retornado pelo backend
    const idxAgora = typeof pluginOpts.idxAgora === "number" ? pluginOpts.idxAgora : 0;
    const xAgora = scales.x.getPixelForValue(idxAgora);

    if (xAgora >= chartArea.left && xAgora <= chartArea.right) {
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.moveTo(xAgora, chartArea.top);
      ctx.lineTo(xAgora, chartArea.bottom);
      ctx.stroke();

      // Badge "Agora"
      ctx.setLineDash([]);
      const labelW = 40;
      const labelH = 16;
      const labelX = xAgora - labelW / 2;
      const labelY = chartArea.top - 2;

      ctx.fillStyle = "#2b2b2b";
      ctx.fillRect(labelX, labelY, labelW, labelH);
      ctx.strokeStyle = "#525252";
      ctx.strokeRect(labelX, labelY, labelW, labelH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 10px Barlow, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Agora", xAgora, labelY + 11);
    }

    ctx.restore();
  }
};

// ==========================================
// DADOS DO USUÁRIO E SESSÃO (SESSION STORAGE)
// ==========================================
function pegarUsuario() {
  return {
    id: sessionStorage.getItem("ID_USUARIO"),
    nome: sessionStorage.getItem("NOME_USUARIO") || "",
    email: sessionStorage.getItem("EMAIL_USUARIO") || "",
    cargo: sessionStorage.getItem("CARGO_USUARIO") || "",
    empresa: sessionStorage.getItem("EMPRESA_USUARIO") || "",
    mineradora: sessionStorage.getItem("MINERADORA_USUARIO") || "",
    fkEmpresa: sessionStorage.getItem("FK_EMPRESA_USUARIO"),
    idTorre: sessionStorage.getItem("ID_TORRE_SELECIONADA")
  };
}

function validarSessao() {
  const usuario = pegarUsuario();
  if (!usuario.id && !usuario.nome && !usuario.email) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

function carregarPerfilUsuario() {
  const usuario = pegarUsuario();
  const nome = usuario.nome.trim();
  const cargo = usuario.cargo.trim();

  const nomeEl = document.getElementById("nome_usuario");
  const cargoEl = document.getElementById("cargo_usuario");
  const avatarEl = document.getElementById("avatar_usuario");

  if (nomeEl) nomeEl.textContent = nome || "Usuário";
  if (cargoEl) cargoEl.textContent = cargo || "Operador";

  if (avatarEl) {
    const iniciais = nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]);
    avatarEl.textContent = iniciais.join("").toUpperCase() || "US";
  }
}

function abrirPerfilUsuario() {
  window.location.href = "/meu_perfil.html";
}

function limparSessao() {
  if (estado.timerAutoRefresh) {
    clearInterval(estado.timerAutoRefresh);
  }
  sessionStorage.clear();
  window.location.href = "/login.html";
}

// ==========================================
// CONTROLE DE ESTADOS DA UI (LOADING / ERRO / VAZIO / FONTE INDISPONÍVEL)
// ==========================================
function exibirEstadoFeedback(tipo, titulo, mensagem, mostrarBotao = false) {
  const container = document.getElementById("estado_feedback");
  const conteudoDash = document.getElementById("conteudo_dashboard");
  const icone = document.getElementById("estado_feedback_icone");
  const tituloEl = document.getElementById("estado_feedback_titulo");
  const descEl = document.getElementById("estado_feedback_desc");
  const btnTentar = document.getElementById("btn_tentar_novamente");

  if (!container) return;

  container.classList.remove("oculto");
  if (conteudoDash && tipo !== "carregando") {
    conteudoDash.style.display = "none";
  }

  icone.className = "estado_feedback_icone";
  if (tipo === "carregando") {
    icone.classList.add("fa-solid", "fa-spinner", "fa-spin");
  } else if (tipo === "erro" || tipo === "fonteIndisponivel") {
    icone.classList.add("fa-solid", "fa-triangle-exclamation", "erro");
  } else if (tipo === "aguardandoGold") {
    icone.classList.add("fa-solid", "fa-clock-rotate-left");
  } else {
    icone.classList.add("fa-solid", "fa-circle-info");
  }

  tituloEl.textContent = titulo;
  descEl.textContent = mensagem;

  if (btnTentar) {
    btnTentar.style.display = mostrarBotao ? "inline-flex" : "none";
  }
}

function ocultarEstadoFeedback() {
  const container = document.getElementById("estado_feedback");
  const conteudoDash = document.getElementById("conteudo_dashboard");
  if (container) container.classList.add("oculto");
  if (conteudoDash) conteudoDash.style.display = "";
}

// ==========================================
// CONSUMO DA API E CARREGAMENTO DE DADOS
// ==========================================
async function carregarTorres() {
  const usuario = pegarUsuario();
  const seletor = document.getElementById("seletor_torre");
  if (!seletor) return;

  try {
    const fkEmpresa = usuario.fkEmpresa || 1;
    const idUsuario = usuario.id || 1;
    const res = await fetch(`/torres/listarTorres?fkEmpresa=${fkEmpresa}&idUsuario=${idUsuario}`);

    if (!res.ok) {
      throw new Error(`Erro ao carregar torres (${res.status})`);
    }

    const grupos = await res.json();
    seletor.innerHTML = "";

    let encontrouTorreSalva = false;
    const torreSalva = sessionStorage.getItem("ID_TORRE_SELECIONADA");
    let primeiraTorreId = null;

    grupos.forEach((grupo) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = grupo.mineradora;

      grupo.torres.forEach((torre) => {
        if (!primeiraTorreId) primeiraTorreId = torre.id_torre;

        const option = document.createElement("option");
        option.value = torre.id_torre;
        option.textContent = `Torre ${torre.codigo} - ${grupo.mineradora}`;

        if (String(torre.id_torre) === String(torreSalva)) {
          option.selected = true;
          encontrouTorreSalva = true;
        }

        optgroup.appendChild(option);
      });

      seletor.appendChild(optgroup);
    });

    if (encontrouTorreSalva) {
      estado.idTorre = torreSalva;
    } else if (primeiraTorreId) {
      estado.idTorre = primeiraTorreId;
      seletor.value = primeiraTorreId;
      sessionStorage.setItem("ID_TORRE_SELECIONADA", primeiraTorreId);
    } else {
      estado.idTorre = 1;
    }
  } catch (erro) {
    console.error("Falha ao listar torres:", erro);
    seletor.innerHTML = `<option value="${sessionStorage.getItem("ID_TORRE_SELECIONADA") || 1}">Torre 01</option>`;
    estado.idTorre = sessionStorage.getItem("ID_TORRE_SELECIONADA") || 1;
  }
}

async function carregarDados() {
  if (estado.carregando) return;
  estado.carregando = true;

  const usuario = pegarUsuario();
  const idUsuario = usuario.id || 1;
  const idTorre = estado.idTorre || sessionStorage.getItem("ID_TORRE_SELECIONADA") || 1;

  const bannerDef = document.getElementById("banner_defasagem");
  if (bannerDef) bannerDef.classList.add("oculto");

  exibirEstadoFeedback(
    "carregando",
    "Carregando dados preditivos...",
    "Consultando métricas da camada Gold e aplicando algoritmos de projeção."
  );

  try {
    const url = `/preditiva/${idTorre}?historico=${estado.historico}&horizonte=${estado.horizonte}&idUsuario=${idUsuario}`;
    const resposta = await fetch(url);

    if (resposta.status === 503) {
      exibirEstadoFeedback(
        "fonteIndisponivel",
        "Fonte de telemetria indisponível (503)",
        "Não foi possível obter os dados da camada Gold no momento. Tente novamente em instantes.",
        true
      );
      return;
    }

    if (resposta.status === 403) {
      exibirEstadoFeedback(
        "erro",
        "Acesso negado (403)",
        "Seu usuário não possui permissão para visualizar a telemetria desta torre.",
        false
      );
      return;
    }

    if (resposta.status === 404) {
      exibirEstadoFeedback(
        "erro",
        "Torre não encontrada (404)",
        "A torre selecionada ou o PC Industrial vinculado não foram encontrados no banco.",
        false
      );
      return;
    }

    if (!resposta.ok) {
      throw new Error(`Erro na API (${resposta.status})`);
    }

    const dados = await resposta.json();

    if (dados.semDados) {
      const tituloSemDados = dados.aguardandoGold
        ? "Aguardando Camada Gold (EC2)"
        : "Sem capturas de telemetria";
      const descSemDados = dados.mensagem || "Aguardando tratamento dos dados vindos da EC2 (Bucket Gold) em formato JSON para aplicar os gráficos e projeções da dashboard.";

      exibirEstadoFeedback("aguardandoGold", tituloSemDados, descSemDados, false);
      atualizarCabecalho(dados.torre);
      return;
    }

    ocultarEstadoFeedback();
    estado.dados = dados;

    // Gerenciamento de telemetria defasada com exibição mantida dos últimos dados
    if (dados.dadosDefasados && bannerDef) {
      bannerDef.classList.remove("oculto");
      const textoDef = document.getElementById("texto_defasagem");
      if (textoDef) {
        const horaStr = formatarHoraSp(dados.torre.ultimaTelemetria, false);
        const minutosAtras = Math.max(1, Math.round((dados.idadeTelemetriaSegundos || 0) / 60));
        textoDef.textContent = `Última telemetria recebida às ${horaStr} (há ${minutosAtras} min). Exibindo dados da última captura válida.`;
      }
    } else if (bannerDef) {
      bannerDef.classList.add("oculto");
    }

    renderizarTudo();
  } catch (erro) {
    console.error("Erro ao carregar dados da dashboard:", erro);
    exibirEstadoFeedback(
      "erro",
      "Não foi possível carregar os dados",
      "Verifique sua conexão ou se a fonte de telemetria está disponível.",
      true
    );
  } finally {
    estado.carregando = false;
  }
}

// ==========================================
// RENDERIZAÇÃO GERAL DA DASHBOARD
// ==========================================
function renderizarTudo() {
  if (!estado.dados) return;

  atualizarCabecalho(estado.dados.torre);
  atualizarKpis(estado.dados.kpis);
  renderizarSaturacao(estado.dados.saturacao);
  renderizarGraficos(estado.recursoAtivo);
  renderizarTabelaProcessos();
  renderizarBannersInferiores(estado.dados.saturacao);
}

function atualizarCabecalho(torre) {
  if (!torre) return;

  const breadcrumbEl = document.getElementById("breadcrumb_nome_torre");
  if (breadcrumbEl) {
    breadcrumbEl.textContent = torre.nome || `Torre ${torre.id}`;
  }

  const metaEl = document.getElementById("meta_telemetria");
  if (metaEl) {
    const horaFormatada = formatarHoraSp(torre.ultimaTelemetria, true);
    metaEl.textContent = `${torre.hostname || "PC-INDUSTRIAL"} · Telemetria ${horaFormatada} · Previsão ${horaFormatada}`;
  }

  const badgeGold = document.getElementById("badge_fonte_gold");
  if (badgeGold) {
    if (estado.dados && estado.dados.fonte) {
      badgeGold.style.display = "inline-flex";
      const tipoFonte = (estado.dados.fonte.tipo || "").toUpperCase();
      badgeGold.title = `Origem: ${tipoFonte} (${estado.dados.fonte.chave || estado.dados.fonte.bucket || "Gold"})`;
    } else {
      badgeGold.style.display = "none";
    }
  }
}

function atualizarKpis(kpis) {
  if (!kpis) return;

  // Processos
  const proc = kpis.processos;
  const procVal = document.getElementById("kpi_processos_valor");
  const procBadge = document.getElementById("kpi_processos_badge");
  const procMedia = document.getElementById("kpi_processos_media");
  const procPico = document.getElementById("kpi_processos_pico");
  const procVar = document.getElementById("kpi_processos_variacao");

  if (procVal) procVal.textContent = proc.atual;
  if (procBadge) procBadge.textContent = `${proc.variacaoPct >= 0 ? "+" : ""}${proc.variacaoPct}% na janela`;
  if (procMedia) procMedia.textContent = `Média ${proc.media}`;
  if (procPico) procPico.textContent = `Pico ${proc.pico}`;
  if (procVar) procVar.textContent = `Variação ${proc.variacaoPct >= 0 ? "+" : ""}${proc.variacaoPct}%`;

  // CPU
  const cpu = kpis.CPU;
  const cpuVal = document.getElementById("kpi_cpu_valor");
  const cpuBadge = document.getElementById("kpi_cpu_badge");
  const cpuStatus = document.getElementById("kpi_cpu_status_texto");
  const cpuPonto = document.getElementById("kpi_cpu_ponto");
  const cpuMedia = document.getElementById("kpi_cpu_media");
  const cpuPico = document.getElementById("kpi_cpu_pico");
  const cpuLimite = document.getElementById("kpi_cpu_limite");

  if (cpuVal) cpuVal.textContent = `${cpu.atual}%`;
  if (cpuMedia) cpuMedia.textContent = `Média ${cpu.media}%`;
  if (cpuPico) cpuPico.textContent = `Pico ${cpu.pico}%`;
  if (cpuLimite) cpuLimite.textContent = `Limite ${cpu.atencao}%`;

  if (cpuBadge && cpuStatus) {
    cpuBadge.className = `badge_status_kpi ${cpu.status === "normal" ? "normal" : cpu.status === "atencao" ? "acima" : "critico"}`;
    cpuStatus.textContent = cpu.status === "normal" ? "Normal" : cpu.status === "atencao" ? "Atenção" : "Crítico";
    if (cpuPonto) {
      cpuPonto.style.backgroundColor = cpu.status === "normal" ? "var(--verde)" : cpu.status === "atencao" ? "var(--amarelo)" : "var(--vermelho)";
    }
  }

  // RAM
  const ram = kpis.RAM;
  const ramVal = document.getElementById("kpi_ram_valor");
  const ramDet = document.getElementById("kpi_ram_detalhe");
  const ramBadge = document.getElementById("kpi_ram_badge");
  const ramStatus = document.getElementById("kpi_ram_status_texto");
  const ramPonto = document.getElementById("kpi_ram_ponto");
  const ramMedia = document.getElementById("kpi_ram_media");
  const ramPico = document.getElementById("kpi_ram_pico");
  const ramLimite = document.getElementById("kpi_ram_limite");

  if (ramVal) ramVal.textContent = `${ram.atual}%`;
  if (ramDet) {
    ramDet.textContent = (ram.usadoGb !== null && ram.totalGb !== null)
      ? `${ram.usadoGb} de ${ram.totalGb} GB`
      : "de utilização";
  }
  if (ramMedia) ramMedia.textContent = `Média ${ram.media}%`;
  if (ramPico) ramPico.textContent = `Pico ${ram.pico}%`;
  if (ramLimite) ramLimite.textContent = `Limite ${ram.atencao}%`;

  if (ramBadge && ramStatus) {
    ramBadge.className = `badge_status_kpi ${ram.status === "normal" ? "normal" : ram.status === "atencao" ? "acima" : "critico"}`;
    ramStatus.textContent = ram.status === "normal" ? "Normal" : ram.status === "atencao" ? "Acima do limite" : "Crítico";
    if (ramPonto) {
      ramPonto.style.backgroundColor = ram.status === "normal" ? "var(--verde)" : ram.status === "atencao" ? "var(--amarelo)" : "var(--vermelho)";
    }
  }

  // Disco
  const disco = kpis.Disco;
  const discoVal = document.getElementById("kpi_disco_valor");
  const discoBadge = document.getElementById("kpi_disco_badge");
  const discoStatus = document.getElementById("kpi_disco_status_texto");
  const discoPonto = document.getElementById("kpi_disco_ponto");
  const discoMedia = document.getElementById("kpi_disco_media");
  const discoPico = document.getElementById("kpi_disco_pico");
  const discoLimite = document.getElementById("kpi_disco_limite");

  if (discoVal) discoVal.textContent = `${disco.atual}%`;
  if (discoMedia) discoMedia.textContent = `Média ${disco.media}%`;
  if (discoPico) discoPico.textContent = `Pico ${disco.pico}%`;
  if (discoLimite) discoLimite.textContent = `Limite ${disco.atencao}%`;

  if (discoBadge && discoStatus) {
    discoBadge.className = `badge_status_kpi ${disco.status === "normal" ? "normal" : disco.status === "atencao" ? "acima" : "critico"}`;
    discoStatus.textContent = disco.status === "normal" ? "Normal" : disco.status === "atencao" ? "Atenção" : "Crítico";
    if (discoPonto) {
      discoPonto.style.backgroundColor = disco.status === "normal" ? "var(--verde)" : disco.status === "atencao" ? "var(--amarelo)" : "var(--vermelho)";
    }
  }
}

function renderizarSaturacao(saturacao) {
  const grid = document.getElementById("grid_saturacao");
  if (!grid || !saturacao) return;

  grid.innerHTML = "";

  const recursos = ["CPU", "RAM", "Disco"];

  recursos.forEach((rec) => {
    const dados = saturacao[rec];
    if (!dados) return;

    const article = document.createElement("article");
    const estadoClasse = dados.estado || "estavel";
    article.className = `card_saturacao ${estadoClasse}`;

    // Topo
    const topo = document.createElement("div");
    topo.className = "topo_saturacao";

    const nomeRec = document.createElement("span");
    nomeRec.className = "recurso_nome";
    nomeRec.textContent = rec.toUpperCase();

    const pill = document.createElement("span");
    pill.className = `pill_alerta_recurso ${estadoClasse}`;

    const iconePill = document.createElement("i");
    const textoPill = document.createTextNode(
      estadoClasse === "critico" ? " CRÍTICO PREVISTO" : estadoClasse === "atencao" ? " ATENÇÃO PREVISTA" : " ESTÁVEL"
    );

    if (estadoClasse === "critico") {
      iconePill.className = "fa-solid fa-circle-exclamation";
    } else if (estadoClasse === "atencao") {
      iconePill.className = "fa-solid fa-triangle-exclamation";
    } else {
      iconePill.className = "fa-solid fa-check";
    }

    pill.appendChild(iconePill);
    pill.appendChild(textoPill);
    topo.appendChild(nomeRec);
    topo.appendChild(pill);

    // Tempo saturação
    const tempoBox = document.createElement("div");
    tempoBox.className = "tempo_saturacao";

    const strongTempo = document.createElement("strong");
    const spanDescTempo = document.createElement("span");

    if (dados.horarioCritico === "já excedido" || dados.horarioAtencao === "já excedido") {
      strongTempo.textContent = "Excedido";
      spanDescTempo.textContent = "Limite operacional já atingido";
    } else if (dados.minutosAteCritico !== null) {
      const horas = Math.floor(dados.minutosAteCritico / 60);
      const mins = dados.minutosAteCritico % 60;
      strongTempo.textContent = horas > 0 ? `~${horas}h${mins > 0 ? mins : ""}` : `~${mins}min`;
      spanDescTempo.textContent = "até nível crítico";
    } else if (dados.minutosAteAtencao !== null) {
      const horas = Math.floor(dados.minutosAteAtencao / 60);
      const mins = dados.minutosAteAtencao % 60;
      strongTempo.textContent = horas > 0 ? `~${horas}h${mins > 0 ? mins : ""}` : `~${mins}min`;
      spanDescTempo.textContent = "até nível de atenção";
    } else {
      strongTempo.textContent = `~${dados.projetadoNoHorizonte !== null ? dados.projetadoNoHorizonte : "--"}%`;
      spanDescTempo.textContent = `projetado em ${estado.horizonte}`;
    }

    tempoBox.appendChild(strongTempo);
    tempoBox.appendChild(spanDescTempo);

    // Detalhes
    const detalhes = document.createElement("div");
    detalhes.className = "detalhes_saturacao";

    const p1 = document.createElement("p");
    const p2 = document.createElement("p");

    if (dados.horarioCritico && dados.horarioCritico !== "já excedido") {
      p1.textContent = `Cruzamento crítico estimado às ${dados.horarioCritico}`;
    } else if (dados.horarioAtencao && dados.horarioAtencao !== "já excedido") {
      p1.textContent = `Cruzamento de atenção estimado às ${dados.horarioAtencao}`;
    } else {
      p1.textContent = `Projeção estável abaixo dos limites de alerta`;
    }

    p2.textContent = `Estimativa final: ${dados.projetadoNoHorizonte !== null ? dados.projetadoNoHorizonte : "--"}%`;

    detalhes.appendChild(p1);
    detalhes.appendChild(p2);

    article.appendChild(topo);
    article.appendChild(tempoBox);
    article.appendChild(detalhes);

    grid.appendChild(article);
  });
}

function renderizarBannersInferiores(saturacao) {
  const container = document.getElementById("grid_banners_inferiores");
  if (!container || !saturacao) return;

  container.innerHTML = "";

  const recursosAlerta = [];

  // Se algum recurso está em crítico ou atenção, cria o banner
  ["RAM", "CPU", "Disco"].forEach((rec) => {
    const s = saturacao[rec];
    if (s && (s.estado === "critico" || s.estado === "atencao")) {
      recursosAlerta.push({ recurso: rec, info: s });
    }
  });

  if (recursosAlerta.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "";

  recursosAlerta.forEach(({ recurso, info }) => {
    const banner = document.createElement("article");
    banner.className = `banner_acao ${info.estado}`;

    const textoWrap = document.createElement("div");
    textoWrap.className = "banner_acao_texto";

    const icone = document.createElement("i");
    icone.className = info.estado === "critico"
      ? "fa-solid fa-triangle-exclamation"
      : "fa-solid fa-clock";

    const divTextos = document.createElement("div");
    const strong = document.createElement("strong");
    const p = document.createElement("p");

    const horarioTexto = info.horarioCritico || info.horarioAtencao || "";
    strong.textContent = `${recurso} · ${info.estado === "critico" ? "saturação crítica" : "atenção"} prevista ${horarioTexto ? `(${horarioTexto})` : ""}`;
    p.textContent = `Projeção estimada de ${info.projetadoNoHorizonte}% no horizonte de ${estado.horizonte}.`;

    divTextos.appendChild(strong);
    divTextos.appendChild(p);
    textoWrap.appendChild(icone);
    textoWrap.appendChild(divTextos);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn_investigar";
    btn.setAttribute("data-foco", recurso);

    const spanBtn = document.createElement("span");
    spanBtn.textContent = "Investigar";
    const iconeSeta = document.createElement("i");
    iconeSeta.className = "fa-solid fa-arrow-right";

    btn.appendChild(spanBtn);
    btn.appendChild(iconeSeta);

    btn.addEventListener("click", () => {
      focarRecursoGrafico(recurso);
    });

    banner.appendChild(textoWrap);
    banner.appendChild(btn);
    container.appendChild(banner);
  });
}

function focarRecursoGrafico(recurso) {
  const abaAlvo = document.querySelector(`.aba_recurso[data-recurso="${recurso}"]`);
  if (abaAlvo) {
    abaAlvo.click();
  }
  document.querySelector(".card_grafico_preditivo")?.scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// RENDERIZAÇÃO DOS GRÁFICOS (CHART.JS)
// ==========================================
function renderizarGraficos(recurso) {
  if (!estado.dados || !estado.dados.series) return;

  const serie = estado.dados.series[recurso] || estado.dados.series.CPU;
  const kpis = estado.dados.kpis[recurso] || {};
  const saturacao = estado.dados.saturacao[recurso] || {};

  // Textos de callout e subtítulo
  const subtitulo = document.getElementById("subtitulo_grafico");
  if (subtitulo) {
    subtitulo.textContent = `${recurso} do PC completo · histórico (${estado.historico}) + projeção (${estado.horizonte})`;
  }

  const calloutTit = document.getElementById("callout_titulo");
  const calloutSub = document.getElementById("callout_sub");
  if (calloutTit && calloutSub) {
    if (saturacao.horarioCritico || saturacao.horarioAtencao) {
      const h = saturacao.horarioCritico || saturacao.horarioAtencao;
      calloutTit.textContent = `${saturacao.projetadoNoHorizonte}% em ${estado.horizonte}`;
      calloutSub.textContent = `Cruzamento previsto: ${h}`;
    } else {
      calloutTit.textContent = `${saturacao.projetadoNoHorizonte !== null ? saturacao.projetadoNoHorizonte : kpis.atual}% projetado`;
      calloutSub.textContent = "Estimativa central do modelo";
    }
  }

  // Alerta de dados insuficientes
  const bannerProjecao = document.getElementById("banner_projecao_indisponivel");
  if (bannerProjecao) {
    bannerProjecao.style.display = (serie.projecao === null) ? "flex" : "none";
  }

  const canvasPrincipal = document.getElementById("graficoProjecaoPrincipal");
  if (!canvasPrincipal) return;

  if (chartPrincipal) chartPrincipal.destroy();

  const totalPontos = serie.labels.length;
  const idxAgora = typeof estado.dados.indiceAgora === "number" ? estado.dados.indiceAgora : Math.floor(totalPontos / 2);

  // Calcula pointRadius dinamicamente baseado na quantidade de pontos
  const pointRadiusProjecao = new Array(totalPontos).fill(0);
  if (totalPontos > idxAgora) {
    pointRadiusProjecao[idxAgora] = 4; // ponto "Agora"
  }
  if (totalPontos > 0) {
    pointRadiusProjecao[totalPontos - 1] = 3; // ponto final da projeção
  }

  chartPrincipal = new Chart(canvasPrincipal.getContext("2d"), {
    type: "line",
    data: {
      labels: serie.labels,
      datasets: [
        {
          label: "Intervalo superior (95%)",
          data: serie.faixaSuperior || [],
          borderColor: "transparent",
          backgroundColor: "rgba(255, 215, 65, 0.14)",
          pointRadius: 0,
          fill: "+1",
          tension: 0.35
        },
        {
          label: "Intervalo inferior (95%)",
          data: serie.faixaInferior || [],
          borderColor: "transparent",
          backgroundColor: "rgba(255, 215, 65, 0.14)",
          pointRadius: 0,
          fill: false,
          tension: 0.35
        },
        {
          label: "Observado",
          data: serie.observado || [],
          borderColor: "#ffd741",
          backgroundColor: "#ffd741",
          borderWidth: 2,
          pointRadius: totalPontos < 30 ? 2 : 0,
          pointHoverRadius: 5,
          tension: 0.3
        },
        {
          label: "Projeção Beeling",
          data: serie.projecao || [],
          borderColor: "#ffd741",
          backgroundColor: "#ffd741",
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: pointRadiusProjecao,
          pointHoverRadius: 5,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: { display: false },
        pluginReferenciaBeeling: {
          limite: serie.limiteLinha || 80,
          idxAgora: idxAgora
        },
        tooltip: {
          filter: (item) => item.datasetIndex >= 2 && item.parsed.y !== null,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: {
            color: "#767676",
            font: { size: 10, family: "Barlow, sans-serif" },
            maxTicksLimit: 10
          }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: {
            stepSize: 25,
            color: "#767676",
            font: { size: 10, family: "Barlow, sans-serif" },
            callback: (val) => `${val}%`
          }
        }
      }
    },
    plugins: [pluginReferenciaBeeling]
  });

  // Sub-gráfico inferior de processos projetados
  const canvasProcessos = document.getElementById("graficoProcessosProjetados");
  if (!canvasProcessos) return;

  if (chartProcessos) chartProcessos.destroy();

  const serieProc = serie.processosSerie || [];
  const resumoProc = document.getElementById("resumo_processos_proj");
  if (resumoProc && serieProc.length > 0) {
    const pAgora = serieProc[Math.min(idxAgora, serieProc.length - 1)] || 0;
    const pFim = serieProc[serieProc.length - 1] || 0;
    resumoProc.textContent = `${pAgora} agora → ${pFim} no histórico`;
  }

  // Eixo Y dinâmico para os processos
  const valoresNaoNulos = serieProc.filter((v) => typeof v === "number" && !isNaN(v));
  const minProc = valoresNaoNulos.length ? Math.max(0, Math.floor(Math.min(...valoresNaoNulos) * 0.9)) : 0;
  const maxProc = valoresNaoNulos.length ? Math.ceil(Math.max(...valoresNaoNulos) * 1.1) : 100;

  chartProcessos = new Chart(canvasProcessos.getContext("2d"), {
    type: "line",
    data: {
      labels: serie.labels,
      datasets: [
        {
          label: "Processos ativos",
          data: serieProc,
          borderColor: "#4da3ff",
          backgroundColor: "rgba(77, 163, 255, 0.12)",
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} processos`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#767676",
            font: { size: 10, family: "Barlow, sans-serif" },
            maxTicksLimit: 7
          }
        },
        y: {
          display: false,
          min: minProc,
          max: maxProc
        }
      }
    }
  });
}

// ==========================================
// TABELA DE PROCESSOS (FILTRO E ORDENAÇÃO SEGUROS)
// ==========================================
function renderizarTabelaProcessos() {
  const corpo = document.getElementById("corpo_tabela_processos");
  if (!corpo) return;

  const listaProcessos = (estado.dados && estado.dados.processos) || [];
  const termoBusca = (document.getElementById("busca_processo")?.value || "").trim().toLowerCase();
  const criterioOrdenacao = document.getElementById("ordenacao_processos")?.value || "cpu";

  // Filtra por nome do processo ou por descrição (do backend ou meta local)
  const filtrados = listaProcessos.filter((proc) => {
    if (!termoBusca) return true;
    const nome = (proc.nome || "").toLowerCase();
    const descBackend = (proc.descricao || "").toLowerCase();
    const meta = obterMetaProcesso(proc.nome);
    return nome.includes(termoBusca)
      || descBackend.includes(termoBusca)
      || meta.descricao.toLowerCase().includes(termoBusca);
  });

  // Ordenação: cpu (padrão), ram ou disco
  filtrados.sort((a, b) => {
    if (criterioOrdenacao === "ram") return (b.ramGb || 0) - (a.ramGb || 0);
    if (criterioOrdenacao === "disco") {
      const dA = (a.discoMbs !== null && a.discoMbs !== undefined) ? a.discoMbs : -1;
      const dB = (b.discoMbs !== null && b.discoMbs !== undefined) ? b.discoMbs : -1;
      return dB - dA;
    }
    return (b.cpu || 0) - (a.cpu || 0);
  });

  corpo.innerHTML = "";

  // Total de instâncias (soma dos grupos)
  const totalInstancias = filtrados.reduce(function (soma, p) {
    return soma + (p.instancias || 0);
  }, 0);

  // Subtítulo
  const subtitulo = document.getElementById("subtitulo_tabela_processos");
  if (subtitulo) {
    subtitulo.textContent = `Consumo medido por grupo \u00b7 ${totalInstancias} processos ativos no PC`;
  }

  // Rodapé
  const rodapeContagem = document.getElementById("rodape_contagem_grupos");
  if (rodapeContagem) {
    rodapeContagem.textContent = `${filtrados.length} grupos \u00b7 totais de CPU e RAM correspondem ao equipamento`;
  }

  if (filtrados.length === 0) {
    const trVazia = document.createElement("tr");
    const tdVazia = document.createElement("td");
    tdVazia.colSpan = 8;
    tdVazia.style.textAlign = "center";
    tdVazia.style.color = "#767676";
    tdVazia.style.padding = "24px";
    tdVazia.textContent = "Nenhum processo encontrado para os crit\u00e9rios informados.";
    trVazia.appendChild(tdVazia);
    corpo.appendChild(trVazia);
    return;
  }

  filtrados.forEach((proc) => {
    // Metadados: prefere valores do backend (grupos), cai no mapa local
    const meta = obterMetaProcesso(proc.nome);
    const iconeClasse = proc.icone || meta.icone;
    const descricaoTexto = proc.descricao || meta.descricao;

    const tr = document.createElement("tr");

    // Coluna 1: Nome do processo + ícone
    const tdNome = document.createElement("td");
    const divNomeBox = document.createElement("div");
    divNomeBox.className = "proc_nome_box";

    const icone = document.createElement("i");
    icone.className = `fa-solid ${iconeClasse}`;

    const spanNome = document.createElement("span");
    spanNome.textContent = proc.nome;

    divNomeBox.appendChild(icone);
    divNomeBox.appendChild(spanNome);
    tdNome.appendChild(divNomeBox);

    // Coluna 2: Descrição
    const tdDesc = document.createElement("td");
    tdDesc.className = "proc_desc";
    tdDesc.textContent = descricaoTexto;

    // Coluna 3: Instâncias
    const tdInst = document.createElement("td");
    tdInst.textContent = proc.instancias || 0;

    // Coluna 4: CPU
    const tdCpu = document.createElement("td");
    const spanCpu = document.createElement("span");
    spanCpu.className = "cpu_destaque";
    spanCpu.textContent = `${(proc.cpu || 0).toFixed(1)}%`;
    tdCpu.appendChild(spanCpu);

    // Coluna 5: RAM
    const tdRam = document.createElement("td");
    tdRam.textContent = `${(proc.ramGb || 0).toFixed(1)} GB`;

    // Coluna 6: I/O DISCO
    const tdDisco = document.createElement("td");
    tdDisco.textContent = (proc.discoMbs !== null && proc.discoMbs !== undefined)
      ? `${proc.discoMbs.toFixed(1)} MB/s`
      : "--";

    // Coluna 7: Tendência
    const tdTend = document.createElement("td");
    const spanTend = document.createElement("span");
    spanTend.className = proc.tendencia === "crescimento"
      ? "tendencia_crescimento"
      : proc.tendencia === "queda"
      ? "tendencia_queda"
      : "tendencia_estavel";
    spanTend.textContent = proc.tendencia === "crescimento"
      ? "\u2191 Crescimento"
      : proc.tendencia === "queda"
      ? "\u2193 Em queda"
      : "\u2192 Est\u00e1vel";
    tdTend.appendChild(spanTend);

    // Coluna 8: Ação / Análise com addEventListener
    const tdAcao = document.createElement("td");
    const btnAnalisar = document.createElement("button");
    btnAnalisar.type = "button";
    btnAnalisar.className = "link_analisar";

    const spanBtn = document.createElement("span");
    spanBtn.textContent = "Analisar";
    const iconeSeta = document.createElement("i");
    iconeSeta.className = "fa-solid fa-arrow-right";

    btnAnalisar.appendChild(spanBtn);
    btnAnalisar.appendChild(iconeSeta);

    btnAnalisar.addEventListener("click", () => {
      focarProcesso(proc.nome);
    });

    tdAcao.appendChild(btnAnalisar);

    // Ordem: nome, descrição, instâncias, CPU, RAM, I/O DISCO, tendência, ação
    tr.appendChild(tdNome);
    tr.appendChild(tdDesc);
    tr.appendChild(tdInst);
    tr.appendChild(tdCpu);
    tr.appendChild(tdRam);
    tr.appendChild(tdDisco);
    tr.appendChild(tdTend);
    tr.appendChild(tdAcao);

    corpo.appendChild(tr);
  });
}

function focarProcesso(nomeProcesso) {
  const campoBusca = document.getElementById("busca_processo");
  if (campoBusca) {
    campoBusca.value = nomeProcesso;
    renderizarTabelaProcessos();
  }
}

// ==========================================
// CONTROLES DE EVENTOS E INICIALIZAÇÃO
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  document.body.style.visibility = "visible";
  document.body.style.display = "";
  try {
  validarSessao();
  carregarPerfilUsuario();

  // Carrega lista de torres e depois carrega os dados preditivos
  await carregarTorres();
  await carregarDados();

  // Auto-refresh a cada 30 segundos (pausado se a aba estiver oculta)
  estado.timerAutoRefresh = setInterval(() => {
    if (!document.hidden) {
      carregarDados();
    }
  }, 30000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      carregarDados();
    }
  });

  // Perfil do usuário na barra lateral
  const usuarioLogado = document.getElementById("usuario_logado");
  usuarioLogado?.addEventListener("click", abrirPerfilUsuario);
  usuarioLogado?.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      abrirPerfilUsuario();
    }
  });

  // Botão sair
  document.getElementById("botao_sair")?.addEventListener("click", limparSessao);

  // Botão Tentar Novamente em caso de erro
  document.getElementById("btn_tentar_novamente")?.addEventListener("click", carregarDados);

  // Seletor de torre
  document.getElementById("seletor_torre")?.addEventListener("change", (e) => {
    const novaTorre = e.target.value;
    if (novaTorre) {
      estado.idTorre = novaTorre;
      sessionStorage.setItem("ID_TORRE_SELECIONADA", novaTorre);
      carregarDados();
    }
  });

  // Filtro de Histórico (24h / 12h / 6h)
  document.getElementById("filtro_historico")?.addEventListener("change", (e) => {
    estado.historico = e.target.value;
    const legendaKpis = document.getElementById("legenda_kpis_historico");
    if (legendaKpis) {
      legendaKpis.textContent = `Medições reais · últimas ${estado.historico}`;
    }
    carregarDados();
  });

  // Botões de Horizonte de Projeção (2h / 6h / 24h)
  document.querySelectorAll(".btn_horizonte").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn_horizonte").forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      estado.horizonte = btn.dataset.horizonte;

      const leg = document.getElementById("legenda_projecao");
      if (leg) {
        leg.textContent = `Projeção Beeling · horizonte de ${estado.horizonte}`;
      }
      carregarDados();
    });
  });

  // Abas CPU / RAM / Disco no gráfico (apenas troca visual, sem refetch)
  document.querySelectorAll(".aba_recurso").forEach((aba) => {
    aba.addEventListener("click", () => {
      document.querySelectorAll(".aba_recurso").forEach((b) => b.classList.remove("ativa"));
      aba.classList.add("ativa");
      estado.recursoAtivo = aba.dataset.recurso;
      renderizarGraficos(estado.recursoAtivo);
    });
  });

  // Busca e ordenação na tabela de processos
  document.getElementById("busca_processo")?.addEventListener("input", renderizarTabelaProcessos);
  document.getElementById("ordenacao_processos")?.addEventListener("change", renderizarTabelaProcessos);

  // Botão atualizar manual
  document.getElementById("btn_atualizar")?.addEventListener("click", carregarDados);

  // Abre a edição da torre atualmente selecionada para configurar seus limites.
  document.getElementById("btn_config_limites")?.addEventListener("click", () => {
    const seletorTorre = document.getElementById("seletor_torre");
    const idTorre = seletorTorre?.value || estado.idTorre || sessionStorage.getItem("ID_TORRE_SELECIONADA");

    if (!idTorre) {
      alert("Selecione uma torre para configurar os limites.");
      return;
    }

    sessionStorage.setItem("ID_TORRE_SELECIONADA", idTorre);
    sessionStorage.setItem("idTorreEmEdicao", idTorre);
    window.location.href = "./alteracao_torre.html";
  });

  // Menu mobile
  document.getElementById("btn_menu_mobile")?.addEventListener("click", () => {
    document.body.classList.toggle("menu-aberto");
  });
  } catch (erro) {
    console.error("Erro ao inicializar dashboard-isaac:", erro);
    const container = document.getElementById("estado_feedback");
    const conteudo = document.getElementById("conteudo_dashboard");
    if (conteudo) conteudo.style.display = "none";
    if (container) {
      container.classList.remove("oculto");
      const icone = document.getElementById("estado_feedback_icone");
      const titulo = document.getElementById("estado_feedback_titulo");
      const desc = document.getElementById("estado_feedback_desc");
      if (icone) icone.className = "fa-solid fa-triangle-exclamation estado_feedback_icone erro";
      if (titulo) titulo.textContent = "Erro ao carregar dashboard";
      if (desc) desc.textContent = (erro && erro.message) ? erro.message : String(erro);
    }
  }
});
