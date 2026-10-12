const permissoes = {
    Administrador: [
        "dashboard",
        "torres",
        "usuarios",
        "mineradoras"
    ],

    Operador: [
        "dashboard"
    ]
};

function aplicarPermissoes() {

    const cargo = sessionStorage.getItem("CARGO_USUARIO");

    // Se não houver um cargo válido, não libera os menus.
    const itensPermitidos = permissoes[cargo] || [];

    document.querySelectorAll("[data-permissao]").forEach(item => {

        const permissao = item.dataset.permissao;

        if (itensPermitidos.includes(permissao)) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }

    });

    // Impede a navegação para páginas administrativas
    // por meio deste controle do frontend.
    const pagina = document.body.dataset.permissaoPagina;

    if (pagina === "perfil") {
        return;
    }

    if (pagina && !itensPermitidos.includes(pagina)) {
        window.location.replace("/dashboard.html");
    }
}

document.addEventListener("DOMContentLoaded", aplicarPermissoes);