var usuarioModel =
    require("../models/usuarioModel");


// VALIDAÇÃO DE EMAIL

function emailValido(email) {
    var formatoEmail =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        soma +=
            Number(cpf.substring(indice - 1, indice)) *
            (11 - indice);
    }

    resto = (soma * 10) % 11;

    if (resto === 10 || resto === 11) {
        resto = 0;
    }

    if (
        resto !==
        Number(cpf.substring(9, 10))
    ) {
        return false;
    }

    soma = 0;

    for (
        var segundoIndice = 1;
        segundoIndice <= 10;
        segundoIndice++
    ) {
        soma +=
            Number(
                cpf.substring(
                    segundoIndice - 1,
                    segundoIndice
                )
            ) *
            (12 - segundoIndice);
    }

    resto = (soma * 10) % 11;

    if (resto === 10 || resto === 11) {
        resto = 0;
    }

    return (
        resto ===
        Number(cpf.substring(10, 11))
    );
}


// AUTENTICAR

async function autenticar(req, res) {
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

    try {
        var resultado =
            await usuarioModel.buscarPorEmail(email);

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

        // Comparação direta da senha em texto.
        if (senha !== usuario.senha) {
            return res.status(401).json({
                mensagem: "Email ou senha inválidos."
            });
        }

        await usuarioModel.atualizarUltimoAcesso(
            usuario.id_usuario
        );

        return res.status(200).json({
            mensagem: "Login realizado com sucesso.",

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
    } catch (erro) {
        console.error(
            "Erro ao autenticar usuário:",
            erro
        );

        return res.status(500).json({
            mensagem:
                "Erro interno ao realizar login."
        });
    }
}


// CADASTRAR

async function cadastrar(req, res) {
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
            mensagem:
                "Informe o nome completo do funcionário."
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
            mensagem:
                "A senha deve possuir pelo menos 6 caracteres."
        });
    }

    if (
        !idCargo ||
        !Number.isInteger(Number(idCargo))
    ) {
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

    try {
        var usuariosComEmail =
            await usuarioModel.buscarPorEmail(email);

        if (usuariosComEmail.length > 0) {
            return res.status(409).json({
                mensagem:
                    "Este email já está cadastrado."
            });
        }

        var usuariosComCpf =
            await usuarioModel.buscarPorCpf(cpf);

        if (usuariosComCpf.length > 0) {
            return res.status(409).json({
                mensagem:
                    "Este CPF já está cadastrado."
            });
        }

        var cargosEncontrados =
            await usuarioModel.buscarCargoAtivoPorId(
                idCargo
            );

        if (cargosEncontrados.length === 0) {
            return res.status(400).json({
                mensagem:
                    "O cargo selecionado não existe ou está inativo."
            });
        }

        if (idMineradora) {
            var mineradorasEncontradas =
                await usuarioModel.buscarMineradoraPorId(
                    idMineradora
                );

            if (mineradorasEncontradas.length === 0) {
                return res.status(400).json({
                    mensagem:
                        "A unidade selecionada não existe."
                });
            }
        }

        var resultadoCadastro =
            await usuarioModel.cadastrar(
                nome.trim(),
                email,
                cpf,
                senha,
                dataNascimento || null,
                telefone ? telefone.trim() : null,
                statusAtividade,
                idCargo,
                idMineradora || null
            );

        return res.status(201).json({
            mensagem:
                "Funcionário cadastrado com sucesso.",

            idUsuario:
                resultadoCadastro.insertId
        });
    } catch (erro) {
        console.error(
            "Erro ao cadastrar usuário:",
            erro
        );

        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                mensagem:
                    "Email ou CPF já cadastrado."
            });
        }

        return res.status(500).json({
            mensagem:
                "Erro interno ao cadastrar funcionário."
        });
    }
}


// LISTAR CARGOS

async function listarCargos(req, res) {
    try {
        var resultado =
            await usuarioModel.listarCargos();

        return res.status(200).json(resultado);
    } catch (erro) {
        console.error(
            "Erro ao listar cargos:",
            erro
        );

        return res.status(500).json({
            mensagem: "Erro ao buscar cargos."
        });
    }
}


// LISTAR MINERADORAS

async function listarMineradoras(req, res) {
    try {
        var resultado =
            await usuarioModel.listarMineradoras();

        return res.status(200).json(resultado);
    } catch (erro) {
        console.error(
            "Erro ao listar mineradoras:",
            erro
        );

        return res.status(500).json({
            mensagem: "Erro ao buscar unidades."
        });
    }
}


// EXPORTAÇÕES

module.exports = {
    autenticar,
    cadastrar,
    listarCargos,
    listarMineradoras
};