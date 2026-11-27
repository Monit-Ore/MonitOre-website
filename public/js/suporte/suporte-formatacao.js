// Funções puras: recebem um valor e devolvem texto ou classe CSS. Não tocam na tela.
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

// Regra da tabela: risco é prazo entre 0 e 4 horas. O KPI usa o campo de 24 horas vindo do JSON.
function estaEmRisco(chamado) {
  return !chamado.sla_vencido && chamado.prazo_sla_em > 0 && chamado.prazo_sla_em <= 4 * 60 * 60;
}

export {
  calcularPercentual,
  formatarVariacaoQuantidade,
  obterClasseVariacaoAbertos,
  formatarHorasAtraso,
  formatarVariacaoSla,
  obterClasseVariacaoSla,
  obterClasseDesempenhoSla,
  normalizar,
  obterClassePrioridade,
  obterClasseStatus,
  escaparHtml,
  formatarPrazoSla,
  estaEmRisco,
};
