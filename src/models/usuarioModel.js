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

// LISTAR USUARIOS
function listarUsuarios(empresa) {
  var instrucaoSql = `
        SELECT
    u.id_usuario,
    u.nome,
    u.email,
    u.cargo,
    u.telefone,
    DATE_FORMAT(u.ultimo_acesso, '%d/%m/%Y %H:%i') AS ultimo_acesso,
    e.razao_social AS empresa
      FROM usuario u
      JOIN empresa e
    ON e.id_empresa = u.fk_empresa
      WHERE u.fk_empresa = ${empresa}
      ORDER BY u.nome;
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

// LISTAR USUÁRIOS DA EMPRESA

function listarUsuariosPorEmpresa(fkEmpresa) {
  var instrucaoSql = `
        SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.cargo,
            DATE_FORMAT(u.ultimo_acesso, '%d/%m/%Y %H:%i') AS ultimo_acesso,
            e.razao_social AS empresa

        FROM usuario AS u

        INNER JOIN empresa AS e
            ON e.id_empresa = u.fk_empresa

        WHERE u.fk_empresa = ${Number(fkEmpresa)}

        ORDER BY u.nome;
    `;

  console.log("Executando SQL:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}
// DELETAR
function deletarUsuario(idUsuario) {
  var instrucaoSql = `
      DELETE FROM usuario WHERE id_usuario = ${idUsuario};
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
        SET telefone = '${telefone}'
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

function atualizarCargo(idUsuario, cargo){
  var instrucaoSql = `
    UPDATE usuario
    SET cargo = "${cargo}"
    WHERE id_usuario = ${Number(idUsuario)};
  `

  console.log("Executando SQL de atualizar cargo:");
  console.log(instrucaoSql);
  
  return database.executar(instrucaoSql);
}

function atualizarSenhaAdmin(idUsuario, senha) {
  var instrucaoSql = `
        UPDATE usuario
        SET senha = "${senha}"
        WHERE id_usuario = ${Number(idUsuario)};
    `;

  console.log("Executando SQL de atualizar senha:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

function buscarUsuario(idEmpresa, termo) {
  var empresaSegura = mysql.escape(idEmpresa)
  var termoSeguro = mysql.escape(`%${termo}%`)

  var instrucaoSql = `
          SELECT
            u.id_usuario,
            u.nome,
            u.email,
            u.cargo,
            DATE_FORMAT(u.ultimo_acesso, '%d/%m/%Y %H:%i') AS ultimo_acesso,
            e.razao_social AS empresa

        FROM usuario AS u

        INNER JOIN empresa AS e
            ON e.id_empresa = u.fk_empresa

        WHERE u.fk_empresa = ${empresaSegura} AND
        LOWER(nome) LIKE LOWER(${termoSeguro})

        ORDER BY u.nome;
     
    `;

  console.log("Executando SQL de atualizar senha:");
  console.log(instrucaoSql);

  return database.executar(instrucaoSql);
}

function BuscarPorID(idUsuario){
  var instrucaoSql = `
    SELECT 
      u.nome,
      u.email,
      u.telefone,
      u.senha,
      u.cargo

    FROM usuario as u
    WHERE u.id_usuario = ${idUsuario};
  `

  console.log("Executando SQL de visualizar");
  console.log(instrucaoSql);
  
  
  return database.executar(instrucaoSql)
}



function listarTorresPorMineradora(idFabricante) {
    var instrucaoSql = `
        SELECT
            m.id_empresa AS id_mineradora,
            m.razao_social AS nome_mineradora,
            t.id_torre,
            t.nome AS nome_torre
        FROM torre AS t
        INNER JOIN empresa AS m
            ON t.fk_mineradora = m.id_empresa
        WHERE t.fk_fabricante = ${Number(idFabricante)}
        ORDER BY
            m.razao_social,
            t.nome;
    `;

    return database.executar(instrucaoSql);
}


function buscarAcessosTorres(idUsuario, idFabricante) {
    var instrucaoSql = `
        SELECT p.torre_id_torre
        FROM permissionamento AS p
        INNER JOIN torre AS t
            ON t.id_torre = p.torre_id_torre
        INNER JOIN usuario AS u
            ON u.id_usuario = p.usuario_id_usuario
        WHERE p.usuario_id_usuario = ${Number(idUsuario)}
          AND u.fk_empresa = ${Number(idFabricante)}
          AND t.fk_fabricante = ${Number(idFabricante)};
    `;

    return database.executar(instrucaoSql);
}


async function salvarAcessosTorres(idUsuario, torres, idFabricante) {
    var id = Number(idUsuario);
    var fabricante = Number(idFabricante);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Usuário inválido.");
    }

    if (!Number.isInteger(fabricante) || fabricante <= 0) {
        throw new Error("Fabricante inválido.");
    }

    if (!Array.isArray(torres)) {
        throw new Error("A lista de torres é inválida.");
    }

    var idsTorres = [];

    torres.forEach(function (idTorre) {
        var numero = Number(idTorre);

        if (!Number.isInteger(numero) || numero <= 0) {
            throw new Error("ID de torre inválido.");
        }

        if (!idsTorres.includes(numero)) {
            idsTorres.push(numero);
        }
    });

    // Verifica se o usuário existe e pertence ao fabricante.
    var usuario = await database.executar(`
        SELECT id_usuario
        FROM usuario
        WHERE id_usuario = ${id}
          AND fk_empresa = ${fabricante};
    `);

    if (usuario.length === 0) {
        throw new Error(
            "Usuário não encontrado ou não pertence ao fabricante conectado."
        );
    }

    // Confere se todas as torres pertencem ao fabricante conectado.
    if (idsTorres.length > 0) {
        var torresValidas = await database.executar(`
            SELECT id_torre
            FROM torre
            WHERE fk_fabricante = ${fabricante}
              AND id_torre IN (${idsTorres.join(",")});
        `);

        if (torresValidas.length !== idsTorres.length) {
            throw new Error(
                "Uma ou mais torres não pertencem ao fabricante conectado."
            );
        }
    }

    // Atualiza os acessos do usuário.
    await database.executar(`
        DELETE FROM permissionamento
        WHERE usuario_id_usuario = ${id};
    `);

    if (idsTorres.length > 0) {
        var valores = idsTorres.map(function (idTorre) {
            return `(${id}, ${idTorre})`;
        });

        await database.executar(`
            INSERT INTO permissionamento (
                usuario_id_usuario,
                torre_id_torre
            )
            VALUES ${valores.join(",")};
        `);
    }

    return {
        mensagem: "Acessos às torres atualizados com sucesso."
    };
}




module.exports = {
  buscarPorEmail,
  buscarPorCpf,
  buscarCargoAtivoPorId,
  buscarMineradoraPorId,
  cadastrar,
  atualizarUltimoAcesso,
  listarUsuariosPorEmpresa,
  listarCargos,
  listarMineradoras,
  atualizarTel,
  atualizarSenha,
  deletarUsuario,
  buscarUsuario,
  BuscarPorID,
  atualizarSenhaAdmin,
  atualizarCargo,
  listarTorresPorMineradora,
  buscarAcessosTorres,
  salvarAcessosTorres
};
