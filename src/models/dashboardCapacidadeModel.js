var mysql = require("mysql2");
var database = require("../database/config");

async function buscarTorres(idUsuario, fkEmpresa) {
  const linhas = await database.executar(`
    SELECT t.id_torre, t.nome AS torre, t.codigo, t.monitoramento_ativo,
           m.razao_social AS mineradora, c.nome AS componente,
           pc.id_pc_industrial AS id_pc, pc.hostname, la.atencao, la.critico
    FROM permissionamento p
    INNER JOIN torre t ON t.id_torre = p.torre_id_torre
    INNER JOIN empresa m ON m.id_empresa = t.fk_mineradora
    LEFT JOIN PC_Industrial pc ON pc.fk_torre = t.id_torre
    LEFT JOIN limite_alerta la ON la.fk_pc_industrial = pc.id_pc_industrial
    LEFT JOIN componente c ON c.id_componente = la.fk_componente
    WHERE p.usuario_id_usuario = ${mysql.escape(idUsuario)}
      AND t.fk_fabricante = ${mysql.escape(fkEmpresa)}
    ORDER BY m.razao_social, t.codigo, t.id_torre, c.nome;
  `);

  const torres = new Map();

  for (const linha of linhas) {
    if (!torres.has(linha.id_torre)) {
      torres.set(linha.id_torre, {
        id_torre: linha.id_torre,
        nome: linha.torre,
        codigo: linha.codigo,
        mineradora: linha.mineradora,
        monitoramentoAtivo: linha.monitoramento_ativo === 1,
        ultimaLeitura: null,
        componentes: [],
      });
    }

    if (linha.componente !== null) {
      torres.get(linha.id_torre).componentes.push({
        nome: linha.componente,
        id_pc: linha.id_pc,
        pc: linha.hostname,
        atencao: Number(linha.atencao),
        critico: Number(linha.critico),
      });
    }
  }

  return [...torres.values()];
}

module.exports = { buscarTorres };
