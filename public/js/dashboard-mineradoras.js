// Aparência compartilhada com o CSS; não participa dos cálculos de status.
const temaGraficoDashboard = (() => {
  const css = getComputedStyle(document.documentElement);
  const ler = (nome) => css.getPropertyValue('--dash-' + nome).trim();
  return {
    destaque: ler('destaque'), normal: ler('normal'), critico: ler('critico'),
    texto: ler('texto'), secundario: ler('texto-secundario'),
    grade: ler('borda'), fundo: ler('card'), borda: ler('borda-controle'),
    serieCpu: ler('serie-cpu'), serieRam: ler('serie-ram'), serieDisco: ler('serie-disco'), serieProcessos: ler('serie-processos'),
    fonte: { family: ler('fonte'), size: parseFloat(ler('fonte-grafico')) },
    alpha: (estado, opacidade) => 'rgba(' + ler(estado + '-rgb') + ', ' + opacidade + ')'
  };
})();
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = temaGraficoDashboard.secundario;
  Chart.defaults.font.family = temaGraficoDashboard.fonte.family;
  Chart.defaults.font.size = temaGraficoDashboard.fonte.size;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: temaGraficoDashboard.fundo,
    titleColor: temaGraficoDashboard.texto,
    bodyColor: temaGraficoDashboard.texto,
    borderColor: temaGraficoDashboard.borda,
    borderWidth: 1
  });
}

var graficos = {};
var filtroEstado = null;

function definirTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (!elemento) {
    return;
  }
  elemento.textContent = valor === null || valor === undefined ? "—" : String(valor);
}

function carregarIniciais() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO") || "";
  const iniciais = [];

  for (let i = 0; i < nomeUsuario.length; i++) {

    if (i == 0) {
      iniciais.push(nomeUsuario[i]);
    }

    if (nomeUsuario[i] == " ") {
      iniciais.push(nomeUsuario[i + 1])
      break;
    }

  }
  avatar_usuario.textContent = iniciais.join('');
}

function numero(valor) {
  if (valor === null || valor === undefined) return "—";
  return Number(valor || 0).toLocaleString("pt-BR");
}

function slugEstado(estado) {
  if (estado === "Crítico") {
    return "critico";
  }
  if (estado === "Atenção") {
    return "atencao";
  }
  if (estado === "Desconhecido") {
    return "desconhecido"
  }
  return "normal";
}

function classeTag(estado) {
  if (estado === "Crítico") {
    return "critico";
  }
  if (estado === "Atenção") {
    return "alerta";
  }
  if (estado === "Desconhecido") {
    return "desconhecido"
  }
  return "normal";
}

function prioridadeEstado(estado) {
  if (estado === "Crítico") {
    return 0;
  }
  if (estado === "Atenção") {
    return 1;
  }
  if (estado === "Normal") {
    return 2;
  }
  return 3;
}

function textoVariacao(valor) {
  if (valor === null || valor === undefined) {
    return "—";
  }
  const sinal = valor >= 0 ? "▲" : "▼";
  return `${sinal} ${Math.abs(Number(valor)).toFixed(0)}%`;
}

function aplicarVariacao(elemento, valor) {
  if (!elemento) {
    return;
  }
  elemento.textContent = textoVariacao(valor);
  elemento.classList.remove("alta", "baixa");
  elemento.classList.add(valor !== null && valor !== undefined && valor >= 0 ? "alta" : "baixa");
}

