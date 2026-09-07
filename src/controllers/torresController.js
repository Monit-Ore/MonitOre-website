var torresModel = require("../models/torresModel");

function mapearStatusExibicao(statusBanco) {
  return statusBanco === "Alerta" ? "Alerta" : "Regular";
}

async function selecaoTorre(req, res) {
  try {
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const torres = await torresModel.listarTorresComMineradora(fkEmpresa);
    const mapaMineradoras = new Map();

    torres.forEach((torre) => {
      const nomeMineradora = torre.mineradora_nome;

      if (!mapaMineradoras.has(nomeMineradora)) {
        mapaMineradoras.set(nomeMineradora, []);
      }

      mapaMineradoras.get(nomeMineradora).push({
        id_torre: torre.id_torre,
        codigo: torre.codigo,
        status: mapearStatusExibicao(torre.status_operacional),
      });
    });

    const resposta = Array.from(
      mapaMineradoras,
      ([mineradora, listaTorres]) => ({
        mineradora,
        torres: listaTorres,
      }),
    );

    res.status(200).json(resposta);
    console.log("Resposta enviada:", resposta);
  } catch (erro) {
    console.error("Erro ao buscar torres para seleção:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar torres." });
  }
}

module.exports = {
  mapearStatusExibicao,
  selecaoTorre,
};
