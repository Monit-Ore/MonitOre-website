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

async function verificarCodigoExistente(fkEmpresa, codigo, uuidAgente) {
  var empresa = mysql.escape(fkEmpresa);
  var codigoEscapado = mysql.escape(codigo);
  var uuidEscapado = mysql.escape(uuidAgente);
  var instrucaoSql = `SELECT t.id_torre
      FROM torre t
      LEFT JOIN plc p ON p.fk_torre = t.id_torre
      WHERE t.fk_empresa = ${empresa}
        AND (t.codigo = ${codigoEscapado}
          OR p.uuid_agente = ${uuidEscapado})`;
  var resultado = await database.executar(instrucaoSql);

  return resultado.length > 0;
}

async function listarMineradoras(fkEmpresa) {
  var instrucaoSql = `SELECT DISTINCT m.id_mineradora, m.razao_social
     FROM mineradora m
     INNER JOIN torre t ON t.fk_mineradora = m.id_mineradora
     WHERE t.fk_empresa = ${mysql.escape(fkEmpresa)}
     ORDER BY m.razao_social ASC`;
  return database.executar(instrucaoSql);
}

async function criarTorre(
  fkEmpresa,
  nome,
  codigo,
  fk_mineradora,
  localizacao,
  descricao,
  monitoramento_ativo,
  servidor,
  componentes,
) {
  var instrucaoTorre = `INSERT INTO torre
        (nome, codigo, localizacao, descricao, status_operacional, monitoramento_ativo, fk_empresa, fk_mineradora)
       VALUES (
        ${mysql.escape(nome)},
        ${mysql.escape(codigo)},
        ${mysql.escape(localizacao)},
        ${mysql.escape(descricao || null)},
        'Operacional',
        ${mysql.escape(monitoramento_ativo ?? true)},
        ${mysql.escape(fkEmpresa)},
        ${mysql.escape(fk_mineradora)}
       )`;
  var resultadoTorre = await database.executar(instrucaoTorre);
  var idTorre = resultadoTorre.insertId;

  var instrucaoPlc = `INSERT INTO plc
        (uuid_agente, hostname, ip, sistema_operacional, status_operacional, fk_torre)
       VALUES (
        ${mysql.escape(servidor.uuid_agente)},
        ${mysql.escape(servidor.hostname || null)},
        ${mysql.escape(servidor.ip)},
        ${mysql.escape(servidor.sistema_operacional)},
        ${mysql.escape(mapearStatusServidorBanco(servidor.status))},
        ${mysql.escape(idTorre)}
       )`;
  var resultadoPlc = await database.executar(instrucaoPlc);
  var idPlc = resultadoPlc.insertId;

  if (Array.isArray(componentes) && componentes.length > 0) {
    var valores = componentes
      .map(
        (componente) =>
          `(${mysql.escape(idPlc)}, ${mysql.escape(
            componente.fk_componente,
          )}, ${mysql.escape(componente.valor_limite)})`,
      )
      .join(", ");
    var instrucaoComponentes = `INSERT INTO plc_componente
        (fk_plc, fk_componente, valor_limite)
       VALUES ${valores}`;

    await database.executar(instrucaoComponentes);
  }

  return { id_torre: idTorre, id_plc: idPlc };
}

module.exports = {
  mapearStatusServidorBanco,
  listarTorresComMineradora,
  verificarCodigoExistente,
  listarMineradoras,
  criarTorre,
};
