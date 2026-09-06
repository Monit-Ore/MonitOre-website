var database = require("../database/config")

function CaptarEquipe() {
    console.log("ACESSEI O EQUIPE MODEL \n \n\t\t >> Se aqui der erro de 'Error: connect ECONNREFUSED',\n \t\t >> verifique suas credenciais de acesso ao banco\n \t\t >> e se o servidor de seu BD está rodando corretamente.")
    var instrucaoSql = `
    SELECT
    nome,
    cargo,
    descricao,
    githubUrl,
    linkedinUrl,
    email,
    caminhoFoto
    FROM equipe;
    `
    console.log("Executando a instrução SQL: \n" + instrucaoSql);
    return database.executar(instrucaoSql);
}

module.exports = {
    CaptarEquipe
}