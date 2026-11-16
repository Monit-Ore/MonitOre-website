const rotulosSituacao = {
  normal: ["Normal", "normal", "fa-circle-check"],
  atencao: ["Em atenção agora", "alerta", "fa-triangle-exclamation"],
  critico: ["Crítico agora", "critico", "fa-circle-exclamation"],
  sem_dados: ["Sem dados recentes", "neutra", "fa-database"],
  sem_monitoramento: ["Monitoramento desabilitado", "neutra", "fa-pause"],
  atencao_prevista: ["Atenção prevista", "prevista", "fa-clock"],
  critico_previsto: ["Crítico previsto", "critica_prevista", "fa-clock"],
};
const ordemSituacoes = ["critico", "atencao", "critico_previsto", "atencao_prevista"];
const formatoLista = new Intl.ListFormat("pt-BR");
const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const percentual = (valor) => `${formatoNumero.format(valor)}%`;
const comSinal = (valor) => `${valor > 0 ? "+" : ""}${formatoNumero.format(valor)}`;
const prazo = (dias) => `${dias} ${dias === 1 ? "dia" : "dias"}`;
const contar = (torres, chave) => torres.filter((torre) => torre[chave]).length;

function classePrevisao(nivel) {
  return nivel === "critico" ? "critico_previsto" : "atencao_prevista";
}

function rotuloEvento(evento) {
  const [texto] = rotulosSituacao[evento.tipo];
  return evento.dias ? `${texto} · ${prazo(evento.dias)}` : texto;
}

function tagSituacao(evento) {
  const [, classe, icone] = rotulosSituacao[evento.tipo];
  return `<span class="tag_status ${classe}"><i class="fa-solid ${icone}" aria-hidden="true"></i>${rotuloEvento(evento)}</span>`;
}

function compararPrioridades(a, b) {
  const tipo = a.eventos[0].tipo;
  const diferencaDeGravidade = ordemSituacoes.indexOf(tipo) - ordemSituacoes.indexOf(b.eventos[0].tipo);
  if (diferencaDeGravidade) return diferencaDeGravidade;

  const previsao = tipo === "atencao" ? "critico_previsto" : tipo;
  const prazoDe = (item) => item.eventos.find((evento) => evento.tipo === previsao)?.dias ?? horizontePrevisao + 1;
  const limite = tipo === "atencao_prevista" ? "atencao" : "critico";
  const distancia = (item) => item[limite] - item.atual;
  return prazoDe(a) - prazoDe(b) || distancia(a) - distancia(b) || Number(b.crescente) - Number(a.crescente);
}

const componentesPrioritarios = panoramaAtual.flatMap((torre) => torre.componentes.map((item) => {
  const eventos = (item.previsoes ?? []).map((previsao) => ({ ...previsao, tipo: classePrevisao(previsao.nivel) }));
  if (item.situacao === "atencao" || item.situacao === "critico") eventos.push({ tipo: item.situacao });
  eventos.sort((a, b) => ordemSituacoes.indexOf(a.tipo) - ordemSituacoes.indexOf(b.tipo));
  return { ...item, torre: torre.nome, codigo: torre.codigo, mineradora: torre.mineradora, eventos };
})).filter((item) => item.eventos.length).sort(compararPrioridades);

const formatoKpi = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const unidadeTorre = (quantidade) => quantidade === 1 ? "torre" : "torres";
const valorEmTorres = (quantidade, total) => `${quantidade} <span>/ ${total} ${unidadeTorre(total)}</span>`;
const percentualKpi = (valor) => `${formatoKpi.format(valor)}%`;
const variacaoEmTorres = (delta) => delta ? `${comSinal(delta)} ${unidadeTorre(Math.abs(delta))}` : "Estável";
const variacaoPercentualEmTorres = (delta, anterior) => anterior > 0
  ? `${delta > 0 ? "+" : ""}${percentualKpi(delta / anterior * 100)}` : "";

