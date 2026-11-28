function escaparHtml(valor) {
  const entidades = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return valor.replace(/[&<>"']/g, (caractere) => entidades[caractere]);
}

function renderizarDashboard(torres, ultimaAtualizacao, mensagemIndisponivel = "") {
  const panoramaAtual = torres;
  const formatoData = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  const atualizacao = document.getElementById("ultima-atualizacao");
  atualizacao.dateTime = ultimaAtualizacao ?? "";
  atualizacao.textContent = ultimaAtualizacao ? formatoData.format(new Date(ultimaAtualizacao)) : "Aguardando leituras";
  const temLeituras = panoramaAtual.some((torre) => ["normal", "atencao", "critico"].includes(torre.situacao));

  const rotulosSituacao = {
    normal: ["Normal", "normal", "fa-circle-check"],
    atencao: ["Em atenção agora", "alerta", "fa-triangle-exclamation"],
    critico: ["Crítico agora", "critico", "fa-circle-exclamation"],
    atencao_prevista: ["Atenção prevista", "prevista", "fa-clock"],
    critico_previsto: ["Crítico previsto", "critica_prevista", "fa-clock"],
    crescimento: ["Crescimento preocupante", "alerta", "fa-arrow-trend-up"],
    pressao: ["Sob pressão", "alerta", "fa-triangle-exclamation"],
    sem_dados: ["Sem dados", "normal sem_monitoramento", "fa-circle-question"],
  };
  const ordemSituacoes = ["critico", "atencao", "critico_previsto", "atencao_prevista", "crescimento", "pressao"];
  const formatoNumero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const percentual = (valor) => `${formatoNumero.format(valor)}%`;
  const comSinal = (valor) => `${valor > 0 ? "+" : ""}${formatoNumero.format(valor)}`;
  const prazo = (dias) => `${dias} ${dias === 1 ? "dia" : "dias"}`;

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
    const tipo = a.eventos[0]?.tipo;
    const diferencaDeGravidade = ordemSituacoes.indexOf(tipo) - ordemSituacoes.indexOf(b.eventos[0]?.tipo);
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
    if (item.crescente) eventos.push({ tipo: "crescimento" });
    if (item.sobPressao) eventos.push({ tipo: "pressao" });
    eventos.sort((a, b) => ordemSituacoes.indexOf(a.tipo) - ordemSituacoes.indexOf(b.tipo));
    return { ...item, torre: torre.nome, eventos };
  })).filter((item) => item.exibirTabela).sort((a, b) =>
    (a.prioridade ?? 99) - (b.prioridade ?? 99) || compararPrioridades(a, b));

  function prioridadeNoMapa(torre) {
    if (torre.criticoPrevisto) return 0;
    if (torre.atencaoPrevista) return 1;
    return torre.crescente ? 2 : 3;
  }

  function cartaoTorre(torre) {
    const [, classe] = rotulosSituacao[torre.situacao];
    const componentes = torre.componentes.filter((item) =>
      item.exibirTabela);
    const detalhe = [...new Set(componentes.map((item) => item.nome))].join(" · ");
    const alertasComponentes = torre.componentes.flatMap((item) => {
      const alertas = [];
      if (item.situacao === "critico" || item.situacao === "atencao") {
        alertas.push({
          texto: `${item.nome} · ${rotulosSituacao[item.situacao][0]}`,
          classe: item.situacao === "critico" ? "texto_critico" : "texto_atencao",
        });
      }
      for (const evento of item.previsoes ?? []) {
        alertas.push({
          texto: `${item.nome} · ${rotuloEvento({ ...evento, tipo: classePrevisao(evento.nivel) })}`,
          classe: evento.nivel === "critico" ? "texto_critico" : "texto_atencao",
        });
      }
      return alertas;
    });
    const resumo = [torre.nome, ...alertasComponentes.map((alerta) => alerta.texto)].join(" · ");
    return `<li><div class="torre_status ${classe}" title="${escaparHtml(resumo)}">
      <span class="torre_linha">
        <span class="torre_nome">${escaparHtml(torre.nome)}</span>
        <span class="indicadores_torre" aria-hidden="true">
          ${torre.atencaoPrevista ? '<i class="fa-regular fa-clock texto_atencao" title="Atenção prevista"></i>' : ""}
          ${torre.criticoPrevisto ? '<i class="fa-regular fa-clock texto_critico" title="Crítico previsto"></i>' : ""}
          ${torre.crescente ? '<i class="fa-solid fa-arrow-trend-up"></i>' : ""}
        </span>
      </span>
      ${detalhe ? `<span class="torre_detalhe">${escaparHtml(detalhe)}</span>` : ""}
      <span class="torre_atualizacao">Última leitura <time datetime="${escaparHtml(torre.ultimaLeitura ?? "")}">${torre.ultimaLeitura ? formatoData.format(new Date(torre.ultimaLeitura)) : "Aguardando leituras"}</time></span>
    </div></li>`;
  }

  const mapaTorres = document.getElementById("mapa-torres");
  const torresOrdenadas = [...panoramaAtual].sort((a, b) => prioridadeNoMapa(a) - prioridadeNoMapa(b));
  const mensagemSemTorres = "Sem torres nessa classificação.";
  mapaTorres.innerHTML = [
    ["critico", "Críticas", "fa-circle-exclamation"],
    ["atencao", "em atenção", "fa-triangle-exclamation"],
    ["previsao", "com previsão de alerta", "fa-clock"],
  ].flatMap(([grupo, titulo, icone]) => {
    const torres = torresOrdenadas.filter((torre) => grupo === "previsao"
      ? torre.atencaoPrevista || torre.criticoPrevisto
      : torre.situacao === grupo);
    return `<article class="grupo_torres indicador_situacao" data-grupo="${grupo}">
      <h2 id="titulo-torres-${grupo}"><i class="fa-solid ${icone}" aria-hidden="true"></i> Torres ${titulo.toLowerCase()}</h2>
      <p class="total_situacao">${!mensagemIndisponivel && (temLeituras || !panoramaAtual.length) ? torres.length : "—"}</p>
      <div class="rolagem_mapa_torres" tabindex="0" role="region" aria-labelledby="titulo-torres-${grupo}">
        ${torres.length ? `<ul class="mapa_torres">${torres.map(cartaoTorre).join("")}</ul>` : `<p class="situacao_vazia">${mensagemSemTorres}</p>`}
      </div>
    </article>`;
  }).join("");

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
    const variacao = Number.isFinite(item.variacao) ? `${comSinal(item.variacao)} p.p.` : "—";
    return `<tr>
      <th scope="row"><span class="nome_torre_prioridade">${escaparHtml(item.torre)}</span>
        <span class="sub_item">${escaparHtml(item.nome)}${item.pc ? " · " + escaparHtml(item.pc) : ""}</span></th>
      <td>${variacao}</td>
      <td><span class="texto_atencao">Atenção: ${percentual(item.atencao)}</span>
        <span class="sub_item texto_critico">Crítico: ${percentual(item.critico)}</span></td>
      <td>${tagSituacao({ tipo: item.situacao })}<span class="sub_item">${leituraValida(item.atual) ? percentual(item.atual) + " na última leitura" : "Sem leitura disponível"}</span>
        ${item.crescente ? '<span class="sub_item texto_atencao">Crescimento preocupante</span>' : ""}
        ${item.sobPressao ? '<span class="sub_item texto_atencao">Sob pressão</span>' : ""}</td>
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
    const mensagem = panoramaAtual.some((torre) => ["normal", "atencao", "critico"].includes(torre.situacao))
      ? "Nenhum componente encontrado para a situação selecionada."
      : "Sem leituras recentes para identificar prioridades.";
    listaPrioridades.innerHTML = encontradas.length ? encontradas.map(linhaPrioridade).join("") :
      `<tr><td colspan="5" class="sem_prioridades">${mensagem}</td></tr>`;
    regiaoPrioridades.scrollTop = 0;
  }

  filtroSituacao.onchange = renderizarPrioridades;
  renderizarPrioridades();

}

// Menu controlado por global.js.
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

async function carregarDashboard() {
  const estado = document.getElementById("estado-dashboard");
  renderizarDashboard([], null, "Carregando torres…");
  try {
    const resposta = await fetch("/dashboard/capacidade", { cache: "no-store" });
    if (resposta.status === 401) {
      renderizarDashboard([], null, "Entre novamente para carregar as torres.");
      estado.textContent = "";
      estado.hidden = true;
      return;
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || "Falha ao consultar a dashboard");
    renderizarDashboard(dados.torres, dados.ultimaAtualizacao);
    estado.textContent = dados.torres.length
      ? dados.torres.length + " torres disponíveis. " + (dados.mensagem || "")
      : "Nenhuma torre disponível para seu usuário.";
  } catch (erro) {
    renderizarDashboard([], null, "Não foi possível carregar as torres.");
    console.error("Erro ao carregar a dashboard:", erro);
    estado.textContent = erro.message;
  }
}

carregarDashboard();

const botaoKpis = document.getElementById("alternar-kpis");
const indicadoresOperacionais = document.getElementById("indicadores-operacionais");

botaoKpis.addEventListener("click", () => {
  indicadoresOperacionais.hidden = !indicadoresOperacionais.hidden;
  botaoKpis.setAttribute("aria-expanded", String(!indicadoresOperacionais.hidden));
  botaoKpis.textContent = indicadoresOperacionais.hidden ? "Visualizar KPIs" : "Ocultar KPIs";
});
