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

function listarMineradorasMonitoradas() {
    var instrucaoSql = `
        SELECT
            e.id_empresa AS ID_MINERADORA,
            e.razao_social AS MINERADORA,
            'Normal' AS ESTADO,
            COUNT(DISTINCT t.id_torre) AS TOTAL_TORRES,
            COUNT(DISTINCT CASE WHEN pc.status_operacional = 'Ativo' THEN t.id_torre END) AS TORRES_NORMAIS,
            0 AS TORRES_DESCONHECIDAS,
            0 AS TORRES_ATENCAO,
            0 AS TORRES_CRITICAS,
            0 AS ALERTAS_HOJE,
            0 AS ALERTAS_ONTEM
        FROM empresa e
        LEFT JOIN torre t ON t.fk_mineradora = e.id_empresa
        LEFT JOIN PC_Industrial pc ON pc.fk_torre = t.id_torre
        WHERE e.tipo = 'Mineradora'
        GROUP BY e.id_empresa, e.razao_social
        ORDER BY e.razao_social ASC;
    `;

    return database.executar(instrucaoSql);
}

module.exports = {
    cadastrar,
    listarMineradoras,
    listarMineradorasMonitoradas
};