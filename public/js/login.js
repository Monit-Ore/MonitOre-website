// AUTENTICAÇÃO

function autenticar() {
    var campoEmail =
        document.getElementById("email");

    var campoSenha =
        document.getElementById("senha");

    var mensagemLogin =
        document.getElementById("mensagem_login");

    var botaoEntrar =
        document.getElementById("botao_entrar");

    var email = campoEmail.value
        .trim()
        .toLowerCase();

    var senha = campoSenha.value;

    // Limpa a mensagem anterior.
    mensagemLogin.textContent = "";

    // Validação do email.
    if (email === "") {
        mostrarMensagem(
            "Informe o seu email.",
            true
        );

        campoEmail.focus();
        return;
    }

    // Validação da senha.
    if (senha === "") {
        mostrarMensagem(
            "Informe a sua senha.",
            true
        );

        campoSenha.focus();
        return;
    }

    // Desativa o botão para impedir vários envios.
    botaoEntrar.disabled = true;
    botaoEntrar.textContent = "Entrando...";

    var dadosLogin = {
        email: email,
        senha: senha
    };

    fetch("/usuarios/autenticar", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(dadosLogin)
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
                    "Não foi possível realizar o login."
                );
            }

            salvarDadosUsuario(
                resultado.conteudo.usuario
            );

            mostrarMensagem(
                resultado.conteudo.mensagem,
                false
            );

            redirecionarUsuario(
                resultado.conteudo.primeiroAcesso
            );
        })
        .catch(function (erro) {
            mostrarMensagem(
                erro.message,
                true
            );
        })
        .finally(function () {
            botaoEntrar.disabled = false;
            botaoEntrar.textContent = "Entrar";
        });
}


// SALVAR DADOS DO USUÁRIO

function salvarDadosUsuario(usuario) {
    sessionStorage.setItem(
        "ID_USUARIO",
        usuario.idUsuario
    );

    sessionStorage.setItem(
        "NOME_USUARIO",
        usuario.nome
    );

    sessionStorage.setItem(
        "EMAIL_USUARIO",
        usuario.email
    );

    sessionStorage.setItem(
        "CARGO_USUARIO",
        usuario.cargo
    );

    sessionStorage.setItem(
        "EMPRESA_USUARIO",
        usuario.empresa
    );

    sessionStorage.setItem(
        "MINERADORA_USUARIO",
        usuario.mineradora || ""
    );
}


// REDIRECIONAMENTO

function redirecionarUsuario(primeiroAcesso) {
    setTimeout(function () {
        if (primeiroAcesso) {
            window.location.href =
                "./primeiro-acesso.html";
        } else {
            window.location.href =
                "./dashboard.html";
        }
    }, 1000);
}


// MOSTRAR OU OCULTAR SENHA

function mostrarSenha() {
    var campoSenha =
        document.getElementById("senha");

    var botaoSenha =
        document.getElementById("botao_senha");

    if (campoSenha.type === "password") {
        campoSenha.type = "text";

        botaoSenha.setAttribute(
            "aria-label",
            "Ocultar senha"
        );
    } else {
        campoSenha.type = "password";

        botaoSenha.setAttribute(
            "aria-label",
            "Mostrar senha"
        );
    }
}


// MENSAGEM

function mostrarMensagem(texto, erro) {
    var mensagemLogin =
        document.getElementById("mensagem_login");

    mensagemLogin.textContent = texto;

    if (erro) {
        mensagemLogin.style.color = "#ffdddd";
    } else {
        mensagemLogin.style.color = "#d7ffd7";
    }
}