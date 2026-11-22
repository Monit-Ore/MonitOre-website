var mineradoraModel = require("../models/mineradoraModel");

async function buscarMineradoras(res) {
    try {
        var resultado = await mineradoraModel.buscarMineradoras();
        return res.status(200).json(resultado);
    } catch (erro) {
        console.erro("Erro ao buscar mineradoras: ", erro);

        return res.status(500).json({
            mensagem: "Erro ao buscar mineradoras.",
        });
    }
}

module.exports = {
  buscarMineradoras
}