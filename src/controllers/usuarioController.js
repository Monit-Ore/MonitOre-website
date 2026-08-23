var usuarioModel = require("../models/usuarioModel");

var bcrypt = require("bcryptjs");

function autenticar(req, res) {

    // recebe os dados enviados pelo login.js

    var email = req.body.email;

    var senha = req.body.senha;


    if (email == undefined || email == "") {

        return res.status(400).json({
            mensagem: "Email não informado."
        });

    }


    if (senha == undefined || senha == "") {

        return res.status(400).json({
            mensagem: "Senha não informada."
        });

    }


    usuarioModel.buscarPorEmail(email)

        .then(function (resultado) {


            if (resultado.length == 0) {

                return res.status(401).json({
                    mensagem: "Email ou senha inválidos."
                });

            }


            // Pega o primeiro usuário encontrado

            var usuario = resultado[0];


            if (usuario.status_usuario != "Ativo") {

                return res.status(403).json({
                    mensagem: "Usuário inativo."
                });

            }


            if (usuario.status_cargo != "Ativo") {

                return res.status(403).json({
                    mensagem: "Cargo do usuário está inativo."
                });

            }


            if (usuario.status_empresa != "Ativo") {

                return res.status(403).json({
                    mensagem: "Empresa do usuário está inativa."
                });

            }


            bcrypt.compare(senha, usuario.senha_hash)

                .then(function (senhaCorreta) {



                    if (senhaCorreta == false) {

                        return res.status(401).json({
                            mensagem: "Email ou senha inválidos."
                        });

                    }

                    usuarioModel
                        .atualizarUltimoAcesso(usuario.id_usuario)

                        .then(function () {


                            // Envia a resposta para o login.js

                            return res.status(200).json({

                                mensagem:
                                    "Login realizado com sucesso.",


                                primeiroAcesso:
                                    usuario.primeiro_acesso == 1,


                                usuario: {

                                    idUsuario:
                                        usuario.id_usuario,

                                    nome:
                                        usuario.nome

                                }

                            });

                        })

                        .catch(function (erro) {

                            console.log(erro);

                            return res.status(500).json({
                                mensagem:
                                    "Erro ao atualizar último acesso."
                            });

                        });

                })

                .catch(function (erro) {

                    console.log(erro);

                    return res.status(500).json({
                        mensagem:
                            "Erro ao verificar senha."
                    });

                });

        })

        .catch(function (erro) {

            console.log(erro);

            return res.status(500).json({
                mensagem:
                    "Erro ao realizar login."
            });

        });

}


module.exports = {
    autenticar
};