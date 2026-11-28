var dashboardCapacidadeModel = require("../models/dashboardCapacidadeModel");
var goldService = require("../services/goldService_dashCapacidade");

async function buscarPanorama(req, res) {
  const idUsuario = req.session?.ID_USUARIO;
  const fkEmpresa = req.session?.FK_EMPRESA_USUARIO;

  res.set("Cache-Control", "no-store");

  if (!idUsuario || !fkEmpresa) {
    return res.status(401).json({ mensagem: "Entre no MonitOre para consultar a dashboard." });
  }

  try {
    const cadastros = await dashboardCapacidadeModel.buscarTorres(idUsuario, fkEmpresa);
    if (!cadastros.length) {
      return res.status(200).json({ torres: [], ultimaAtualizacao: null, mensagem: "" });
    }
    let panorama;
    try {
      const gold = await goldService.carregarGold();
      panorama = goldService.montarPanorama(cadastros, gold);
    } catch (erro) {
      console.error("Erro ao ler a camada Gold:", erro.message);
      return res.status(503).json({ mensagem: "Dados da camada Gold indisponíveis. Tente novamente após a atualização dos arquivos." });
    }
    return res.status(200).json({
      ...panorama,
      mensagem: panorama.ultimaAtualizacao ? "" : "Aguardando leituras na camada Gold.",
    });
  } catch (erro) {
    console.error("Erro ao buscar o panorama de capacidade:", erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar os dados de capacidade." });
  }
}

module.exports = { buscarPanorama };
