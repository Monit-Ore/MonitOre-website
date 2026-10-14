const permissoes = {
    administrador: [
        "dashboard",
        "usuarios",
        "torres",
        "mineradoras",
        "gerenciar-torres"
    ],

    operador: [
        "torres",
        "dashboard"
    ]
};

function aplicarPermissoes() {

    const cargo = (sessionStorage.getItem("CARGO_USUARIO") || "")
        .trim()
        .toLowerCase();

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

    const pagina = document.body.dataset.permissaoPagina;

    if (pagina && pagina !== "perfil" && !itensPermitidos.includes(pagina)) {
        document.body.style.display = "none";
        const destino = sessionStorage.getItem("CARGO_USUARIO")
            ? "/selecao_torre.html"
            : "/login.html";
        window.location.replace(destino);
        return;
    }

    document.body.style.visibility = "visible";
}

document.addEventListener("DOMContentLoaded", aplicarPermissoes);