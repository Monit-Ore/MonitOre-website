// function carregarIniciais() {
//   const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
//   const iniciais = [];

//   for (let i = 0; i < nomeUsuario.length; i++) {
    
//     if (i == 0) {
//       iniciais.push(nomeUsuario[i]);
//     }

//     if (nomeUsuario[i] == " ") {
//       iniciais.push(nomeUsuario[i + 1])
//       break;
//     }
    
//   }
//   avatar_usuario.textContent = iniciais.join('');
// }


document.addEventListener("DOMContentLoaded", () => {
  carregarUsuarioMenu();
  carregarIniciais();
  document.getElementById("botao_sair")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });
});



