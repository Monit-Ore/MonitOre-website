const { createTimeline, stagger, spring } = anime;

var totalUsuariosPorPagina = 10;
var paginaAtual = 1;
var todosUsuarios = [];
var usuarioParaDeletar = null;

async function carregarUsuariosDaEmpresa() {
  var fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");

  if (!fkEmpresa) {
    console.log(
      "Nenhuma empresa do usuário logado foi encontrada no sessionStorage.",
    );
    return;
  }

  try {
    var resposta = await fetch(`/usuarios/listar?fkEmpresa=${fkEmpresa}`);
    var usuarios = await resposta.json();

    if (!resposta.ok) {
      throw new Error(usuarios.mensagem || "Erro ao carregar usuários.");
    }

    todosUsuarios = usuarios || [];
    irParaPagina(1); 
  } catch (erro) {
    console.error("Erro ao carregar funcionários:", erro);
  }
}


function montarLinhaUsuario(usuario) {
  var cargoClass =
    usuario.cargo === "Administrador" ? "tag_admin" : "tag_analista";

  return `
    <div class="linha">
      <div class="coluna">${usuario.nome || "---"}</div>
      <div class="coluna">${usuario.email || "---"}</div>
      <div class="coluna">
        <span class="tag ${cargoClass}">${usuario.cargo || "Sem cargo"}</span>
      </div>
      <div class="coluna">${usuario.ultimo_acesso || "---"}</div>
      <div class="coluna">
        <button type="button" aria-label="Editar usuário" onclick="redirecionarEditar(${usuario.id_usuario})">
          <img src="./imgs/editar.svg" alt="Editar" />
        </button>
        <button type="button" onclick="abrirModalDeletar(${usuario.id_usuario})" aria-label="Excluir usuário">
          <img src="./imgs/deletar.svg" alt="Excluir" />
        </button>
      </div>
    </div>
  `;
}

function redirecionarEditar(idUsuario){
  sessionStorage.setItem("ID_EDITAR_USUARIO", idUsuario);
  var cargo = sessionStorage.getItem("CARGO_EDITAR_USUARIO");
  console.log(cargo);
  
  window.location.href = "./editar_usuario.html"
}

function pegarUsuariosDaPagina(pagina) {
  var inicio = (pagina - 1) * totalUsuariosPorPagina;
  var fim = inicio + totalUsuariosPorPagina;
  return todosUsuarios.slice(inicio, fim);
}

function renderizarUsuarios(usuarios) {
  var tabela = document.querySelector(".tabela");

  var cabecalho = `
    <div class="linha linha_titulo">
      <div class="coluna">Usuário</div>
      <div class="coluna">E-mail</div>
      <div class="coluna">Cargo</div>
      <div class="coluna">Último acesso</div>
      <div class="coluna">Ações</div>
    </div>
  `;

  var linhas = "";

  for (var i = 0; i < (usuarios || []).length; i++) {
    var usuario = usuarios[i];
    linhas += montarLinhaUsuario(usuario);
  }
  if (!linhas) {
    linhas = '<div class="linha sem_resultados">Nenhum usuário encontrado.</div>';
  }
  tabela.innerHTML = cabecalho + linhas;
}


function criarBotao(numeroPagina, paginaAtual) {
  if (numeroPagina === paginaAtual) {
    return `<button type="button" class="pagina_atual" data-pagina="${numeroPagina}">${numeroPagina}</button>`;
  } else {
    return `<button type="button" data-pagina="${numeroPagina}">${numeroPagina}</button>`;
  }
}

function renderizarPaginacao() {
  var rodape = document.querySelector(".rodape");
  if (!rodape) return;

  var totalUsuarios = todosUsuarios.length;
  var totalPaginas = Math.ceil(totalUsuarios / totalUsuariosPorPagina);

  var textoInfo = rodape.querySelector("p");
  var inicio = totalUsuarios === 0 ? 0 : (paginaAtual - 1) * totalUsuariosPorPagina + 1;
  var fim = Math.min(paginaAtual * totalUsuariosPorPagina, totalUsuarios);
  textoInfo.textContent = "Mostrando " + inicio + " a " + fim + " de " + totalUsuarios + " usuários";

  var containerPaginas = rodape.querySelector(".paginas");
  var html = "";

  if (totalPaginas === 0) {
    html = '<button type="button" disabled>&lt;</button><button type="button" disabled>&gt;</button>';
    containerPaginas.innerHTML = html;
    return;
  }

  if (paginaAtual === 1) {
    html += `<button type="button" disabled>&lt;</button>`;
  } else {
    html += `<button type="button" data-pagina="${paginaAtual - 1}">&lt;</button>`;
  }


  if (totalPaginas <= 4) {
    html += criarBotao(1, paginaAtual);
    if (totalPaginas >= 2) html += criarBotao(2, paginaAtual);
    if (totalPaginas >= 3) html += criarBotao(3, paginaAtual);
    if (totalPaginas >= 4) html += criarBotao(4, paginaAtual);
  } else {
    html += criarBotao(1, paginaAtual);
    html += criarBotao(2, paginaAtual);
    html += criarBotao(3, paginaAtual);
    html += `<span>...</span>`;
    html += criarBotao(totalPaginas, paginaAtual);
  }

  if (paginaAtual === totalPaginas) {
    html += `<button type="button" disabled>&gt;</button>`;
  } else {
    html += `<button type="button" data-pagina="${paginaAtual + 1}">&gt;</button>`;
  }

  containerPaginas.innerHTML = html;



  var botoes = containerPaginas.querySelectorAll("button[data-pagina]");
  for (var i = 0; i < botoes.length; i++) {
    botoes[i].addEventListener("click", function () {
      var novaPagina = Number(this.getAttribute("data-pagina"));
      irParaPagina(novaPagina);
    });
  }
}

