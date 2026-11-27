var goldService = require("./goldService");

var ARQUIVO_PROCESSOS = "processos_atencao.json";

function listaOuVazio(valor) {
  return Array.isArray(valor) ? valor : [];
}

function objetoOuVazio(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

async function carregarProcessos() {
  var dados = await goldService.buscarJson(ARQUIVO_PROCESSOS);

  return {
    atualizado_em: dados.atualizado_em || null,
    resumo: objetoOuVazio(dados.resumo),
    kpis: objetoOuVazio(dados.kpis),
    processos: listaOuVazio(dados.processos),
    processos_que_exigem_atencao: listaOuVazio(dados.processos_que_exigem_atencao),
    status_pcs: listaOuVazio(dados.status_pcs),
  };
}

module.exports = { carregarProcessos };
