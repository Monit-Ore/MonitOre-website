var database = require("../database/config");

var mysql = require("mysql2");

function mapearStatusServidorBanco(statusForm) {
  const mapa = {
    Ativo: "Online",
    Inativo: "Offline",
    Alerta: "Alerta",
    Manutenção: "Manutenção",
  };
  return mapa[statusForm] || "Offline";
}

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

async function verificarCodigoExistente(fkEmpresa, codigo) {
  var empresa = mysql.escape(fkEmpresa);
  var codigoEscapado = mysql.escape(codigo);
  var instrucaoSql = `SELECT id_torre
      FROM torre
      WHERE fk_empresa = ${empresa}
        AND codigo = ${codigoEscapado}`;
  var resultado = await database.executar(instrucaoSql);

  return resultado.length > 0;
}

async function criarTorre(
  fkEmpresa,
  nome,
  codigo,
  fk_mineradora,
  localizacao,
  estado,
  cidade,
  descricao,
  monitoramento_ativo,
  servidor,
  componentes,
) {
  var instrucaoTorre = `INSERT INTO torre
        (nome, codigo, localizacao, estado, cidade, descricao, status_operacional, monitoramento_ativo, fk_empresa, fk_mineradora)
       VALUES (
        ${mysql.escape(nome)},
        ${mysql.escape(codigo)},
        ${mysql.escape(localizacao)},
        ${mysql.escape(estado)},
        ${mysql.escape(cidade)},
        ${mysql.escape(descricao || null)},
        'Operacional',
        ${mysql.escape(monitoramento_ativo ?? true)},
        ${mysql.escape(fkEmpresa)},
        ${mysql.escape(fk_mineradora)}
       )`;
  var resultadoTorre = await database.executar(instrucaoTorre);
  var idTorre = resultadoTorre.insertId;

  var instrucaoIhm = `INSERT INTO ihm
        (uuid_agente, hostname, ip, sistema_operacional, status_operacional, fk_torre)
       VALUES (
        ${mysql.escape(servidor.uuid_agente)},
        ${mysql.escape(servidor.hostname || null)},
        ${mysql.escape(servidor.ip)},
        ${mysql.escape(servidor.sistema_operacional)},
        ${mysql.escape(mapearStatusServidorBanco(servidor.status))},
        ${mysql.escape(idTorre)}
       )`;
  var resultadoIhm = await database.executar(instrucaoIhm);
  var idIhm = resultadoIhm.insertId;

  if (Array.isArray(componentes) && componentes.length > 0) {
    var valores = componentes
      .map(
        (componente) =>
          `(${mysql.escape(idIhm)}, ${mysql.escape(
            componente.fk_componente,
          )}, ${mysql.escape(componente.valor_limite)})`,
      )
      .join(", ");
    var instrucaoComponentes = `INSERT INTO ihm_componente
        (fk_ihm, fk_componente, valor_limite)
       VALUES ${valores}`;

    await database.executar(instrucaoComponentes);
  }

  return { id_torre: idTorre, id_ihm: idIhm };
}

module.exports = {
  mapearStatusServidorBanco,
  listarTorresComMineradora,
  verificarCodigoExistente,
  criarTorre,
};
