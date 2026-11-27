var suporteModel = require("../models/suporteModel");

function responderErro(res, status, mensagem) {
  return res.status(status).json({ mensagem: mensagem });
}

// O model fala em erros de S3; a API fala em status HTTP.
async function buscarCaptura(req, res) {
  try {
    var resultado = await suporteModel.buscarCapturaSuporte();
    return res.status(200).json(resultado);
  } catch (erro) {
    if (erro instanceof suporteModel.ErroConfiguracao) {
      console.error("Configuração AWS/S3 inválida:", erro.message);
      return responderErro(
        res,
        500,
        "O servidor não está configurado para acessar o S3."
      );
    }

    if (erro instanceof suporteModel.CapturaNaoEncontradaError) {
      return responderErro(res, 404, erro.message);
    }

    if (erro instanceof suporteModel.ErroJsonInvalido) {
      console.error("Captura inválida no S3:", erro.message);
      return responderErro(
        res,
        502,
        "A captura mais recente no S3 não contém um JSON válido."
      );
    }

    if (erro instanceof suporteModel.ErroLeituraS3) {
      console.error("Falha de leitura no S3:", erro.message);
      return responderErro(res, 502, erro.message);
    }

    console.error("Erro inesperado ao buscar captura de suporte:", erro);
    return responderErro(
      res,
      500,
      "Erro interno ao buscar a captura de suporte."
    );
  }
}

module.exports = {
  buscarCaptura,
};
