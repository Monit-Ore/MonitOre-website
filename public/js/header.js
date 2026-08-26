MenuHamburguer.addEventListener('click', function() {

    if (opcoes_celular.style.display == 'flex') {
        MenuHamburguer.style.rotate = '0deg';
        opcoes_celular.style.display = 'none';
    } else {
        MenuHamburguer.style.rotate = '90deg';
        opcoes_celular.style.display = 'flex';
    }
});


botoesLogin = document.querySelectorAll(".botaoLogin");

for (let i = 0; i < botoesLogin.length; i++) {
    botoesLogin[i].addEventListener('click', function() {
        window.location = "login.html";
    })
}

botaoTelaInicio.addEventListener('click', function() {
    window.location = "index.html";
})

botaoTelaSobre.addEventListener('click', function() {
    window.location = "";
})

botaoTelaEquipe.addEventListener('click', function() {
    window.location = "";
})