function preencherKpi(id, { valor, variacao, tom, variacaoPercentual = "", proporcao }) {
  const card = document.getElementById(id);
  card.querySelector(".kpi_valor").innerHTML = valor;
  card.querySelector(".kpi_comparacao").classList.add(tom);
  const selo = card.querySelector(".kpi_variacao");
  selo.textContent = variacao;
  const descricaoVariacao = card.querySelector(".kpi_variacao_percentual");
  descricaoVariacao.hidden = !variacaoPercentual;
  descricaoVariacao.textContent = variacaoPercentual ? `(${variacaoPercentual})` : "";
  const percentualAtual = card.querySelector(".kpi_percentual_atual");
  percentualAtual.hidden = proporcao === null;
  percentualAtual.textContent = proporcao === null ? "" : percentualKpi(proporcao);
  const barra = card.querySelector("progress");
  barra.hidden = proporcao === null;
  barra.value = proporcao ?? 0;
}

function mesmaBase(atual, anterior) {
  return atual.size === anterior.size && [...atual].every((codigo) => anterior.has(codigo));
}

const aumentoAtual = medirAumentoPreocupante(panoramaAtual);
const aumentoAnterior = medirAumentoPreocupante(panoramaAnterior);
const baseAtual = aumentoAtual.codigos.size;
const baseAnterior = aumentoAnterior.codigos.size;
const aumentoComparavel = baseAtual > 0 && baseAnterior > 0;
const deltaAumento = aumentoAtual.quantidade - aumentoAnterior.quantidade;

preencherKpi("kpi-aumento", {
  valor: baseAtual ? valorEmTorres(aumentoAtual.quantidade, baseAtual) : "—",
  proporcao: baseAtual ? aumentoAtual.quantidade / baseAtual * 100 : null,
  variacao: aumentoComparavel ? variacaoEmTorres(deltaAumento) : "Comparação indisponível",
  variacaoPercentual: aumentoComparavel ? variacaoPercentualEmTorres(deltaAumento, aumentoAnterior.quantidade) : "",
  tom: !aumentoComparavel || deltaAumento === 0 ? "neutra" : deltaAumento > 0 ? "piora" : "melhora",
});

for (const [id, chave] of [
  ["kpi-atencao", "atencaoPrevista"],
  ["kpi-critico", "criticoPrevisto"],
]) {
  const atual = contar(panoramaAtual, chave);
  const anterior = contar(panoramaAnterior, chave);
  const delta = atual - anterior;
  preencherKpi(id, {
    valor: valorEmTorres(atual, panoramaAtual.length),
    proporcao: panoramaAtual.length ? atual / panoramaAtual.length * 100 : null,
    variacao: variacaoEmTorres(delta),
    variacaoPercentual: variacaoPercentualEmTorres(delta, anterior),
    tom: delta > 0 ? "piora" : delta < 0 ? "melhora" : "neutra",
  });
}

function medirCobertura(torres) {
  const monitoradas = torres.filter((torre) => torre.componentes.length);
  const semDados = contar(monitoradas, "dadosInsuficientes");
  const comDados = monitoradas.length - semDados;
  return {
    codigos: new Set(monitoradas.map((torre) => torre.codigo)),
    total: monitoradas.length,
    comDados,
    percentual: monitoradas.length ? comDados / monitoradas.length * 100 : null,
  };
}

const coberturaAtual = medirCobertura(panoramaAtual);
const coberturaAnterior = medirCobertura(panoramaAnterior);
const coberturaComparavel = coberturaAtual.total > 0 && coberturaAnterior.total > 0;
const coberturaMesmaBase = mesmaBase(coberturaAtual.codigos, coberturaAnterior.codigos);
const deltaCobertura = coberturaAtual.comDados - coberturaAnterior.comDados;
preencherKpi("kpi-cobertura", {
  valor: coberturaAtual.total ? valorEmTorres(coberturaAtual.comDados, coberturaAtual.total) : "—",
  proporcao: coberturaAtual.percentual,
  variacao: coberturaComparavel ? variacaoEmTorres(deltaCobertura) : "Comparação indisponível",
  variacaoPercentual: coberturaComparavel ? variacaoPercentualEmTorres(deltaCobertura, coberturaAnterior.comDados) : "",
  tom: !coberturaComparavel || !coberturaMesmaBase || deltaCobertura === 0 ? "neutra" : deltaCobertura > 0 ? "melhora" : "piora",
});

