import { estado } from "./suporte-estado.js";
import { alternarPrioridadesCriticas } from "./suporte-graficos.js";
import {
  normalizar,
  obterClassePrioridade,
  obterClasseStatus,
  escaparHtml,
  formatarPrazoSla,
  estaEmRisco,
} from "./suporte-formatacao.js";

// Filtros e tabela leem sempre estado.chamados; a API devolve os dados brutos.
function prepararFiltros(equipe) {
  preencherFiltroResponsaveis(equipe);

  if (estado.filtrosPreparados) return;

  document.querySelectorAll(".filtros_tabela [data-filtro]").forEach((botao) => {
    botao.addEventListener("click", () => aplicarFiltroTabela(botao.dataset.filtro));
  });

  document.getElementById("busca_chamado").addEventListener("input", mostrarChamados);
  document.getElementById("filtro_responsavel").addEventListener("change", (evento) => {
    estado.responsavelSelecionado = evento.target.value;
    mostrarChamados();
  });
  document.getElementById("botao_so_criticos").addEventListener("click", alternarPrioridadesCriticas);
  document.getElementById("botao_ver_fora_prazo").addEventListener("click", () => aplicarFiltroTabela("vencidos", true));
  document.getElementById("link_aviso_sla").addEventListener("click", (evento) => {
    evento.preventDefault();
    aplicarFiltroTabela("vencidos", true);
  });

  estado.filtrosPreparados = true;
}

function aplicarFiltroTabela(filtro, rolarParaTabela = false) {
  estado.filtroSelecionado = filtro;
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

  estado.chamados.forEach((chamado) => {
    responsaveis.push(chamado.responsavel || "Sem responsável");
  });

  [...new Set(responsaveis)].forEach((responsavel) => {
    const opcao = document.createElement("option");
    opcao.value = responsavel;
    opcao.textContent = responsavel;
    filtro.appendChild(opcao);
  });
}

function mostrarChamados() {
  const busca = document.getElementById("busca_chamado").value.trim().toLowerCase();
  let chamadosFiltrados = estado.chamados;

  if (estado.filtroSelecionado === "vencidos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => item.sla_vencido);
  } else if (estado.filtroSelecionado === "em-risco") {
    chamadosFiltrados = chamadosFiltrados.filter(estaEmRisco);
  } else if (estado.filtroSelecionado === "criticos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => normalizar(item.prioridade) === "critica");
  } else if (estado.filtroSelecionado === "sem-responsavel") {
    chamadosFiltrados = chamadosFiltrados.filter((item) => item.sem_responsavel);
  }

  if (estado.responsavelSelecionado !== "todos") {
    chamadosFiltrados = chamadosFiltrados.filter((item) =>
      (item.responsavel || "Sem responsável") === estado.responsavelSelecionado
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
  document.getElementById("filtro_total").textContent = estado.chamados.length;
  document.getElementById("filtro_vencidos").textContent =
    estado.chamados.filter((item) => item.sla_vencido).length;
  document.getElementById("filtro_em_risco").textContent =
    estado.chamados.filter(estaEmRisco).length;
  document.getElementById("filtro_criticos").textContent =
    estado.chamados.filter((item) => normalizar(item.prioridade) === "critica").length;
  document.getElementById("filtro_sem_responsavel").textContent =
    estado.chamados.filter((item) => item.sem_responsavel).length;
  document.getElementById("total_chamados").textContent =
    estado.chamados.length + (estado.dadosSaoDemonstrativos ? " na amostra" : " na captura");
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
    "Exibindo " + chamados.length + " de " + estado.chamados.length + " chamados · " +
    (estado.dadosSaoDemonstrativos ? "Dados demonstrativos do JIRA" : "Dados do JIRA");
}

export {
  prepararFiltros,
  aplicarFiltroTabela,
  mostrarChamados,
};
