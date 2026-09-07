var database = require("../database/config");

var mysql = require("mysql2");

async function listarTorresComMineradora(fkEmpresa) {
  var empresa = mysql.escape(fkEmpresa);
  var instrucaoSql = `SELECT
      t.id_torre, t.codigo, t.status_operacional,
      m.razao_social AS mineradora_nome
     FROM torre t
     INNER JOIN mineradora m ON m.id_mineradora = t.fk_mineradora
     WHERE t.fk_empresa = ${empresa}
     ORDER BY m.razao_social ASC, t.codigo ASC`;
  return database.executar(instrucaoSql);
}

module.exports = {
  listarTorresComMineradora,
};
