// empresaController.js
const empresaModel = require("../models/empresaModel");

function cadastrar(req, res) {
    
    const razaoSocial = req.body.razaoSocial || req.body.razao_social || req.body.nome;
    const cnpj = req.body.cnpj;
    const email = req.body.email;
    const tipo = req.body.tipo || "Mineradora";

    console.log("Valores recebidos:", { razaoSocial, cnpj, email, tipo });

    if (!razaoSocial) {
        return res.status(400).json({ mensagem: "A Razão Social é obrigatória!" });
    }
    if (!email) {
        return res.status(400).json({ mensagem: "O E-mail é obrigatório!" });
    }
    if (!cnpj) {
        return res.status(400).json({ mensagem: "O CNPJ é obrigatório!" });
    }

    
    empresaModel.cadastrar(razaoSocial, cnpj, email, tipo)
        .then((resultado) => {
            res.status(201).json({ mensagem: "Mineradora cadastrada com sucesso!" });
        })
        .catch((erro) => {
            console.error("Erro no cadastro:", erro);
            res.status(500).json(erro.sqlMessage || erro);
        });
}

module.exports = {
    cadastrar
};