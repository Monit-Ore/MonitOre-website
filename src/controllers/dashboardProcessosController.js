var dashboardProcessosService = require("../services/dashboardProcessosService");

async function carregarProcessos(req, res) {
  try {
    var dados = await dashboardProcessosService.carregarProcessos();
    return res.status(200).json(dados);
  } catch (erro) {
    var status = erro.status || 500;
    if (status === 500) {
      console.error("Erro ao carregar processos da dashboard:", erro);
    }
    return res.status(status).json({
      mensagem: erro.message || "Erro ao carregar processos da dashboard.",
    });
  }
}

module.exports = { carregarProcessos };