function descreverMudanca(atual, anterior) {
  if (atual === anterior) return `se manteve em ${atual}`;
  return `${atual > anterior ? "subiu" : "caiu"} de ${anterior} para ${atual}`;
}

const pressaoInicial = pressaoSemanal[0];
const pressaoFinal = pressaoSemanal.at(-1);

function prioridadeNoMapa(torre) {
  if (torre.criticoPrevisto) return 0;
  if (torre.atencaoPrevista) return 1;
  return torre.crescente ? 2 : 3;
}

function cartaoTorre(torre) {
  const [situacao, classe] = rotulosSituacao[torre.situacao];
  const classeAtual = torre.situacao === "sem_monitoramento" ? torre.situacao : classe;
  const situacaoNoMapa = torre.situacao === "sem_dados" ? "" : situacao;
  const previsao = torre.criticoPrevisto ? "Crítico previsto" : torre.atencaoPrevista ? "Atenção prevista" : "";
  const detalhe = [situacaoNoMapa, previsao].filter(Boolean).join(" · ");
  const resumo = [torre.nome, detalhe, torre.crescente ? "Consumo crescente" : ""].filter(Boolean).join(" · ");
  return `<li><button type="button" class="torre_status ${classeAtual}" data-codigo="${torre.codigo}" aria-label="${resumo}" title="${resumo}">
    <span class="torre_linha">
      <span class="torre_nome">${torre.nome}</span>
      <span class="indicadores_torre" aria-hidden="true">
        ${previsao ? `<i class="fa-regular fa-clock ${torre.criticoPrevisto ? "texto_critico" : ""}"></i>` : ""}
        ${torre.crescente ? '<i class="fa-solid fa-arrow-trend-up"></i>' : ""}
      </span>
    </span>
    ${detalhe ? `<span class="torre_detalhe">${detalhe}</span>` : ""}
  </button></li>`;
}

const mapaTorres = document.getElementById("mapa-torres");
const torresOrdenadas = [...panoramaAtual].sort((a, b) => prioridadeNoMapa(a) - prioridadeNoMapa(b));
mapaTorres.innerHTML = [
  ["critico", "Críticas"],
  ["atencao", "Atenção"],
  ["normal", "Normais"],
].map(([grupo, titulo]) => {
  const torres = torresOrdenadas.filter((torre) => torre.situacao === grupo);
  const conteudo = torres.length
    ? `<ul class="mapa_torres">${torres.map(cartaoTorre).join("")}</ul>`
    : '<p class="grupo_torres_vazio">Nenhuma torre</p>';
  return `<section class="grupo_torres" data-grupo="${grupo}">
    <h3 id="titulo-torres-${grupo}">${titulo}</h3>
    <div class="rolagem_mapa_torres" tabindex="0" role="region" aria-labelledby="titulo-torres-${grupo}">
      ${conteudo}
    </div>
  </section>`;
}).join("");

