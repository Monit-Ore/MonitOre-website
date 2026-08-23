MenuHamburguer.addEventListener('click', function() {

    if (opcoes_celular.style.display == 'flex') {
        MenuHamburguer.style.rotate = '0deg';
        opcoes_celular.style.display = 'none';
    } else {
        MenuHamburguer.style.rotate = '90deg';
        opcoes_celular.style.display = 'flex';
    }
});