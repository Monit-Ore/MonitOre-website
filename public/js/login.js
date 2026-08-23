function mostrarSenha() {

    var campoSenha = document.getElementById("senha");


    if (campoSenha.type == "password") {

        campoSenha.type = "text";

    } else {

        campoSenha.type = "password";

    }

}
function autenticar() {

    var email =
        document.getElementById("email").value;

    var senha =
        document.getElementById("senha").value;

    var mensagem =
        document.getElementById("mensagem_login");

    mensagem.innerHTML = "";

    if (email == "" || senha == "") {

        mensagem.innerHTML =
            "Preencha todos os campos.";

        return;

    }


    fetch("/usuarios/autenticar", {

        method: "POST",

        headers: {

            "Content-Type":
                "application/json"

        },

        body: JSON.stringify({

            email: email,

            senha: senha

        })

    })


    // Transforma a resposta em JSON

    .then(function (resposta) {

        return resposta.json();

    })


    // Trabalha com a resposta recebida

    .then(function (dados) {


        if (dados.usuario == undefined) {

            mensagem.innerHTML =
                dados.mensagem;

            return;

        }


        sessionStorage.ID_USUARIO =
            dados.usuario.idUsuario;


        sessionStorage.NOME_USUARIO =
            dados.usuario.nome;


        if (dados.primeiroAcesso == true) {

            window.location.href =
                "./primeiro-acesso.html";

        } else {

            window.location.href =
                "./dashboard.html";

        }

    })


    // Caso aconteça algum erro de conexão

    .catch(function (erro) {

        console.log(erro);


        mensagem.innerHTML =
            "Erro ao conectar com o servidor.";

    });

}