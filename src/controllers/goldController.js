var goldService = require("../services/goldService");

async function buscarArquivo(req, res) {
  try {
    var dados = await goldService.buscarJson(req.params.arquivo);
    return res.status(200).json(dados);
  } catch (erro) {
    var status = erro.status || 500;
    if (status === 500) {
      console.error("Erro ao servir arquivo gold:", erro);
    }
    return res.status(status).json({
      erro: erro.message || "Erro ao buscar arquivo gold.",
    });
  }
}

module.exports = { buscarArquivo };
