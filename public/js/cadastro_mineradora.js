MonitOre.instalarChrome({
  identity: {
    exigirNome: false,
    iniciais: { estilo: 'primeiro-ultimo', maiusculas: true, fallback: 'US' },
  },
  menu: true,
  logout: true,
  profileId: 'usuario_logado',
  onReady: function () {
    configurarMascaraCnpj();
  },
});

// APLICAÇÃO DE MÁSCARA AUTOMÁTICA NO CNPJ (00.000.000/0000-00)
function configurarMascaraCnpj() {
  const campoCnpj = document.getElementById("cnpj_ipt");

  if (campoCnpj) {
    campoCnpj.setAttribute("maxlength", "18");

    campoCnpj.addEventListener("input", function () {
      let valor = campoCnpj.value.replace(/\D/g, "").slice(0, 14);

      if (valor.length > 12) {
        valor = valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
      } else if (valor.length > 8) {
        valor = valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
      } else if (valor.length > 5) {
        valor = valor.replace(/^(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
      } else if (valor.length > 2) {
        valor = valor.replace(/^(\d{2})(\d{1,3})/, "$1.$2");
      }

      campoCnpj.value = valor;
    });
  }
}

// VALIDAÇÃO E DISPARO DO CADASTRO
function salvar() {
  const razaoSocial = document.getElementById("nome_ipt").value.trim();
  const email = document.getElementById("email_ipt").value.trim();
  const cnpjLimpo = document.getElementById("cnpj_ipt").value.replace(/\D/g, "");

  if (razaoSocial.length < 3) {
    mostrarMensagem("Informe a Razão Social da mineradora (mínimo 3 caracteres).", true);
    return;
  }

  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !regexEmail.test(email)) {
    mostrarMensagem("Informe um e-mail corporativo válido.", true);
    return;
  }

  if (cnpjLimpo.length !== 14) {
    mostrarMensagem("O CNPJ deve conter exatamente 14 números.", true);
    return;
  }

  const dadosMineradora = {
    razaoSocial: razaoSocial,
    email: email,
    cnpj: cnpjLimpo,
    tipo: "Mineradora"
  };

  enviarCadastroMineradora(dadosMineradora);
}

// REQUISIÇÃO HTTP POST PARA O BACKEND
function enviarCadastroMineradora(dados) {
  const botaoSalvar = document.querySelector(".btn-salvar");
  botaoSalvar.disabled = true;

  mostrarMensagem("Cadastrando mineradora...", false);

  fetch("/empresas/cadastrar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dados),
  })
    .then(async function (resposta) {
      const conteudo = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        throw new Error(conteudo.mensagem || "Não foi possível cadastrar a mineradora.");
      }

      mostrarMensagem(conteudo.mensagem || "Mineradora cadastrada com sucesso!", false);
      limparFormulario();
    })
    .catch(function (erro) {
      mostrarMensagem(erro.message, true);
    })
    .finally(function () {
      botaoSalvar.disabled = false;
    });
}

// FEEDBACK VISUAL
function mostrarMensagem(texto, erro) {
  const elementoMensagem = document.getElementById("mensagem_cadastro");

  if (!elementoMensagem) return;

  elementoMensagem.textContent = texto;
  elementoMensagem.style.color = erro ? "#ff7777" : "#7dff91";
}

// LIMPEZA DOS CAMPOS
function limparFormulario() {
  const nomeIpt = document.getElementById("nome_ipt");
  const emailIpt = document.getElementById("email_ipt");
  const cnpjIpt = document.getElementById("cnpj_ipt");

  if (nomeIpt) nomeIpt.value = "";
  if (emailIpt) emailIpt.value = "";
  if (cnpjIpt) cnpjIpt.value = "";
}

// NAVEGAÇÃO E MENU
function voltar() {
  window.history.back();
}

function ativarTorres() {
  window.location.href = "/selecao_torre.html";
}

function ativarUsuarios() {
  window.location.href = "/tela_cadastro_funcionario.html";
}

function ativarCargos() {
  window.location.href = "/cargos.html";
}

function ativarAlertas() {
  window.location.href = "/alertas.html";
}

function ativarManual() {
  window.location.href = "/manual.html";
}

function ativarMenu(idAtivo) {
  MonitOre.ativarMenu(idAtivo);
}
