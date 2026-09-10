MenuHamburguer.addEventListener('click', function() {

    if (opcoes_celular.style.display == 'flex') {
        MenuHamburguer.style.rotate = '0deg';
        opcoes_celular.style.display = 'none';
    } else {
        MenuHamburguer.style.rotate = '90deg';
        opcoes_celular.style.display = 'flex';
    }
});


botoesLogin = document.querySelectorAll(".IrParaLogin");

for (let i = 0; i < botoesLogin.length; i++) {
    botoesLogin[i].addEventListener('click', function() {
        window.location = "login.html";
    })
}

botoesInicio = document.querySelectorAll(".irParaInicio");

for (let i = 0; i < botoesInicio.length; i++) {
    botoesInicio[i].addEventListener('click', function() {
        window.location = "index.html";
    })
}

botoesSobre = document.querySelectorAll(".irParaSobre");

for (let i = 0; i < botoesSobre.length; i++) {
    botoesSobre[i].addEventListener('click', function() {
        window.location = "sobre.html";
    })
}

botoesEquipe = document.querySelectorAll(".irParaEquipe");

for (let i = 0; i < botoesEquipe.length; i++) {
    botoesEquipe[i].addEventListener('click', function() {
        window.location = "equipe.html";
    })
}