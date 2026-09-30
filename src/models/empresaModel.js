const empresaModel = require("../models/empresaModel");

function cadastrar(req, res) {
    const razaoSocial = req.body.razaoSocial;
    const email = req.body.email;
    const cnpj = req.body.cnpj;
    const tipo = req.body.tipo || "Mineradora";

    if (!razaoSocial) {
        return res.status(400).json({ mensagem: "A Razão Social é obrigatória!" });
    } else if (!email) {
        return res.status(400).json({ mensagem: "O E-mail é obrigatório!" });
    } else if (!cnpj || cnpj.length !== 14) {
        return res.status(400).json({ mensagem: "CNPJ inválido!" });
    }

    empresaModel.cadastrar(razaoSocial, cnpj, email, tipo)
        .then(function (resultado) {
            res.status(201).json({ mensagem: "Mineradora cadastrada com sucesso!" });
        })
        .catch(function (erro) {
            console.error(erro);
            res.status(500).json({ mensagem: "Erro ao cadastrar mineradora no banco de dados." });
        });
}

module.exports = {
    cadastrar
};