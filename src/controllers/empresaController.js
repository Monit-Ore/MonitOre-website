const database = require("../database/config");

function cadastrar(razaoSocial, cnpj, email, tipo) {
    const instrucaoSql = `
        INSERT INTO empresa (razao_social, cnpj, email, tipo)
        VALUES ('${razaoSocial}', '${cnpj}', '${email}', '${tipo}');
    `;
    return database.executar(instrucaoSql);
}

module.exports = {
    cadastrar
};