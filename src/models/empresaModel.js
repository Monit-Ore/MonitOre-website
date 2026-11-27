const database = require("../database/config");

function cadastrar(razaoSocial, cnpj, email, tipo) {
    console.log("Executando query com:", razaoSocial, cnpj, email, tipo);

    const instrucaoSql = `
        INSERT INTO empresa (razao_social, cnpj, email, tipo)
        VALUES ('${razaoSocial}', '${cnpj}', '${email}', '${tipo}');
    `;
    return database.executar(instrucaoSql);
}

function listarMineradoras(idUsuario) {
    var instrucaoSql = `
        SELECT 
	        DISTINCT e.razao_social AS Mineradoras
        FROM torre t
        JOIN empresa e ON t.fk_mineradora = e.id_empresa
        JOIN permissionamento p ON p.torre_id_torre = t.id_torre
        WHERE p.usuario_id_usuario = ${idUsuario};
    `;

    return database.executar(instrucaoSql);
}

module.exports = {
    cadastrar,
    listarMineradoras
};