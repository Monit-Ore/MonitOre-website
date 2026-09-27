var totalPaginas = 10;



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
        <button type="button" aria-label="Editar usuário">
          <img src="./imgs/editar.svg" alt="Editar" />
        </button>
        <button type="button" aria-label="Excluir usuário">
          <img src="./imgs/deletar.svg" alt="Excluir" />
        </button>
      </div>
    </div>
  `;
}

function renderizarUsuarios(usuarios) {
  var tabela = document.querySelector(".tabela");
  if (!tabela) return;

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
  tabela.innerHTML = cabecalho + linhas;
}

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

    renderizarUsuarios(usuarios);
  } catch (erro) {
    console.error("Erro ao carregar funcionários:", erro);
  }
}

carregarUsuariosDaEmpresa();
