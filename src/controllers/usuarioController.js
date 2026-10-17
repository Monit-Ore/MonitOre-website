var usuarioModel = require("../models/usuarioModel");

// VALIDAÇÃO DE EMAIL

function emailValido(email) {
  var formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return formatoEmail.test(email);
}

// VALIDAÇÃO DE CPF

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf)) {
    return false;
  }

  // Impede CPF com todos os números iguais.
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  var soma = 0;
  var resto;

  for (var indice = 1; indice <= 9; indice++) {
    soma += Number(cpf.substring(indice - 1, indice)) * (11 - indice);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) {
    resto = 0;
  }

  if (resto !== Number(cpf.substring(9, 10))) {
    return false;
  }

  soma = 0;

  for (var segundoIndice = 1; segundoIndice <= 10; segundoIndice++) {
    soma +=
      Number(cpf.substring(segundoIndice - 1, segundoIndice)) *
      (12 - segundoIndice);
  }

  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) {
    resto = 0;
  }

  return resto === Number(cpf.substring(10, 11));
}


async function autenticar(req, res) {
  var email = req.body.email;
  var senha = req.body.senha;

  if (!email || !email.trim()) {
    return res.status(400).json({
      mensagem: "Email não informado.",
    });
  }

  if (!senha) {
    return res.status(400).json({
      mensagem: "Senha não informada.",
    });
  }

  email = email.trim().toLowerCase();

  if (!emailValido(email)) {
    return res.status(400).json({
      mensagem: "Formato de email inválido.",
    });
  }

  try {
    var resultado = await usuarioModel.buscarPorEmail(email);

    if (resultado.length === 0) {
      return res.status(401).json({
        mensagem: "Email ou senha inválidos.",
      });
    }

    var usuario = resultado[0];

    if (senha !== usuario.senha) {
      return res.status(401).json({
        mensagem: "Email ou senha inválidos.",
      });
    }

    req.session.ID_USUARIO = usuario.id_usuario;
    req.session.FK_EMPRESA_USUARIO = usuario.fk_empresa;
    req.session.NOME_USUARIO = usuario.nome;
    req.session.CARGO_USUARIO = usuario.cargo;

    await usuarioModel.atualizarUltimoAcesso(usuario.id_usuario);

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",

      primeiroAcesso: usuario.primeiro_acesso === 1,

      usuario: {
        idUsuario: usuario.id_usuario,

        nome: usuario.nome,

        email: usuario.email,

        cargo: usuario.cargo,

        empresa: usuario.empresa,

        mineradora: usuario.mineradora,

        fkEmpresa: usuario.fk_empresa,
      },
    });
  } catch (erro) {
    console.error("Erro ao autenticar usuário:", erro);

    return res.status(500).json({
      mensagem: "Erro interno ao realizar login.",
    });
  }
}

async function cadastrar(req, res) {
  var nome = req.body.nome;
  var email = req.body.email;
  var cpf = req.body.cpf;
  var senha = req.body.senha;
  var dataNascimento = req.body.dataNascimento;
  var telefone = req.body.telefone;
  var idCargo = req.body.idCargo;
  var idMineradora = req.body.idMineradora;

  if (!nome || !nome.trim()) {
    return res.status(400).json({
      mensagem: "Nome não informado.",
    });
  }

  if (nome.trim().length < 3) {
    return res.status(400).json({
      mensagem: "Informe o nome completo do funcionário.",
    });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({
      mensagem: "Email não informado.",
    });
  }

  email = email.trim().toLowerCase();

  if (!emailValido(email)) {
    return res.status(400).json({
      mensagem: "Formato de email inválido.",
    });
  }

  if (!cpf) {
    return res.status(400).json({
      mensagem: "CPF não informado.",
    });
  }

  cpf = String(cpf).replace(/\D/g, "");

  if (!cpfValido(cpf)) {
    return res.status(400).json({
      mensagem: "CPF inválido.",
    });
  }

  if (!senha) {
    return res.status(400).json({
      mensagem: "Senha não informada.",
    });
  }

  if (senha.length < 6) {
    return res.status(400).json({
      mensagem: "A senha deve possuir pelo menos 6 caracteres.",
    });
  }

  if (!idCargo || !Number.isInteger(Number(idCargo))) {
    return res.status(400).json({
      mensagem: "Selecione um cargo válido.",
    });
  }

  if (idMineradora && !Number.isInteger(Number(idMineradora))) {
    return res.status(400).json({
      mensagem: "Selecione uma unidade válida.",
    });
  }

  try {
    var usuariosComEmail = await usuarioModel.buscarPorEmail(email);

    if (usuariosComEmail.length > 0) {
      return res.status(409).json({
        mensagem: "Este email já está cadastrado.",
      });
    }

    var usuariosComCpf = await usuarioModel.buscarPorCpf(cpf);

    if (usuariosComCpf.length > 0) {
      return res.status(409).json({
        mensagem: "Este CPF já está cadastrado.",
      });
    }

    var cargosEncontrados = await usuarioModel.buscarCargoAtivoPorId(idCargo);

    if (cargosEncontrados.length === 0) {
      return res.status(400).json({
        mensagem: "O cargo selecionado não existe ou está inativo.",
      });
    }

    if (idMineradora) {
      var mineradorasEncontradas =
        await usuarioModel.buscarMineradoraPorId(idMineradora);

      if (mineradorasEncontradas.length === 0) {
        return res.status(400).json({
          mensagem: "A unidade selecionada não existe.",
        });
      }
    }

    var resultadoCadastro = await usuarioModel.cadastrar(
      nome.trim(),
      email,
      cpf,
      senha,
      dataNascimento || null,
      telefone ? telefone.trim() : null,
      idCargo,
      idMineradora || null,
    );

    return res.status(201).json({
      mensagem: "Funcionário cadastrado com sucesso.",

      idUsuario: resultadoCadastro.insertId,
    });
  } catch (erro) {
    console.error("Erro ao cadastrar usuário:", erro);

    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        mensagem: "Email ou CPF já cadastrado.",
      });
    }

    return res.status(500).json({
      mensagem: "Erro interno ao cadastrar funcionário.",
    });
  }
}