function irParaPagina(pagina) {
  var totalPaginas = Math.ceil(todosUsuarios.length / totalUsuariosPorPagina);
  if (totalPaginas === 0) {
    paginaAtual = 1;
    renderizarUsuarios([]);
    renderizarPaginacao();
    return;
  }
  if (pagina < 1 || pagina > totalPaginas) return;

  paginaAtual = pagina;
  renderizarUsuarios(pegarUsuariosDaPagina(paginaAtual));
  renderizarPaginacao();
}

function abrirModalDeletar(idUsuario) {
  usuarioParaDeletar = idUsuario;
  document.getElementById("modal_confirmar_exclusao").showModal();
}

async function deletar(idUsuario){

  if (!idUsuario) {
    console.log(
      "Nenhum usuário válido foi informado.",
    );
    return;
  }

  try {
    var resposta = await fetch(`/usuarios/deletar/${idUsuario}`, {
      method: "DELETE",
    });
    var resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.mensagem || "Erro ao deletar usuário.");
    }

    todosUsuarios = todosUsuarios.filter(function (usuario) {
      return usuario.id_usuario !== idUsuario;
    });
    
    irParaPagina(paginaAtual);
    document.getElementById("modal_confirmar_exclusao").close();
    usuarioParaDeletar = null;
   
  } catch (erro) {
    console.error("Erro ao deletar usuário:", erro);
  }
}



function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) {
    return;
  }
  nome_usuario.textContent = nomeUsuario;

  const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO");
  if (!cargoUsuario) {
    return;
  }
  cargo_usuario.textContent = cargoUsuario;
}

function carregarIniciais() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) {
    return;
  }

  const iniciais = [];

  for (let i = 0; i < nomeUsuario.length; i++) {
    
    if (i == 0) {
      iniciais.push(nomeUsuario[i]);
    }

    if (nomeUsuario[i] == " ") {
      iniciais.push(nomeUsuario[i + 1])
      break;
    }
    
  }
  var avatar = document.getElementById("avatar_usuario");
  var segundoAvatar = document.getElementById("avatar_usuario_2");
  if (avatar) avatar.textContent = iniciais.join('');
  if (segundoAvatar) segundoAvatar.textContent = iniciais.join('');
}


document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("cancelar_exclusao")?.addEventListener("click", () => {
    document.getElementById("modal_confirmar_exclusao").close();
    usuarioParaDeletar = null;
  });

  document.getElementById("confirmar_exclusao")?.addEventListener("click", () => {
    if (usuarioParaDeletar !== null) {
      deletar(usuarioParaDeletar);
    }
  });

  carregarUsuarioMenu();
  carregarIniciais();

  const botaoMenu = document.querySelector(".btn-notificacao");

  botaoMenu?.addEventListener("click", () =>
    document.body.classList.toggle("menu-aberto"),
  );

  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  const logo_anime = createTimeline({
    defaults: {
      ease: spring({
      bounce: 0.3,
      duration: 400
      })
    }
  });

  logo_anime.add(
    '#yellow-icon', {
    translateY: [-100, 0],
    translateX: ['-50%', '-50%'],
    opacity: [0, 1],
    duration: 900,

  })
  .add(
    '#letters', {
    
    translateY: [
      { from: 0, to: 20, duration: 300, ease: 'outQuad' },
      { to: 0, duration: 400, ease: 'outBounce' },
    ],
    
    
  }, '-=700');
})


async function buscarUsuarios() {
  var fkEmpresa = sessionStorage.getItem("FK_EMPRESA_USUARIO");
  var termo = busca.value

  if (!fkEmpresa) {
    console.log(
      "Nenhuma empresa do usuário logado foi encontrada no sessionStorage.",
    );
    return;
  }

  if(!termo || termo.trim().length === 0){
    carregarUsuariosDaEmpresa()
  }else{

  try {
    var resposta = await fetch(`/usuarios/buscar?fkEmpresa=${fkEmpresa}&termo=${termo}`);
    var usuarios = await resposta.json();

    if (!resposta.ok) {
      throw new Error(usuarios.mensagem || "Erro ao carregar usuários.");
    }

    todosUsuarios = usuarios || [];
    irParaPagina(1); 
  } catch (erro) {
    console.error("Erro ao carregar funcionários:", erro);
  }
  }
}



carregarUsuariosDaEmpresa();
