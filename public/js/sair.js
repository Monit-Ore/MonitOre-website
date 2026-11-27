async function encerrarSessao() {
  try {
    const resposta = await fetch("/usuarios/sair", { method: "POST" });
    if (!resposta.ok) throw new Error("Não foi possível sair. Tente novamente.");
    sessionStorage.clear();
    window.location.replace("/login.html");
  } catch (erro) { alert(erro.message); }
}
// Captura o clique antes dos handlers antigos que apenas limpavam o navegador.
document.addEventListener("click", function (evento) {
  if (evento.target.closest("#botao_sair")) {
    evento.preventDefault();
    evento.stopImmediatePropagation();
    encerrarSessao();
  }
}, true);
window.addEventListener("pageshow", function (evento) {
  if (evento.persisted) window.location.reload();
});
