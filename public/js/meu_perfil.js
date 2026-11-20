function ativarMenu(idAtivo) {
  MonitOre.ativarMenu(idAtivo);
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

MonitOre.instalarChrome({
  identity: true,
  menu: true,
  logout: true,
});