function converterData(valor) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarHora(valor) {
  const data = converterData(valor);
  if (!data) {
    return "—";
  }
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function atualizarSelo(valor) {
  const selo = document.getElementById("ultima_atualizacao");
  if (!selo) {
    return;
  }
  const data = converterData(valor);
  if (!data) {
    selo.textContent = "Sem atualização disponível";
    selo.classList.add("desatualizado");
    return;
  }
  const desatualizado = Date.now() - data.getTime() > 15 * 60 * 1000;
  selo.classList.toggle("desatualizado", desatualizado);
  selo.textContent = desatualizado
    ? `Dados desatualizados desde ${formatarHora(valor)}`
    : `Dados atualizados às ${formatarHora(valor)}`;
}

function definirTextoFilho(root, seletor, valor) {
  const elemento = root.querySelector(seletor);
  if (elemento) {
    elemento.textContent = valor === null || valor === undefined ? "—" : String(valor);
  }
}

function definirLargura(root, seletor, total, quantidade) {
  const elemento = root.querySelector(seletor);
  if (!elemento) {
    return;
  }
  const percentual = total > 0 ? (Number(quantidade || 0) / total) * 100 : 0;
  elemento.style.width = `${percentual.toFixed(1)}%`;
}

function textoDetalhe(mineradora, slug) {
  if (mineradora.DETALHE) {
    return mineradora.DETALHE;
  }
  if (slug === "normal" || slug === "desconhecido") {
    return "";
  }
  const partes = [];
  if (mineradora.OBSERVACAO) {
    partes.push(mineradora.OBSERVACAO);
  } else if (mineradora.ESTADO) {
    partes.push(mineradora.ESTADO);
  }
  return partes.join(" · ");
}

function renderizarMineradoras(mineradoras) {
  const grid = document.getElementById("grid_mineradoras");
  const template = document.getElementById("template_card_mineradora");
  if (!grid || !template) {
    return;
  }

  const ordenadas = mineradoras.slice().sort(function (a, b) {
    const diferenca = prioridadeEstado(a.ESTADO) - prioridadeEstado(b.ESTADO);
    return diferenca || Number(b.ALERTAS_HOJE || 0) - Number(a.ALERTAS_HOJE || 0);
  });

  grid.innerHTML = "";
  ordenadas.forEach(function (mineradora) {
    const fragmento = template.content.cloneNode(true);
    const card = fragmento.querySelector(".card_mineradora");
    if (!card) {
      return;
    }

    const slug = slugEstado(mineradora.ESTADO);
    const id = String(mineradora.ID_MINERADORA ?? 0);
    card.dataset.estado = slug;
    card.dataset.idMineradora = id;
    card.setAttribute("href", `./selecao_torre.html?data-id-torre=${id}`);

    definirTextoFilho(fragmento, ".mineradora_nome", mineradora.MINERADORA);
    const status = fragmento.querySelector(".mineradora_estado");
    if (status) {
      status.textContent = mineradora.ESTADO;
      status.className = `tag_status ${classeTag(mineradora.ESTADO)} mineradora_estado`;
    }

    const detalhe = fragmento.querySelector(".mineradora_detalhe");
    if (detalhe) {
      const texto = textoDetalhe(mineradora, slug);
      detalhe.textContent = texto;
      detalhe.hidden = !texto;       
    }

    const total = Number(mineradora.TOTAL_TORRES || 0);
    definirTextoFilho(fragmento, ".mineradora_total_torres", total);
    definirLargura(fragmento, ".segmento_desconhecido", total, mineradora.TORRES_DESCONHECIDAS);
    definirLargura(fragmento, ".segmento_normal", total, mineradora.TORRES_NORMAIS);
    definirLargura(fragmento, ".segmento_atencao", total, mineradora.TORRES_ATENCAO);
    definirLargura(fragmento, ".segmento_critico", total, mineradora.TORRES_CRITICAS);
    definirTextoFilho(fragmento, ".qtd_desconhecidas", mineradora.TORRES_DESCONHECIDAS);
    definirTextoFilho(fragmento, ".qtd_normais", mineradora.TORRES_NORMAIS);
    definirTextoFilho(fragmento, ".qtd_atencao", mineradora.TORRES_ATENCAO);
    definirTextoFilho(fragmento, ".qtd_criticas", mineradora.TORRES_CRITICAS);

    definirTextoFilho(fragmento, ".mineradora_alertas_hoje", numero(mineradora.ALERTAS_HOJE));
    aplicarVariacao(fragmento.querySelector(".mineradora_variacao"), mineradora.VARIACAO_ALERTAS);
    definirTextoFilho(fragmento, ".mineradora_alertas_ontem", numero(mineradora.ALERTAS_ONTEM));
    definirTextoFilho(
      fragmento,
      ".mineradora_componente",
      mineradora.COMPONENTE_MAIS_ALERTA || "—",
    );

    const quantidade = Number(mineradora.COMPONENTE_MAIS_ALERTA_QTD || 0);
    const totalAlertas = Number(mineradora.ALERTAS_HOJE || 0);
    definirTextoFilho(
      fragmento,
      ".mineradora_componente_detalhe",
      quantidade ? `${quantidade} de ${totalAlertas} alertas` : "—",
    );

    const observacao = mineradora.OBSERVACAO ? ` (${mineradora.OBSERVACAO})` : "";
    const acao = fragmento.querySelector(".mineradora_acao");
    if (acao) {
      acao.textContent = `${mineradora.ACAO || "—"}${observacao}`;
      acao.classList.toggle("acao_destaque", slug === "critico");
    }

    grid.appendChild(fragmento);
  });

  aplicarFiltroCards();
}

function criarOuAtualizarGrafico(id, configuracao) {
  if (graficos[id]) {
    graficos[id].destroy();
  }
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  graficos[id] = new Chart(canvas.getContext("2d"), configuracao);
}

function renderizarGraficoAlertas(dados) {
  const grafico = dados.grafico_alertas || { labels: [], valores: [], mediana: 0 };
  const filtros = dados.filtros || {};
  const periodo = Number(grafico.periodo || 7);
  const modo = grafico.modo === "por_torre" ? "por torre" : "total";
  const rotuloPeriodo = grafico.periodo_rotulo || filtros.periodo_rotulo;
  const textoPeriodo = rotuloPeriodo
    ? `(${rotuloPeriodo} · ${modo} · 3 maiores + padrão)`
    : `(últimos ${periodo} dias · ${modo} · 3 maiores + padrão)`;
  const rotuloMediana = "Padrão das mineradoras";
  definirTexto("periodo_grafico_alertas", textoPeriodo);

  const labels = grafico.labels || [];
  const valores = grafico.valores || [];
  const mediana = Number(grafico.mediana || 0);

  criarOuAtualizarGrafico("graficoAlertasMineradoras", {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "bar",
          label: "Alertas",
          data: valores,
          backgroundColor: temaGraficoDashboard.destaque,
          borderRadius: 4,
          barThickness: 12,
        },
        {
          type: "line",
          label: rotuloMediana,
          data: labels.map(function () {
            return mediana;
          }),
          borderColor: temaGraficoDashboard.secundario,
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: temaGraficoDashboard.secundario, boxWidth: 12, font: temaGraficoDashboard.fonte },
        },
      },
      scales: {
        x: {
          grid: { color: temaGraficoDashboard.grade },
          ticks: { color: temaGraficoDashboard.secundario, precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { color: temaGraficoDashboard.texto, font: temaGraficoDashboard.fonte },
        },
      },
    },
  });
}