async function deletarUsuario(req, res) {
  var idUsuario = req.params.idUsuario;

  if (!idUsuario) {
    return res.status(400).json({
      mensagem: "Usuario não informado.",
    });
  }

  try {
    var resultado = await usuarioModel.deletarUsuario(idUsuario);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao lus usuario:", erro);

    return res.status(500).json({
      mensagem: "Erro ao deletar usuario.",
    });
  }
}

// LISTAR USUARIOS

async function listarUsuarios(req, res) {
  var idEmpresa = req.query.fkEmpresa;

  if (!idEmpresa) {
    return res.status(400).json({
      mensagem: "Empresa não informada.",
    });
  }

  try {
    var resultado = await usuarioModel.listarUsuariosPorEmpresa(idEmpresa);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao listar usuarios:", erro);

    return res.status(500).json({
      mensagem: "Erro ao listar usuarios.",
    });
  }
}

async function buscarUsuario(req, res) {
  var idEmpresa = req.query.fkEmpresa;
  var termo = req.query.termo;

  if (!idEmpresa) {
    return res.status(400).json({
      mensagem: "Empresa não informada.",
    });
  }

  if (!termo) {
    return res.status(400).json({
      mensagem: "Termo não informado.",
    });
  }

  try {
    var resultado = await usuarioModel.buscarUsuario(idEmpresa, termo);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao buscar usuario:", erro);

    return res.status(500).json({
      mensagem: "Erro ao buscar usuario.",
    });
  }
}

async function listarCargos(req, res) {
  try {
    var resultado = await usuarioModel.listarCargos();

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao listar cargos:", erro);

    return res.status(500).json({
      mensagem: "Erro ao buscar cargos.",
    });
  }
}

async function listarMineradoras(req, res) {
  try {
    var resultado = await usuarioModel.listarMineradoras();

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao listar mineradoras:", erro);

    return res.status(500).json({
      mensagem: "Erro ao buscar unidades.",
    });
  }
}

function atualizarTelefone(req, res) {
  var id = req.body.userServer;
  var telefone = req.body.telServer;

  if (!telefone) {
    return res.status(400).send("Telefone inválido!");
  }

  usuarioModel.atualizarTel(id, telefone)
    .then(
      function (resultado) {
        res.json(resultado);
      }
    ).catch(
      function (erro) {
        console.log(erro);
        console.log(
          "\nHouve um erro ao realizar o cadastro! Erro: ",
          erro.sqlMessage
        );
        res.status(500).json(erro.sqlMessage);
      }
    );
}