let consultaTorres;
async function abrirDashboardTorre(codigo, estadoNavegacaoTorre) {
  const fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");
  const idUsuario = sessionStorage.getItem("ID_USUARIO");
  estadoNavegacaoTorre.hidden = false;
  if (!fkEmpresa || !idUsuario) {
    estadoNavegacaoTorre.textContent = "Entre no MonitOre para abrir a dashboard técnica da torre.";
    return;
  }
  estadoNavegacaoTorre.textContent = "Localizando a torre…";
  try {
    consultaTorres ??= fetch(`/torres/listarTorres?${new URLSearchParams({ fkEmpresa, idUsuario })}`).then(async (resposta) => {
      if (!resposta.ok) throw new Error("Falha ao listar torres");
      const grupos = await resposta.json();
      return grupos.flatMap((grupo) => grupo.torres);
    }).catch((erro) => {
      consultaTorres = null;
      throw erro;
    });
    const torres = await consultaTorres;
    const torre = torres.find((item) => item.codigo === codigo);
    if (!torre?.id_torre) {
      estadoNavegacaoTorre.textContent = "Esta torre demonstrativa não está disponível na sua sessão.";
      return;
    }
    sessionStorage.setItem("ID_TORRE_SELECIONADA", String(torre.id_torre));
    window.location.href = "./dashboard_torre.html";
  } catch {
    estadoNavegacaoTorre.textContent = "Não foi possível localizar a torre. Tente novamente.";
  }
}

for (const [regiao, mensagem] of [
  [mapaTorres, "estado-navegacao-torre"],
  [document.getElementById("lista-prioridades"), "estado-navegacao-prioridades"],
]) {
  regiao.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-codigo]");
    if (botao) return abrirDashboardTorre(botao.dataset.codigo, document.getElementById(mensagem));
  });
}

const filtroSituacao = document.getElementById("filtro-situacao");
const listaPrioridades = document.getElementById("lista-prioridades");
const regiaoPrioridades = document.getElementById("regiao-prioridades");

function celulaPrevisoes(item) {
  if (item.situacao === "critico") return "Já em crítico — sem próximo nível de alerta.";
  if (item.previsoes === null) return "Previsão indisponível";
  const eventosFuturos = item.eventos.filter((evento) => evento.dias);
  return eventosFuturos.length
    ? `<div class="previsoes_prioridade">${eventosFuturos.map(tagSituacao).join("")}</div>`
    : "Nenhum novo limite previsto em 15 dias.";
}

function linhaPrioridade(item) {
  const antes = item.semanas[0];
  const agora = item.atual;
  const variacao = leituraValida(antes) && antes > 0 && leituraValida(agora)
    ? `${comSinal((agora - antes) / antes * 100)}%` : "—";
  return `<tr>
    <th scope="row"><button type="button" class="link_torre" data-codigo="${item.codigo}">${item.torre}</button>
      <span class="sub_item">${item.nome}</span></th>
    <td>${variacao}</td>
    <td><span class="texto_atencao">Atenção: ${percentual(item.atencao)}</span>
      <span class="sub_item texto_critico">Crítico: ${percentual(item.critico)}</span></td>
    <td>${tagSituacao({ tipo: item.situacao })}<span class="sub_item">${percentual(item.atual)} na última leitura</span></td>
    <td>${celulaPrevisoes(item)}</td>
  </tr>`;
}

function prioridadesFiltradas() {
  const situacao = filtroSituacao.value;
  return componentesPrioritarios.filter((item) =>
    situacao === "todas" || item.eventos.some((evento) => evento.tipo === situacao));
}

function renderizarPrioridades() {
  const encontradas = prioridadesFiltradas();
  listaPrioridades.innerHTML = encontradas.length ? encontradas.map(linhaPrioridade).join("") :
    '<tr><td colspan="5" class="sem_prioridades">Nenhum componente encontrado para a situação selecionada.</td></tr>';
  regiaoPrioridades.scrollTop = 0;
}

filtroSituacao.addEventListener("change", renderizarPrioridades);
renderizarPrioridades();

