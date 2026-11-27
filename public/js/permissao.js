const permissoes = {
    suporte: ["dashboard-suporte"],
    administrador: [
        "dashboard-capacidade",
        "dashboard-torre",
        "dashboard-processos-gerais",
        "usuarios",
        "torres",
        "mineradoras",
        "gerenciar-torres",
        "visualizacao_torre",
        "dashboard-mineradoras"
    ],

    operador: [
        "dashboard-mineradoras",
        "dashboard-capacidade",
        "torres",
        "dashboard-torre",
        "visualizacao_torre"
    ]
};

async function aplicarPermissoes() {
    try {
        const resposta = await fetch("/usuarios/sessao");
        if (resposta.status === 401) {
            sessionStorage.clear();
            window.location.replace("/login.html");
            return;
        }
        if (!resposta.ok) throw new Error("Não foi possível validar a sessão.");
        const usuario = await resposta.json();
        sessionStorage.setItem("CARGO_USUARIO", usuario.cargo);
    } catch (erro) {
        document.body.textContent = "Não foi possível validar sua sessão. Recarregue a página.";
        return;
    }


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

    if (pagina && (pagina !== "perfil" || cargo === "suporte") && !itensPermitidos.includes(pagina)) {
        document.body.style.display = "none";
        const destino = cargo === "suporte" ? "/dashboard-suporte.html" : sessionStorage.getItem("CARGO_USUARIO")
            ? "/selecao_torre.html"
            : "/login.html";
        window.location.replace(destino);
        return;
    }

    document.body.style.visibility = "visible";
}

document.addEventListener("DOMContentLoaded", aplicarPermissoes);