function resumoNomes(nomes) {
  if (!nomes.length) {
    return "—";
  }
  if (nomes.length <= 3) {
    return nomes.join(", ");
  }
  return `${nomes.slice(0, 3).join(", ")} +${nomes.length - 3}`;
}

function renderizarStatus(mineradoras) {
  const quantidades = {
    desconhecido: mineradoras.filter(function (item) {
      return item.ESTADO === "Desconhecido";
    }).length,
    normal: mineradoras.filter(function (item) {
      return item.ESTADO === "Normal";
    }).length,
    atencao: mineradoras.filter(function (item) {
      return item.ESTADO === "Atenção";
    }).length,
    critico: mineradoras.filter(function (item) {
      return item.ESTADO === "Crítico";
    }).length,
  };
  const total = mineradoras.length || 0;

  definirTexto("donut_total_mineradoras", total);
  ["desconhecido","normal", "atencao", "critico"].forEach(function (estado) {
    const percentual = total ? ((quantidades[estado] / total) * 100).toFixed(1).replace(".", ",") : "0,0";
    definirTexto(
      `pct_mineradoras_${estado}`,
      `${quantidades[estado]} (${percentual}%)`,
    );
    const nomes = mineradoras
      .filter(function (item) {
        return slugEstado(item.ESTADO) === estado;
      })
      .map(function (item) {
        return item.MINERADORA;
      });
    definirTexto(`nomes_mineradoras_${estado}`, resumoNomes(nomes));
  });

  criarOuAtualizarGrafico("graficoStatusMineradoras", {
    type: "doughnut",
    data: {
      labels: ["Desconhecido","Regular", "Em Atenção", "Crítico"],
      datasets: [{
        data: [quantidades.desconhecido, quantidades.normal, quantidades.atencao, quantidades.critico],
        backgroundColor: [temaGraficoDashboard.texto, temaGraficoDashboard.normal, temaGraficoDashboard.destaque, temaGraficoDashboard.critico],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: "75%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  return quantidades;
}

function renderizarKpis(dados) {
  const kpis = dados.kpis || {};
  const mineradoras = dados.mineradoras || [];
  const criticas = mineradoras.filter(function (item) {
    return item.ESTADO === "Crítico";
  });

  atualizarSelo(dados.atualizado_em);
  const torresAtencao = Number(kpis.TORRES_ATENCAO || 0);
  const torresCriticas = Number(kpis.TORRES_CRITICAS || 0);
  const totalTorres = Number(kpis.TOTAL_TORRES_MONITORADAS || 0);

  definirTexto("kpi_total_mineradoras", numero(kpis.TOTAL_MINERADORAS_MONITORADAS));
  definirTexto("kpi_sub_total_torres", `${numero(totalTorres)} torres monitoradas`);
  definirTexto("kpi_mineradoras_criticas", `${criticas.length} / ${mineradoras.length}`);
  definirTexto(
    "kpi_sub_mineradoras_criticas",
    criticas.length ? criticas.map(function (item) {
      return item.MINERADORA;
    }).join(", ") : "Nenhuma",
  );
  definirTexto("kpi_alertas_hoje", numero(kpis.ALERTAS_HOJE));
  definirTexto("kpi_sub_alertas_ontem", `Ontem: ${numero(kpis.ALERTAS_ONTEM)} alertas`);
  definirTexto("kpi_torres_problema", `${numero(torresAtencao + torresCriticas)} / ${numero(totalTorres)}`);
  definirTexto(
    "kpi_sub_torres_problema",
    `${numero(torresAtencao)} em atenção · ${numero(torresCriticas)} críticas · ${numero(totalTorres)} torres monitoradas`,
  );

  const ontem = Number(kpis.ALERTAS_ONTEM || 0);
  const variacao = ontem > 0
    ? ((Number(kpis.ALERTAS_HOJE || 0) - ontem) / ontem) * 100
    : null;
  aplicarVariacao(document.getElementById("kpi_variacao_alertas"), variacao);
}

function aplicarFiltroCards() {
  document.querySelectorAll("#grid_mineradoras .card_mineradora").forEach(function (card) {
    card.hidden = Boolean(filtroEstado && card.dataset.estado !== filtroEstado);
  });
}

function sincronizarFiltrosEstado() {
  document.querySelectorAll(".legenda_estado").forEach(function (link) {
    link.classList.toggle("ativo", link.dataset.filtroEstado === filtroEstado);
  });
  aplicarFiltroCards();
}

function configurarFiltrosEstado() {
  document.querySelectorAll(".legenda_estado").forEach(function (link) {
    link.addEventListener("click", function (evento) {
      evento.preventDefault();
      const estado = link.dataset.filtroEstado;
      filtroEstado = filtroEstado === estado ? null : estado;
      sincronizarFiltrosEstado();
    });
  });

  document.getElementById("btn_ver_todas_mineradoras")?.addEventListener("click", function (evento) {
    evento.preventDefault();
    filtroEstado = null;
    sincronizarFiltrosEstado();
  });
}

function aplicarDados(dados) {
  const mineradoras = Array.isArray(dados.mineradoras) ? dados.mineradoras : [];
  renderizarMineradoras(mineradoras);
  // Atualiza os indicadores antes dos gráficos, inclusive se o CDN falhar.
  renderizarKpis(dados);
  let aviso = document.getElementById("aviso_escopo");
  if (!aviso) {
    aviso = document.createElement("p");
    aviso.id = "aviso_escopo";
    aviso.setAttribute("role", "status");
    document.querySelector(".header_dashboard").appendChild(aviso);
  }
  aviso.textContent = dados.mensagem || "";
  aviso.hidden = !dados.mensagem;
  renderizarGraficoAlertas(dados);
  renderizarStatus(mineradoras);
}

async function carregarDados() {
  const periodo = document.getElementById("filtro_periodo")?.value || "7";
  const modo = document.getElementById("filtro_modo")?.value || "total";
  const resposta = await fetch(`/dashboard/mineradoras?periodo=${periodo}&modo=${modo}`);
  if (!resposta.ok) {
    throw new Error("Falha ao carregar dashboard");
  }
  aplicarDados(await resposta.json());
}

document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();
  carregarIniciais();

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  configurarFiltrosEstado();

  aplicarDados({ mineradoras: [], kpis: {} });

  ["filtro_periodo", "filtro_modo"].forEach(function (id) {
    document.getElementById(id)?.addEventListener("change", function () {
      carregarDados().catch(function (erro) {
        console.warn("Erro ao aplicar filtro:", erro);
      });
    });
  });

  carregarDados().catch(function (erro) {
    const aviso = document.getElementById("aviso_escopo");
    aviso.textContent = "Não foi possível carregar os dados da dashboard. Recarregue a página.";
    aviso.hidden = false;
    console.warn("Dashboard indisponível:", erro);
  });
});
