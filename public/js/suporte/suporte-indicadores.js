import { estado } from "./suporte-estado.js";
import { mensagemDoErro } from "./suporte-api.js";
import {
  calcularPercentual,
  formatarVariacaoQuantidade,
  obterClasseVariacaoAbertos,
  formatarHorasAtraso,
  formatarVariacaoSla,
  obterClasseVariacaoSla,
  obterClasseDesempenhoSla,
  escaparHtml,
} from "./suporte-formatacao.js";

// KPIs e textos do painel de SLA. O HTML apenas oferece os IDs.
function definirAvisoDemonstrativo(visivel) {
  const aviso = document.querySelector(".aviso_dados");
  if (!aviso) return;

  const mostrar = visivel === undefined ? estado.dadosSaoDemonstrativos : visivel;
  aviso.hidden = !mostrar;
  aviso.style.display = mostrar ? "" : "none";
}

function atualizarDescricaoChamados() {
  const descricao = document.getElementById("descricao_chamados");
  if (!descricao) return;

  descricao.textContent = estado.dadosSaoDemonstrativos
    ? "Amostra demonstrativa de chamados vencidos, em risco e críticos"
    : "Chamados vencidos, em risco e críticos da captura mais recente";
}

function mostrarErroDashboard(erro) {
  const mensagem = mensagemDoErro(erro);

  document.getElementById("tabela_chamados").innerHTML =
    '<tr><td colspan="7">' + escaparHtml(mensagem) + "</td></tr>";
  document.getElementById("texto_aviso_sla").textContent = mensagem;
  document.getElementById("data_atualizacao").textContent = "Dados não disponíveis";
  document.getElementById("rodape_tabela").textContent = "Nenhum dado carregado.";
  definirAvisoDemonstrativo(false);
}

function mostrarIndicadores(dados, historico = {}) {
  const indicadores = dados.indicadores;
  const sla = indicadores.cumprimento_sla;
  const dataAtualizacao = new Date(dados.metadados.extraido_em);
  const horaAtualizacao = dataAtualizacao.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const percentualSla = calcularPercentual(sla.resolvidos_no_prazo, sla.total_elegiveis);
  const variacaoSla = percentualSla - sla.percentual_anterior;
  const elementoVariacao = document.getElementById("variacao_sla");

  estado.metaSla = sla.meta_percentual;

  document.getElementById("data_atualizacao").textContent = "Atualizado às " + horaAtualizacao;
  document.getElementById("chamados_abertos").textContent = indicadores.chamados_abertos;
  document.getElementById("chamados_criticos").textContent = String(indicadores.chamados_criticos).padStart(2, "0");
  document.getElementById("sla_em_risco").textContent = String(indicadores.sla_em_risco).padStart(2, "0") + " chamados";
  document.getElementById("sla_vencido").textContent = String(indicadores.sla_vencido).padStart(2, "0") + " chamados";

  const elementoVariacaoAbertos = document.getElementById("variacao_abertos");
  const periodoComparacao = estado.dadosSaoDemonstrativos
    ? dados.metadados.periodo_comparacao
    : "captura anterior";

  if (estado.dadosSaoDemonstrativos) {
    const variacaoAbertos = indicadores.variacao_chamados_abertos;
    elementoVariacaoAbertos.textContent = formatarVariacaoQuantidade(variacaoAbertos, periodoComparacao);
    elementoVariacaoAbertos.className = "kpi_detalhe variacao " + obterClasseVariacaoAbertos(variacaoAbertos);
  } else if (historico.disponivel && Number.isFinite(historico.variacaoChamadosAbertos)) {
    const variacaoAbertos = historico.variacaoChamadosAbertos;
    elementoVariacaoAbertos.textContent = formatarVariacaoQuantidade(variacaoAbertos, periodoComparacao);
    elementoVariacaoAbertos.className = "kpi_detalhe variacao " + obterClasseVariacaoAbertos(variacaoAbertos);
  } else {
    elementoVariacaoAbertos.textContent = "Sem histórico";
    elementoVariacaoAbertos.className = "kpi_detalhe variacao neutra";
  }

  document.getElementById("parados_sete_dias").textContent =
    indicadores.chamados_parados_sete_dias + " parados há mais de 7 dias";
  document.getElementById("criticos_sem_responsavel").textContent =
    indicadores.chamados_criticos_sem_responsavel + " sem responsável";
  document.getElementById("criticos_vencidos").textContent =
    indicadores.chamados_criticos_vencidos + " vencidos";
  document.getElementById("risco_proximas_24_horas").textContent =
    indicadores.sla_vencem_proxima24horas + " vencem nas próximas 24 horas";
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

function prepararQuebrasSla(quebras) {
  estado.quebrasSla = quebras || {};

  if (!estado.quebrasSlaPreparadas) {
    document.querySelectorAll(".filtro_quebra").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.quebraSlaSelecionada = botao.dataset.quebra;
        document.querySelectorAll(".filtro_quebra").forEach((item) => {
          item.classList.remove("ativo");
          item.setAttribute("aria-pressed", "false");
        });
        botao.classList.add("ativo");
        botao.setAttribute("aria-pressed", "true");
        desenharQuebrasSla();
      });
    });

    estado.quebrasSlaPreparadas = true;
  }

  desenharQuebrasSla();
}

function desenharQuebrasSla() {
  const itens = estado.quebrasSla[estado.quebraSlaSelecionada] || [];
  const lista = document.getElementById("lista_quebras_sla");

  lista.innerHTML = itens.map((item) => {
    const percentual = calcularPercentual(item.resolvidos_no_prazo, item.total_elegiveis);
    const classeDesempenho = obterClasseDesempenhoSla(percentual, estado.metaSla);

    return '<div class="quebra_item">' +
      '<div class="quebra_cabecalho"><span>' + escaparHtml(item.categoria) + '</span>' +
      '<strong class="' + classeDesempenho + '">' + percentual + '%</strong></div>' +
      '<div class="quebra_barra"><span class="' + classeDesempenho + '" style="width:' + percentual + '%"></span></div>' +
      '<div class="quebra_volume">' + item.resolvidos_no_prazo + " de " + item.total_elegiveis +
      " chamados · meta " + estado.metaSla + "%</div></div>";
  }).join("");

  document.getElementById("total_quebra_sla").textContent =
    itens.reduce((soma, item) => soma + item.resolvidos_no_prazo, 0) + " de " +
    itens.reduce((soma, item) => soma + item.total_elegiveis, 0);
}

export {
  definirAvisoDemonstrativo,
  atualizarDescricaoChamados,
  mostrarErroDashboard,
  mostrarIndicadores,
  prepararQuebrasSla,
};
