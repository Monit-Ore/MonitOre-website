var database = require("../database/config");

var mysql = require("mysql2");


async function listarTorresComMineradora(fkEmpresa) {
  var empresa = mysql.escape(fkEmpresa);

  var instrucaoSql = `SELECT 
    t.id_torre, 
    t.codigo, 
    pc.status_operacional, 
    m.razao_social AS mineradora_nome
    FROM torre t
    INNER JOIN empresa m
      ON m.id_empresa = t.fk_mineradora
    INNER JOIN PC_Industrial pc
      ON pc.fk_torre = t.id_torre
    WHERE t.fk_fabricante = ${empresa}
    ORDER BY
      m.razao_social ASC,
      t.codigo ASC;`;

  return database.executar(instrucaoSql);
}

async function verificarCodigoExistente(fkEmpresa, codigo, uuidAgente) {
  var empresa = mysql.escape(fkEmpresa);
  var codigoEscapado = mysql.escape(codigo);
  var uuidEscapado = mysql.escape(uuidAgente);

  var instrucaoSql = `SELECT t.id_torre
    FROM torre t
    INNER JOIN PC_Industrial pc
      ON pc.fk_torre = t.id_torre
    WHERE t.fk_fabricante = ${empresa}
      AND (
        t.codigo = ${codigoEscapado}
        OR pc.uuid = ${uuidEscapado}
      )`;

  var resultado = await database.executar(instrucaoSql);

  return resultado.length > 0;
}

async function listarMineradoras(fkEmpresa) {
  var instrucaoSql = `SELECT DISTINCT
    m.id_empresa AS id_mineradora,
    m.razao_social
FROM empresa m
INNER JOIN torre t
    ON t.fk_mineradora = m.id_empresa
WHERE t.fk_fabricante = ${mysql.escape(fkEmpresa)}
  AND m.tipo = 'Mineradora'
ORDER BY m.razao_social ASC;`;
  return database.executar(instrucaoSql);
}

async function criarTorre(
  fkEmpresa,
  nome,
  codigo,
  fk_mineradora,
  pc_industrial,
  endereco,
  componentes,
) {
var instrucaoEndereco = `INSERT INTO endereco
    (cep, logradouro, numero, complemento, bairro, cidade, estado)
  VALUES (
    ${mysql.escape(endereco.cep)},
    ${mysql.escape(endereco.logradouro)},
    ${mysql.escape(endereco.numero)},
    ${mysql.escape(endereco.complemento)},
    ${mysql.escape(endereco.bairro)},
    ${mysql.escape(endereco.cidade)},
    ${mysql.escape(endereco.estado)}
  )`;

  var resultadoEndereco = await database.executar(instrucaoEndereco);

  var idEndereco = resultadoEndereco.insertId;

  var instrucaoTorre = `INSERT INTO torre 
      (nome, codigo, fk_fabricante, fk_mineradora, fk_endereco) 
     VALUES ( 
      ${mysql.escape(nome)}, 
      ${mysql.escape(codigo)}, 
      ${mysql.escape(fkEmpresa)}, 
      ${mysql.escape(fk_mineradora)}, 
      ${mysql.escape(idEndereco)} 
     )`;
  var resultadoTorre = await database.executar(instrucaoTorre);
  var idTorre = resultadoTorre.insertId;

  var instrucaopc_industrial = `INSERT INTO PC_Industrial
        (uuid, hostname, fk_torre, status_operacional, nome)
       VALUES (
        ${mysql.escape(pc_industrial.uuid)},
        ${mysql.escape(pc_industrial.hostname)},
        ${mysql.escape(idTorre)},
        ${mysql.escape('Ativo')},
        ${mysql.escape(pc_industrial.identificador)}
       )`;
  var resultadopc_industrial = await database.executar(instrucaopc_industrial);
  var idpc_industrial = resultadopc_industrial.insertId;

  if (Array.isArray(componentes) && componentes.length > 0) {
    var valores = componentes
      .map(
        (componente) =>
          `(${mysql.escape(idpc_industrial)}, ${mysql.escape(
            componente.fk_componente,
          )}, ${mysql.escape(componente.alerta_critico)}, ${mysql.escape(componente.alerta_atencao)})`,
      )
      .join(", ");
    var instrucaoComponentes = `INSERT INTO limite_alerta
        (fk_pc_industrial, fk_componente, critico, atencao)
       VALUES ${valores}`;

    await database.executar(instrucaoComponentes);
  }

  return { id_torre: idTorre, id_pc_industrial: idpc_industrial };
}

module.exports = {
  
  listarTorresComMineradora,
  verificarCodigoExistente,
  listarMineradoras,
  criarTorre
};
