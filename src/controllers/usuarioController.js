var usuarioModel = require("../models/usuarioModel");
var bcrypt = require("bcryptjs");

// =========================================================
// FUNÇÕES AUXILIARES
// =========================================================

function emailValido(email) {
    var formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return formatoEmail.test(email);
}

function cpfValido(cpf) {
    if (!/^\d{11}$/.test(cpf)) {
        return false;
    }

    // Impede CPFs com todos os números iguais.
    if (/^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    var soma = 0;
    var resto;

    for (var indice = 1; indice <= 9; indice++) {
        soma += Number(cpf.substring(indice - 1, indice)) *
            (11 - indice);
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
        soma += Number(
            cpf.substring(segundoIndice - 1, segundoIndice)
        ) * (12 - segundoIndice);
    }

    resto = (soma * 10) % 11;

    if (resto === 10 || resto === 11) {
        resto = 0;
    }

    return resto === Number(cpf.substring(10, 11));
}

// =========================================================
// LOGIN
// =========================================================

function autenticar(req, res) {
    var email = req.body.email;
    var senha = req.body.senha;

    if (!email || !email.trim()) {
        return res.status(400).json({
            mensagem: "Email não informado."
        });
    }

    if (!senha) {
        return res.status(400).json({
            mensagem: "Senha não informada."
        });
    }

    email = email.trim().toLowerCase();

    if (!emailValido(email)) {
        return res.status(400).json({
            mensagem: "Formato de email inválido."
        });
    }

    usuarioModel.buscarPorEmail(email)
        .then(function (resultado) {
            if (resultado.length === 0) {
                return res.status(401).json({
                    mensagem: "Email ou senha inválidos."
                });
            }

            var usuario = resultado[0];

            if (usuario.status_usuario !== "Ativo") {
                return res.status(403).json({
                    mensagem: "Usuário inativo."
                });
            }

            if (usuario.status_cargo !== "Ativo") {
                return res.status(403).json({
                    mensagem: "Cargo do usuário está inativo."
                });
            }

            if (usuario.status_empresa !== "Ativo") {
                return res.status(403).json({
                    mensagem: "Empresa do usuário está inativa."
                });
            }

            return bcrypt.compare(senha, usuario.senha_hash)
                .then(function (senhaCorreta) {
                    if (!senhaCorreta) {
                        return res.status(401).json({
                            mensagem: "Email ou senha inválidos."
                        });
                    }

                    return usuarioModel
                        .atualizarUltimoAcesso(usuario.id_usuario)
                        .then(function () {
                            return res.status(200).json({
                                mensagem:
                                    "Login realizado com sucesso.",

                                primeiroAcesso:
                                    usuario.primeiro_acesso === 1,

                                usuario: {
                                    idUsuario:
                                        usuario.id_usuario,

                                    nome:
                                        usuario.nome,

                                    email:
                                        usuario.email,

                                    cargo:
                                        usuario.cargo,

                                    empresa:
                                        usuario.empresa,

                                    mineradora:
                                        usuario.mineradora
                                }
                            });
                        });
                });
        })
        .catch(function (erro) {
            console.error("Erro ao autenticar usuário:", erro);

            if (!res.headersSent) {
                return res.status(500).json({
                    mensagem: "Erro interno ao realizar login."
                });
            }
        });
}

// =========================================================
// CADASTRO
// =========================================================

function cadastrar(req, res) {
    var nome = req.body.nome;
    var email = req.body.email;
    var cpf = req.body.cpf;
    var senha = req.body.senha;
    var dataNascimento = req.body.dataNascimento;
    var telefone = req.body.telefone;
    var statusAtividade = req.body.statusAtividade;
    var idCargo = req.body.idCargo;
    var idMineradora = req.body.idMineradora;

    if (!nome || !nome.trim()) {
        return res.status(400).json({
            mensagem: "Nome não informado."
        });
    }

    if (nome.trim().length < 3) {
        return res.status(400).json({
            mensagem: "Informe o nome completo do funcionário."
        });
    }

    if (!email || !email.trim()) {
        return res.status(400).json({
            mensagem: "Email não informado."
        });
    }

    email = email.trim().toLowerCase();

    if (!emailValido(email)) {
        return res.status(400).json({
            mensagem: "Formato de email inválido."
        });
    }

    if (!cpf) {
        return res.status(400).json({
            mensagem: "CPF não informado."
        });
    }

    cpf = String(cpf).replace(/\D/g, "");

    if (!cpfValido(cpf)) {
        return res.status(400).json({
            mensagem: "CPF inválido."
        });
    }

    if (!senha) {
        return res.status(400).json({
            mensagem: "Senha não informada."
        });
    }

    if (senha.length < 6) {
        return res.status(400).json({
            mensagem: "A senha deve possuir pelo menos 6 caracteres."
        });
    }

    if (!idCargo || !Number.isInteger(Number(idCargo))) {
        return res.status(400).json({
            mensagem: "Selecione um cargo válido."
        });
    }

    if (
        idMineradora &&
        !Number.isInteger(Number(idMineradora))
    ) {
        return res.status(400).json({
            mensagem: "Selecione uma unidade válida."
        });
    }

    statusAtividade =
        statusAtividade === "Inativo"
            ? "Inativo"
            : "Ativo";

    var consultas = [
        usuarioModel.buscarPorEmail(email),
        usuarioModel.buscarPorCpf(cpf),
        usuarioModel.buscarCargoAtivoPorId(idCargo)
    ];

    if (idMineradora) {
        consultas.push(
            usuarioModel.buscarMineradoraPorId(idMineradora)
        );
    }

    Promise.all(consultas)
        .then(function (resultados) {
            var usuariosComEmail = resultados[0];
            var usuariosComCpf = resultados[1];
            var cargosEncontrados = resultados[2];

            if (usuariosComEmail.length > 0) {
                return res.status(409).json({
                    mensagem: "Este email já está cadastrado."
                });
            }

            if (usuariosComCpf.length > 0) {
                return res.status(409).json({
                    mensagem: "Este CPF já está cadastrado."
                });
            }

            if (cargosEncontrados.length === 0) {
                return res.status(400).json({
                    mensagem:
                        "O cargo selecionado não existe ou está inativo."
                });
            }

            if (
                idMineradora &&
                resultados[3].length === 0
            ) {
                return res.status(400).json({
                    mensagem:
                        "A unidade selecionada não existe."
                });
            }

            return bcrypt.hash(senha, 10)
                .then(function (senhaHash) {
                    return usuarioModel.cadastrar(
                        nome.trim(),
                        email,
                        cpf,
                        senhaHash,
                        dataNascimento || null,
                        telefone ? telefone.trim() : null,
                        statusAtividade,
                        idCargo,
                        idMineradora || null
                    );
                })
                .then(function (resultadoCadastro) {
                    return res.status(201).json({
                        mensagem:
                            "Funcionário cadastrado com sucesso.",

                        idUsuario:
                            resultadoCadastro.insertId
                    });
                });
        })
        .catch(function (erro) {
            console.error("Erro ao cadastrar usuário:", erro);

            if (erro.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    mensagem:
                        "Email ou CPF já cadastrado."
                });
            }

            if (!res.headersSent) {
                return res.status(500).json({
                    mensagem:
                        "Erro interno ao cadastrar funcionário."
                });
            }
        });
}

// =========================================================
// LISTAR CARGOS
// =========================================================

function listarCargos(req, res) {
    usuarioModel.listarCargos()
        .then(function (resultado) {
            return res.status(200).json(resultado);
        })
        .catch(function (erro) {
            console.error("Erro ao listar cargos:", erro);

            return res.status(500).json({
                mensagem: "Erro ao buscar cargos."
            });
        });
}

// =========================================================
// LISTAR MINERADORAS
// =========================================================

function listarMineradoras(req, res) {
    usuarioModel.listarMineradoras()
        .then(function (resultado) {
            return res.status(200).json(resultado);
        })
        .catch(function (erro) {
            console.error("Erro ao listar mineradoras:", erro);

            return res.status(500).json({
                mensagem: "Erro ao buscar unidades."
            });
        });
}

module.exports = {
    autenticar,
    cadastrar,
    listarCargos,
    listarMineradoras
};