var database = require("../database/config");

var mysql = require("mysql2");

// BUSCAR USUÁRIO PELO EMAIL

function buscarPorEmail(email) {
  var emailSeguro = mysql.escape(email);

  var instrucaoSql = `
        SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.cpf,
            u.senha,
            u.data_nascimento,
            u.telefone,
            u.ultimo_acesso,
            u.cargo,

            e.razao_social AS empresa, 
            e.id_empresa AS fk_empresa

        FROM usuario AS u

        INNER JOIN empresa AS e
            ON u.fk_empresa = e.id_empresa

        /*LEFT JOIN mineradora AS m
            ON u.fk_mineradora = m.id_mineradora*/

        WHERE u.email = ${emailSeguro};
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// BUSCAR USUÁRIO PELO CPF

function buscarPorCpf(cpf) {
  var cpfSeguro = mysql.escape(cpf);

  var instrucaoSql = `
        SELECT
            id_usuario,
            cpf
        FROM usuario
        WHERE cpf = ${cpfSeguro};
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// BUSCAR CARGO ATIVO

function buscarCargoAtivoPorId(idCargo) {
  var instrucaoSql = `
        SELECT
            c.id_cargo,
            c.nome,
            c.status_atividade AS status_cargo,
            e.status_atividade AS status_empresa

        FROM cargo AS c

        INNER JOIN empresa AS e
            ON c.fk_empresa = e.id_empresa

        WHERE c.id_cargo = ${Number(idCargo)}
          AND c.status_atividade = 'Ativo'
          AND e.status_atividade = 'Ativo';
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// BUSCAR MINERADORA

function buscarMineradoraPorId(idMineradora) {
  var instrucaoSql = `
        SELECT
            id_mineradora,
            razao_social
        FROM mineradora
        WHERE id_mineradora = ${Number(idMineradora)};
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// CADASTRAR USUÁRIO

function cadastrar(
  nome,
  email,
  cpf,
  senha,
  dataNascimento,
  telefone,
  idCargo,
  idMineradora,
) {
  var nomeSeguro = mysql.escape(nome);
  var emailSeguro = mysql.escape(email);
  var cpfSeguro = mysql.escape(cpf);
  var senhaSegura = mysql.escape(senha);
  var telefoneSeguro = mysql.escape(telefone || null);

  var dataNascimentoSegura = dataNascimento
    ? mysql.escape(dataNascimento)
    : "NULL";

  var mineradoraSegura = idMineradora ? Number(idMineradora) : "NULL";

  var instrucaoSql = `
        INSERT INTO usuario (
            nome,
            email,
            cpf,
            senha,
            data_nascimento,
            telefone,
            primeiro_acesso,
            ultimo_acesso,
            fk_cargo,
            fk_mineradora
        )
        VALUES (
            ${nomeSeguro},
            ${emailSeguro},
            ${cpfSeguro},
            ${senhaSegura},
            ${dataNascimentoSegura},
            ${telefoneSeguro},
            TRUE,
            NULL,
            ${Number(idCargo)},
            ${mineradoraSegura}
        );
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// ATUALIZAR ÚLTIMO ACESSO

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

// LISTAR CARGOS

function listarCargos() {
  var instrucaoSql = `
        SELECT
            c.id_cargo,
            c.nome,
            e.razao_social AS empresa

        FROM cargo AS c

        INNER JOIN empresa AS e
            ON c.fk_empresa = e.id_empresa

        WHERE c.status_atividade = 'Ativo'
          AND e.status_atividade = 'Ativo'

        ORDER BY c.nome;
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// LISTAR MINERADORAS

function listarMineradoras() {
  var instrucaoSql = `
        SELECT
            id_mineradora,
            razao_social
        FROM mineradora
        ORDER BY razao_social;
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// EXPORTAÇÕES

// GERENCIAR PERFIL

function atualizarTel(idUsuario, telefone) {
  var instrucaoSql = `
        UPDATE usuario
        SET telefone = ${telefone}
        WHERE id_usuario = ${Number(idUsuario)};
    `;

  console.log("Executando SQL de adicionar ou atualizar telefone:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

function atualizarSenha(idUsuario, senha) {
  var instrucaoSql = `
        UPDATE usuario
        SET senha = "${senha}"
        WHERE id_usuario = ${Number(idUsuario)};
    `;

  console.log("Executando SQL de atualizar senha:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

module.exports = {
  buscarPorEmail,
  buscarPorCpf,
  buscarCargoAtivoPorId,
  buscarMineradoraPorId,
  cadastrar,
  atualizarUltimoAcesso,
  listarCargos,
  listarMineradoras,
  atualizarTel,
  atualizarSenha
};