const escalaPressao = Math.max(4, Math.ceil(Math.max(...pressaoSemanal.map((semana) => semana.torres.length)) / 2) * 2);
document.getElementById("eixo-pressao").innerHTML = [escalaPressao, escalaPressao / 2, 0].map((marca) => `<span>${marca}</span>`).join("");
document.getElementById("semanas-pressao").innerHTML = pressaoSemanal.map((semana, i) => {
  const quantidade = semana.torres.length;
  const numeroSemana = i + 1;
  const listaTorres = quantidade ? formatoLista.format(semana.torres.map((torre) => torre.nome)) : "Nenhuma torre sob pressão.";
  return `<li style="--altura: ${quantidade / escalaPressao * 100}%">
    <div class="barra_pressao" tabindex="0" role="img"
      aria-label="Semana ${numeroSemana}, ${quantidade} ${unidadeTorre(quantidade)} sob pressão"
      aria-describedby="torres-pressao-${numeroSemana}"><span>${quantidade}</span></div>
    <div class="tooltip_pressao" id="torres-pressao-${numeroSemana}" role="tooltip">${listaTorres}</div>
    <span class="semana_pressao" aria-hidden="true">S${numeroSemana}</span>
  </li>`;
}).join("");

function formatarTorreSobPressao(torre, componentes) {
  return `${torre.nome} (${formatoLista.format(componentes.map((item) => item.nome))})`;
}

function listarMudancas(origem, destino) {
  return origem.torres.flatMap((torre) => {
    if (destino.torres.some((item) => item.nome === torre.nome)) return [];
    const comparavel = destino.analisaveis.find((item) => item.nome === torre.nome);
    const componentes = torre.sobPressao.filter((item) => comparavel?.componentes.includes(item));
    return componentes.length ? [formatarTorreSobPressao(torre, componentes)] : [];
  });
}

const entradas = listarMudancas(pressaoFinal, pressaoInicial);
const saidas = listarMudancas(pressaoInicial, pressaoFinal);
const torresSobPressaoInicial = new Set(pressaoInicial.torres.map((torre) => torre.nome));
const permanencias = pressaoFinal.torres
  .filter((torre) => torresSobPressaoInicial.has(torre.nome))
  .map((torre) => formatarTorreSobPressao(torre, torre.sobPressao));
document.getElementById("resumo-pressao").textContent =
  `O total de torres sob pressão ${descreverMudanca(pressaoFinal.torres.length, pressaoInicial.torres.length)}.`;
document.getElementById("mudancas-pressao").innerHTML = [
  ["Entraram em pressão", entradas, "Nenhuma mudança comparável."],
  ["Saíram de pressão", saidas, "Nenhuma mudança comparável."],
  ["Continuam sob pressão", permanencias, "Nenhuma torre sob pressão nas duas semanas."],
].map(([rotulo, lista, vazio]) => `<div><dt>${rotulo}</dt><dd>${lista.length ? formatoLista.format(lista) : vazio}</dd></div>`).join("");

const botaoMenu = document.querySelector(".botao_menu");
const navegacao = document.getElementById("navegacao");

function definirMenu(aberto) {
  document.body.classList.toggle("menu-aberto", aberto);
  botaoMenu.setAttribute("aria-expanded", String(aberto));
  botaoMenu.querySelector("span").textContent = aberto ? "Fechar menu" : "Menu";
}

botaoMenu.addEventListener("click", () => {
  const abrir = !document.body.classList.contains("menu-aberto");
  definirMenu(abrir);
  if (abrir) navegacao.querySelector("a").focus();
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && document.body.classList.contains("menu-aberto")) {
    definirMenu(false);
    botaoMenu.focus();
  }
});

document.addEventListener("click", (evento) => {
  if (document.body.classList.contains("menu-aberto") &&
      !navegacao.contains(evento.target) && !botaoMenu.contains(evento.target)) {
    definirMenu(false);
  }
});

window.matchMedia("(max-width: 900px)").addEventListener("change", () => definirMenu(false));

const nomeUsuario = sessionStorage.getItem("NOME_USUARIO")?.trim();
const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO")?.trim();

if (nomeUsuario) {
  document.getElementById("nome_usuario").textContent = nomeUsuario;
  document.getElementById("cargo_usuario").textContent = cargoUsuario || "";
  document.getElementById("avatar_usuario").textContent = nomeUsuario
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

document.getElementById("botao_sair").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "./login.html";
});
