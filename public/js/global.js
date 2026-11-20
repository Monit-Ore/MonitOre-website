function ativarMenu(idAtivo) {
  document.querySelectorAll(".menu_navegacao .item_menu").forEach((item) => {
    item.classList.toggle("ativo", item.id === idAtivo);
  });
}

function ativarTorres() {
  ativarMenu("torres");
}

function ativarUsuarios() {
  ativarMenu("usuarios");
}

function ativarCargos() {
  ativarMenu("cargos");
}

function ativarAlertas() {
  ativarMenu("alertas");
}

function ativarManual() {
  ativarMenu("manual");
}

function ativarPerfil() {
  ativarMenu("perfil");
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

function voltar() {
  window.history.back();
}

function tituloMetrica(nomeComponente) {
  const rotulos = {
    CPU: "Porcentagem CPU",
    RAM: "Uso da Memória RAM",
    Disco: "Disponibilidade do Disco",
  };
  return rotulos[nomeComponente] || nomeComponente;
}
