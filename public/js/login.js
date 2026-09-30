const { animate, utils } = anime;

const stage = document.getElementById('stage');

for (let i = 0; i < 8; i++) {
      const quadrados = document.createElement('div');
      quadrados.className = 'shape' + (i % 2 ? ' vazio' : '');

      const tamanho = utils.random(25, 75);

      quadrados.style.width = quadrados.style.height = tamanho + 'px';
      quadrados.style.margin = `${-tamanho / 2}px 0 0 ${-tamanho / 2}px`;
      stage.appendChild(quadrados);
}


function moverQuadrados() {
  console.log('moverQuadrados chamada');
  const animeQuad = animate('.shape', {
  x: () => utils.random(-100, 100),
  y: () => utils.random(-100, 100),
  rotate: () => utils.random(-180, 180),
  duration: () => utils.random(500, 1000),
  composition: 'blend',
  ease: 'inOutQuad'
  });
}



// carregamento (loading)
function aguardar() {
    var divAguardar = document.getElementById("div_aguardar");
    moverQuadrados();
    setInterval(moverQuadrados, 500);
    divAguardar.style.display = "flex";
    
}

function finalizarAguardar(texto) {
    var divAguardar = document.getElementById("div_aguardar");
    moverQuadrados.revert();
    divAguardar.style.display = "none";
}

// AUTENTICAÇÃO

function autenticar() {
  
  var campoEmail = document.getElementById("email");

  var campoSenha = document.getElementById("senha");

  var mensagemLogin = document.getElementById("mensagem_login");

  var botaoEntrar = document.getElementById("botao_entrar");

  var email = campoEmail.value.trim().toLowerCase();

  var senha = campoSenha.value;

  // Limpa a mensagem anterior.
  mensagemLogin.textContent = "";

  // Validação do email.
  if (email === "") {
    mostrarMensagem("Informe o seu email.", true);

    campoEmail.focus();
    return;
  }

  // Validação da senha.
  if (senha === "") {
    mostrarMensagem("Informe a sua senha.", true);
    
    campoSenha.focus();
    return;
  }

  // Desativa o botão para impedir vários envios.
  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  var dadosLogin = {
    email: email,
    senha: senha,
  };

  fetch("/usuarios/autenticar", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(dadosLogin),
  })
    .then(function (resposta) {
      return resposta.json().then(function (conteudo) {
        return {
          ok: resposta.ok,
          conteudo: conteudo,
        };
      });
    })
    .then(function (resultado) {
      if (!resultado.ok) {
        throw new Error(
          resultado.conteudo.mensagem || "Não foi possível realizar o login.",
        );
      }

      salvarDadosUsuario(resultado.conteudo.usuario);

      mostrarMensagem(resultado.conteudo.mensagem, false);

      
      redirecionarUsuario();
    })
    .catch(function (erro) {
      mostrarMensagem(erro.message, true);
    })
    .finally(function () {
      botaoEntrar.disabled = false;
      botaoEntrar.textContent = "Entrar";
    });
}

// SALVAR DADOS DO USUÁRIO

function salvarDadosUsuario(usuario) {
  sessionStorage.setItem("ID_USUARIO", usuario.idUsuario);

  sessionStorage.setItem("NOME_USUARIO", usuario.nome);

  sessionStorage.setItem("EMAIL_USUARIO", usuario.email);

  sessionStorage.setItem("CARGO_USUARIO", usuario.cargo);

  sessionStorage.setItem("EMPRESA_USUARIO", usuario.empresa);

  sessionStorage.setItem("MINERADORA_USUARIO", usuario.mineradora || "");

  sessionStorage.setItem("FK_EMPRESA_USUARIO", usuario.fkEmpresa);
}

// REDIRECIONAMENTO

function redirecionarUsuario() {
  aguardar();
  setTimeout(function () {
      window.location.href = "./selecao_torre.html";
  }, 2000);
}

// MOSTRAR OU OCULTAR SENHA

function mostrarSenha() {
  var campoSenha = document.getElementById("senha");

  var botaoSenha = document.getElementById("botao_senha");

  if (campoSenha.type === "password") {
    campoSenha.type = "text";

    botaoSenha.setAttribute("aria-label", "Ocultar senha");
  } else {
    campoSenha.type = "password";

    botaoSenha.setAttribute("aria-label", "Mostrar senha");
  }
}

// MENSAGEM

function mostrarMensagem(texto, erro) {
  var mensagemLogin = document.getElementById("mensagem_login");

  mensagemLogin.textContent = texto;

  if (erro) {
    mensagemLogin.style.color = "#f64747";
  } else {
    mensagemLogin.style.color = "#53fd53";
  }
}

