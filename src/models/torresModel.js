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
          )}, ${mysql.escape(componente.valor_limite)})`,
      )
      .join(", ");
    var instrucaoComponentes = `INSERT INTO limite_alerta
        (fk_pc_industrial, fk_componente, valor_limite)
       VALUES ${valores}`;

    await database.executar(instrucaoComponentes);
  }

  return { id_torre: idTorre, id_pc_industrial: idpc_industrial };
}


async function buscarTorrePorId(id, fkEmpresa) {
  var instrucaoSql = `SELECT 
    t.id_torre, 
    t.codigo, 
    t.nome, 
    t.fk_mineradora,
    e.cep, 
    e.logradouro, 
    e.numero, 
    e.complemento, 
    e.bairro, 
    e.cidade, 
    e.estado,
    pc.uuid, 
    pc.hostname, 
    pc.nome AS identificador
    FROM torre t
    INNER JOIN empresa m ON m.id_empresa = t.fk_mineradora
    INNER JOIN endereco e ON e.id_endereco = t.fk_endereco
    INNER JOIN PC_Industrial pc ON pc.fk_torre = t.id_torre
    WHERE t.id_torre = ${mysql.escape(id)} 
      AND t.fk_fabricante = ${mysql.escape(fkEmpresa)};`;

  var resultadoTorre = await database.executar(instrucaoSql);
  if (resultadoTorre.length === 0) return null;

  var torre = resultadoTorre[0];

  // Busca os componentes vinculados a este PC Industrial
  var instrucaoComponentes = `SELECT 
    la.fk_componente, 
    la.valor_limite
    FROM limite_alerta la
    INNER JOIN PC_Industrial pc ON pc.id_pc_industrial = la.fk_pc_industrial
    WHERE pc.fk_torre = ${mysql.escape(id)};`;

  var componentes = await database.executar(instrucaoComponentes);

  return {
    id_torre: torre.id_torre,
    nome: torre.nome,
    codigo: torre.codigo,
    fk_mineradora: torre.fk_mineradora,
    endereco: {
      cep: torre.cep,
      logradouro: torre.logradouro,
      numero: torre.numero,
      complemento: torre.complemento,
      bairro: torre.bairro,
      cidade: torre.cidade,
      estado: torre.estado
    },
    pc_industrial: {
      identificador: torre.identificador,
      hostname: torre.hostname,
      uuid: torre.uuid
    },
    componentes: componentes
  };
}

async function atualizarTorre(
  idTorre,
  fkEmpresa,
  nome,
  codigo,
  fk_mineradora,
  pc_industrial,
  endereco,
  componentes
) {
  // 1. Busca os IDs vinculados de endereço e PC Industrial
  var dadosAtuais = await database.executar(`
    SELECT t.fk_endereco, pc.id_pc_industrial 
    FROM torre t 
    LEFT JOIN PC_Industrial pc ON pc.fk_torre = t.id_torre 
    WHERE t.id_torre = ${mysql.escape(idTorre)}
  `);

  if (dadosAtuais.length === 0) {
    throw new Error("Torre não encontrada.");
  }

  var idEndereco = dadosAtuais[0].fk_endereco;
  var idPcIndustrial = dadosAtuais[0].id_pc_industrial;

  // 2. Atualiza o Endereço
  var instrucaoEndereco = `UPDATE endereco SET 
    cep = ${mysql.escape(endereco.cep)},
    logradouro = ${mysql.escape(endereco.logradouro)},
    numero = ${mysql.escape(endereco.numero)},
    complemento = ${mysql.escape(endereco.complemento)},
    bairro = ${mysql.escape(endereco.bairro)},
    cidade = ${mysql.escape(endereco.cidade)},
    estado = ${mysql.escape(endereco.estado)}
    WHERE id_endereco = ${mysql.escape(idEndereco)}`;
  await database.executar(instrucaoEndereco);

  // Atualiza a Torre
  var instrucaoTorre = `UPDATE torre SET 
    nome = ${mysql.escape(nome)},
    codigo = ${mysql.escape(codigo)},
    fk_mineradora = ${mysql.escape(fk_mineradora)}
    WHERE id_torre = ${mysql.escape(idTorre)}`;
  await database.executar(instrucaoTorre);

  // Atualiza o PC Industrial
  var instrucaoPc = `UPDATE PC_Industrial SET 
    uuid = ${mysql.escape(pc_industrial.uuid)},
    hostname = ${mysql.escape(pc_industrial.hostname)},
    nome = ${mysql.escape(pc_industrial.identificador)}
    WHERE id_pc_industrial = ${mysql.escape(idPcIndustrial)}`;
  await database.executar(instrucaoPc);

  // Atualiza os Limites de Alerta (Remove os antigos e insere os novos enviados)
  await database.executar(`DELETE FROM limite_alerta WHERE fk_pc_industrial = ${mysql.escape(idPcIndustrial)}`);

  if (Array.isArray(componentes) && componentes.length > 0) {
    var valores = componentes
      .map(
        (componente) =>
          `(${mysql.escape(idPcIndustrial)}, ${mysql.escape(componente.fk_componente)}, ${mysql.escape(componente.valor_limite)})`
      )
      .join(", ");
    
    var instrucaoComponentes = `INSERT INTO limite_alerta (fk_pc_industrial, fk_componente, valor_limite) VALUES ${valores}`;
    await database.executar(instrucaoComponentes);
  }

  return { id_torre: idTorre };
}


module.exports = {
  listarTorresComMineradora,
  verificarCodigoExistente,
  listarMineradoras,
  criarTorre,
  buscarTorrePorId, 
  atualizarTorre    
};
