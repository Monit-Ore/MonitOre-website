document.addEventListener("DOMContentLoaded", function () {
    carregarCargos();
    carregarMineradoras();
    configurarStatus();
    configurarMascaras();
});


// CARREGAMENTO DOS CARGOS

function carregarCargos() {
    var campoCargo = document.getElementById("cargo_ipt");

    fetch("/usuarios/cargos")
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error(
                    "Não foi possível carregar os cargos."
                );
            }

            return resposta.json();
        })
        .then(function (cargos) {
            cargos.forEach(function (cargo) {
                var opcao = document.createElement("option");

                opcao.value = cargo.id_cargo;
                opcao.textContent =
                    cargo.nome + " - " + cargo.empresa;

                campoCargo.appendChild(opcao);
            });
        })
        .catch(function (erro) {
            mostrarMensagem(erro.message, true);
        });
}


// CARREGAMENTO DAS MINERADORAS/UNIDADES

function carregarMineradoras() {
    var campoUnidade =
        document.getElementById("unidade_local_ipt");

    fetch("/usuarios/mineradoras")
        .then(function (resposta) {
            if (!resposta.ok) {
                throw new Error(
                    "Não foi possível carregar as unidades."
                );
            }

            return resposta.json();
        })
        .then(function (mineradoras) {
            mineradoras.forEach(function (mineradora) {
                var opcao = document.createElement("option");

                opcao.value = mineradora.id_mineradora;
                opcao.textContent = mineradora.razao_social;

                campoUnidade.appendChild(opcao);
            });
        })
        .catch(function (erro) {
            mostrarMensagem(erro.message, true);
        });
}


// CADASTRO

function salvar() {
    var nome = document
        .getElementById("nome_ipt")
        .value
        .trim();

    var email = document
        .getElementById("email_ipt")
        .value
        .trim();

    var dataNascimento = document
        .getElementById("data_nasc_input")
        .value;

    var idMineradora = document
        .getElementById("unidade_local_ipt")
        .value;

    var cpf = document
        .getElementById("cpf_ipt")
        .value
        .replace(/\D/g, "");

    var senha = document
        .getElementById("senha_ipt")
        .value;

    var telefone = document
        .getElementById("telefone_ipt")
        .value
        .trim();

    var idCargo = document
        .getElementById("cargo_ipt")
        .value;

    var statusAtivo = document
        .getElementById("status_ipt")
        .checked;

    if (nome.length < 3) {
        mostrarMensagem(
            "Informe o nome completo do funcionário.",
            true
        );
        return;
    }

    if (!email) {
        mostrarMensagem("Informe o email.", true);
        return;
    }

    if (cpf.length !== 11) {
        mostrarMensagem(
            "O CPF deve possuir 11 números.",
            true
        );
        return;
    }

    if (senha.length < 6) {
        mostrarMensagem(
            "A senha deve possuir pelo menos 6 caracteres.",
            true
        );
        return;
    }

    if (!idCargo) {
        mostrarMensagem("Selecione um cargo.", true);
        return;
    }

    var dadosCadastro = {
        nome: nome,
        email: email,
        cpf: cpf,
        senha: senha,

        dataNascimento:
            dataNascimento || null,

        telefone:
            telefone || null,

        idCargo:
            Number(idCargo),

        idMineradora:
            idMineradora
                ? Number(idMineradora)
                : null,

        statusAtividade:
            statusAtivo
                ? "Ativo"
                : "Inativo"
    };

    enviarCadastro(dadosCadastro);
}


// ENVIO PARA O BACKEND

function enviarCadastro(dadosCadastro) {
    var botaoSalvar =
        document.querySelector(".btn-salvar");

    botaoSalvar.disabled = true;

    mostrarMensagem(
        "Salvando funcionário...",
        false
    );

    fetch("/usuarios/cadastrar", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(dadosCadastro)
    })
        .then(function (resposta) {
            return resposta
                .json()
                .then(function (conteudo) {
                    return {
                        ok: resposta.ok,
                        conteudo: conteudo
                    };
                });
        })
        .then(function (resultado) {
            if (!resultado.ok) {
                throw new Error(
                    resultado.conteudo.mensagem ||
                    "Não foi possível cadastrar."
                );
            }

            mostrarMensagem(
                resultado.conteudo.mensagem,
                false
            );

            limparFormulario();

            setTimeout(function () {
                window.location.href = "./login.html";
            }, 1500);
        })
        .catch(function (erro) {
            mostrarMensagem(erro.message, true);
        })
        .finally(function () {
            botaoSalvar.disabled = false;
        });
}


// MOSTRAR OU OCULTAR SENHA

function mostrar_senha() {
    var campoSenha =
        document.getElementById("senha_ipt");

    if (campoSenha.type === "password") {
        campoSenha.type = "text";
    } else {
        campoSenha.type = "password";
    }
}


// STATUS

function configurarStatus() {
    var campoStatus =
        document.getElementById("status_ipt");

    var textoStatus =
        document.querySelector(".texto-status");

    function atualizarStatus() {
        if (campoStatus.checked) {
            textoStatus.textContent = "Ativo";
        } else {
            textoStatus.textContent = "Inativo";
        }
    }

    campoStatus.addEventListener(
        "change",
        atualizarStatus
    );

    atualizarStatus();
}


// MÁSCARAS DE CPF E TELEFONE

function configurarMascaras() {
    var campoCpf =
        document.getElementById("cpf_ipt");

    var campoTelefone =
        document.getElementById("telefone_ipt");

    campoCpf.addEventListener("input", function () {
        var cpf = campoCpf.value
            .replace(/\D/g, "")
            .slice(0, 11);

        cpf = cpf.replace(
            /(\d{3})(\d)/,
            "$1.$2"
        );

        cpf = cpf.replace(
            /(\d{3})(\d)/,
            "$1.$2"
        );

        cpf = cpf.replace(
            /(\d{3})(\d{1,2})$/,
            "$1-$2"
        );

        campoCpf.value = cpf;
    });

    campoTelefone.addEventListener("input", function () {
        var telefone = campoTelefone.value
            .replace(/\D/g, "")
            .slice(0, 11);

        if (telefone.length <= 10) {
            telefone = telefone.replace(
                /(\d{2})(\d)/,
                "($1) $2"
            );

            telefone = telefone.replace(
                /(\d{4})(\d)/,
                "$1-$2"
            );
        } else {
            telefone = telefone.replace(
                /(\d{2})(\d)/,
                "($1) $2"
            );

            telefone = telefone.replace(
                /(\d{5})(\d)/,
                "$1-$2"
            );
        }

        campoTelefone.value = telefone;
    });
}


// MENSAGEM

function mostrarMensagem(texto, erro) {
    var mensagem =
        document.getElementById("mensagem_cadastro");

    mensagem.textContent = texto;

    if (erro) {
        mensagem.style.color = "#ff7777";
    } else {
        mensagem.style.color = "#7dff91";
    }
}


// LIMPEZA DO FORMULÁRIO

function limparFormulario() {
    document.getElementById("nome_ipt").value = "";
    document.getElementById("email_ipt").value = "";
    document.getElementById("cpf_ipt").value = "";
    document.getElementById("senha_ipt").value = "";
    document.getElementById("data_nasc_input").value = "";
    document.getElementById("telefone_ipt").value = "";
    document.getElementById("cargo_ipt").value = "";
    document.getElementById("unidade_local_ipt").value = "";
}


// BOTÕES DE NAVEGAÇÃO

function cancelar() {
    window.history.back();
}

function voltar() {
    window.history.back();
}

function notificacao() {
    alert("Você não possui novas notificações.");
}