async function atualizarSenha(req, res) {
  var id = req.body.userServer;
  var senha_atual = req.body.senhaAtualServer;
  var nova_senha = req.body.senhaNovaServer;
  var email = req.body.emailServer;

  try {
    var resultado = await usuarioModel.buscarPorEmail(email);

    if (resultado.length === 0) {
      return res.status(401).json({
        mensagem: "Email ou senha inválidos.",
      });
    }

    var usuario = resultado[0];

    if (senha_atual !== usuario.senha) {
      return res.status(401).json({
        mensagem: "Senha inválida.",
      });
    }

    usuarioModel.atualizarSenha(id, nova_senha)
      .then(
        function (resultado) {
          res.json(resultado);
        }
      ).catch(
        function (erro) {
          console.log(erro);
          console.log(
            "\nHouve um erro ao realizar o cadastro! Erro: ",
            erro.sqlMessage
          );
          res.status(500).json(erro.sqlMessage);
        }
      );
  } catch {
    console.log(
      "\nHouve um erro ao realizar a alteração! Erro: ",
      erro.sqlMessage
    );
    res.status(500).json(erro.sqlMessage);
  }
}

async function atualizarSenhaAdmin(req, res) {
  var idUsuario = req.body.userServer;
  var novaSenha = req.body.senhaNovaServer;

  if (!idUsuario || !novaSenha) {
    return res.status(400).json({ mensagem: "Dados incompletos para atualização." });
  }

  try {
    var resultado = await usuarioModel.atualizarSenhaAdmin(idUsuario, novaSenha);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro na controller ao atualizar senha:", erro);
    return res.status(500).json({ mensagem: "Erro interno ao atualizar a senha." });
  }
}

async function BuscarPorID(req, res) {
  var idUsuario = req.params.idUsuario;

  if (!idUsuario) {
    return res.status(400).json({
      mensagem: "Usuario não informado.",
    });
  }

  try {
    var resultado = await usuarioModel.BuscarPorID(idUsuario);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro ao buscar usuario:", erro);

    return res.status(500).json({
      mensagem: "Erro ao buscar usuario.",
    });
  }
}

async function atualizarCargo(req,res){
  var idUsuario = req.body.userServer;
  var cargo = req.body.senhaNovaServer;

  try {
    var resultado = await usuarioModel.atualizarCargo(idUsuario, cargo);

    return res.status(200).json(resultado);
  } catch (erro) {
    console.error("Erro na controller ao atualizar cargo:", erro);
    return res.status(500).json({ mensagem: "Erro interno ao atualizar o cargo." });
  }
}



async function listarTorresPorMineradora(req, res) {
    try {
        if (!req.session || !req.session.FK_EMPRESA_USUARIO) {
            return res.status(401).json({
                mensagem: "Sessão não identificada. Faça login novamente."
            });
        }

        var idFabricante = Number(req.session.FK_EMPRESA_USUARIO);

        var resultado = await usuarioModel.listarTorresPorMineradora(
            idFabricante
        );

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error("Erro ao buscar as torres:", erro);

        return res.status(500).json({
            mensagem: "Erro ao buscar as torres."
        });
    }
}


async function buscarAcessosTorres(req, res) {
    var idUsuario = Number(req.params.idUsuario);
    console.log("Sessão recebida:", req.session);
    var idFabricante = Number(req.session.FK_EMPRESA_USUARIO);

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        return res.status(400).json({
            mensagem: "ID de usuário inválido."
        });
    }

    if (!Number.isInteger(idFabricante) || idFabricante <= 0) {
        return res.status(401).json({
            mensagem: "Fabricante não identificado na sessão."
        });
    }

    try {
        var resultado = await usuarioModel.buscarAcessosTorres(
            idUsuario,
            idFabricante
        );

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error("Erro ao buscar os acessos:", erro);

        return res.status(500).json({
            mensagem: "Erro ao buscar os acessos do usuário."
        });
    }
}


async function salvarAcessosTorres(req, res) {
    var idUsuario = Number(req.params.idUsuario);
    var torres = req.body.torres;

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        return res.status(400).json({
            mensagem: "ID de usuário inválido."
        });
    }

    if (!Array.isArray(torres)) {
        return res.status(400).json({
            mensagem: "Informe uma lista válida de torres."
        });
    }

    // Identifica o fabricante que está usando o site.
    var idFabricante = Number(req.session.FK_EMPRESA_USUARIO);

    if (!Number.isInteger(idFabricante) || idFabricante <= 0) {
        return res.status(401).json({
            mensagem: "Fabricante não identificado na sessão."
        });
    }

    try {
        var resultado = await usuarioModel.salvarAcessosTorres(
            idUsuario,
            torres,
            idFabricante
        );

        return res.status(200).json(resultado);

    } catch (erro) {
        console.error("Erro ao salvar os acessos:", erro);

        return res.status(400).json({
            mensagem: erro.message || "Erro ao atualizar os acessos."
        });
    }
}




module.exports = {
  autenticar,
  cadastrar,
  listarUsuarios,
  listarCargos,
  listarMineradoras,
  atualizarTelefone,
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
