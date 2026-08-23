var database = require("../database/config");

var mysql = require("mysql2");


function buscarPorEmail(email) {

    var emailSeguro = mysql.escape(email);


    var instrucaoSql = `
        SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.senha_hash,
            u.primeiro_acesso,
            u.status_atividade AS status_usuario,
            u.fk_cargo,

            c.nome AS cargo,
            c.status_atividade AS status_cargo,
            c.fk_empresa,

            e.razao_social AS empresa,
            e.status_atividade AS status_empresa

        FROM usuario AS u

        INNER JOIN cargo AS c
            ON u.fk_cargo = c.id_cargo

        INNER JOIN empresa AS e
            ON c.fk_empresa = e.id_empresa

        WHERE u.email = ${emailSeguro};
    `;


    console.log("Executando SQL:");

    console.log(instrucaoSql);


    return database.executar(instrucaoSql);
}


function atualizarUltimoAcesso(idUsuario) {

    var instrucaoSql = `
        UPDATE usuario

        SET ultimo_acesso = CURRENT_TIMESTAMP

        WHERE id_usuario = ${Number(idUsuario)};
    `;


    console.log("Executando SQL:");

    console.log(instrucaoSql);


    return database.executar(instrucaoSql);
}

module.exports = {
    buscarPorEmail,
    atualizarUltimoAcesso
};