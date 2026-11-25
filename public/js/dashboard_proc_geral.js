var id = sessionStorage.getItem("ID_USUARIO");

function visualizarQtdTorreAtivas(mineradora){
    const filtroMineradora = mineradora && mineradora !== "-"
        ? `?mineradora=${encodeURIComponent(mineradora)}`
        : "";

    fetch(`/torres/qtdTorresAtivas/${id}${filtroMineradora}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    })
        .then(function (resposta){
            if (resposta.ok){
                resposta.json().then(function (banco) {
                    console.log("Dados recebidos com sucesso");

                    var qtdTotal = banco.qtdTotalTorres;
                    var qtdAtiva = banco.torres_online;
                    var qtdTotalAtiva = banco.torres_online
                    

                    document.getElementById("qtdAtiva").innerHTML = qtdAtiva;
                    document.getElementById("qtdTorres").innerHTML = qtdTotal;
                    document.getElementById("qtdTotalAtiva").innerHTML = qtdTotalAtiva;
                });
            }else{
                console.log("Erro na resposta do servidor");
                
            }
        })
        .catch(function (resposta) {
            console.log("#ERRO", resposta);
        });
}

function visualizarMineradorasDoUsuario(){
    fetch(`/empresas/mineradoras/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(function (resposta){
            if (resposta.ok){
                resposta.json().then(function (banco) {
                    console.log("Dados recebidos com sucesso");
                    let selecionarMineradora = `<option value="-">Mineradora: Todos</option>`;

                    for(let i = 0; i < banco.length; i++){
                        let mineradora = banco[i].Mineradoras;
                        selecionarMineradora += `
                            <option value="${mineradora}">${mineradora}</option>
                        `
                    }
                    
                    const selectMineradora = document.getElementById("selecao_mineradora");
                    selectMineradora.innerHTML = selecionarMineradora;
                    selectMineradora.addEventListener("change", function (evento) {
                        visualizarQtdTorreAtivas(evento.target.value);
                    });
                });
            }else{
                console.log("Erro na resposta do servidor");
                
            }
        })
        .catch(function (resposta) {
            console.log("#ERRO", resposta);
        });
}

document.addEventListener("DOMContentLoaded", function () {
    visualizarQtdTorreAtivas();
    visualizarMineradorasDoUsuario();

    const modal = document.getElementById("meuModal");
    const btnAbrir = document.getElementById("abrirModal");
    const btnFechar = document.getElementById("fecharModal");
    const seletorMineradora = document.getElementById("selecao_mineradora");

    if (!modal) return;

    const listaTorres = document.getElementById("listaTorresModal");
    const campoBusca = document.getElementById("buscaTorre");
    const subtitulo = document.getElementById("modal_subtitulo");
    const contador = document.getElementById("contadorTorres");
    const qtdSelecionadas = document.getElementById("qtdSelecionadas");
    const btnLimpar = document.getElementById("limparSelecao");
    const btnAplicar = document.getElementById("aplicarFiltro");

    let torresDisponiveis = [];
    const selecionadas = new Set();

    // Mantém a seleção feita anteriormente ao trocar de mineradora ou reabrir o modal.
    try {
        const salvas = JSON.parse(
            sessionStorage.getItem("ID_TORRES_SELECIONADAS") || "[]"
        );
        if (Array.isArray(salvas)) {
            salvas.forEach((torreId) => selecionadas.add(String(torreId)));
        }
    } catch (erro) {
        sessionStorage.removeItem("ID_TORRES_SELECIONADAS");
    }

    function escaparHtml(valor) {
        return String(valor == null ? "" : valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function mineradoraSelecionada() {
        const valor = seletorMineradora ? seletorMineradora.value : "";
        return valor && valor !== "-" ? valor : "";
    }

    function salvarSelecao() {
        sessionStorage.setItem(
            "ID_TORRES_SELECIONADAS",
            JSON.stringify(Array.from(selecionadas))
        );
    }

    function atualizarIndicadores() {
        const total = selecionadas.size;

        salvarSelecao();
        if (qtdSelecionadas) qtdSelecionadas.textContent = total;
        if (btnAbrir) {
            btnAbrir.textContent = total
                ? `Filtragem de Torre (${total})`
                : "Filtragem de Torre";
        }
    }

    function criarOpcao(torre) {
        const idTorre = String(torre.id_torre);
        const nome = escaparHtml(torre.nome || `Torre ${idTorre}`);
        const codigo = torre.codigo ? `Código ${escaparHtml(torre.codigo)}` : "Sem código";
        const ativa = String(torre.status_operacional || "").toLowerCase() === "ativo";
        const status = torre.status_operacional
            ? (ativa ? "Ativa" : "Inativa")
            : "Sem status";

        return `
            <label class="opcao_torre" for="torre_${idTorre}">
                <input type="checkbox" id="torre_${idTorre}" value="${escaparHtml(idTorre)}"
                    ${selecionadas.has(idTorre) ? "checked" : ""}>
                <span class="torre_info">
                    <span class="torre_nome">${nome}</span>
                    <span class="torre_detalhe">
                        <i class="status_bolinha ${ativa ? "" : "inativo"}"></i>
                        ${codigo} • ${status}
                    </span>
                </span>
            </label>
        `;
    }

    function renderizarTorres() {
        const termo = (campoBusca ? campoBusca.value : "").trim().toLowerCase();
        const filtradas = torresDisponiveis.filter(function (torre) {
            if (!termo) return true;

            return [torre.nome, torre.codigo, torre.mineradora_nome]
                .some((valor) => String(valor || "").toLowerCase().includes(termo));
        });

        if (contador) {
            contador.textContent = `${filtradas.length} ${filtradas.length === 1 ? "torre" : "torres"}`;
        }

        if (filtradas.length === 0) {
            const mensagem = torresDisponiveis.length === 0
                ? "Nenhuma torre disponível para esta mineradora."
                : "Nenhuma torre encontrada para a busca.";

            listaTorres.innerHTML = `<p class="estado_vazio">${mensagem}</p>`;
            return;
        }

        // Com "Todas" as torres são agrupadas, evitando uma lista longa e solta.
        if (mineradoraSelecionada()) {
            listaTorres.innerHTML = `<div class="grupo_lista">${filtradas.map(criarOpcao).join("")}</div>`;
            return;
        }

        const grupos = new Map();
        filtradas.forEach(function (torre) {
            const nome = torre.mineradora_nome || "Mineradora não informada";
            if (!grupos.has(nome)) grupos.set(nome, []);
            grupos.get(nome).push(torre);
        });

        listaTorres.innerHTML = Array.from(grupos, function ([nome, torres]) {
            return `
                <section class="grupo_torres">
                    <h2 class="grupo_titulo">${escaparHtml(nome)} <span>${torres.length}</span></h2>
                    <div class="grupo_lista">${torres.map(criarOpcao).join("")}</div>
                </section>
            `;
        }).join("");
    }

    async function carregarTorresDisponiveis() {
        const mineradora = mineradoraSelecionada();

        if (subtitulo) {
            subtitulo.textContent = mineradora
                ? `Torres da mineradora ${mineradora}`
                : "Selecione as torres que deseja analisar";
        }

        listaTorres.innerHTML = '<p class="estado_vazio">Carregando torres...</p>';

        const filtroMineradora = mineradora
            ? `?mineradora=${encodeURIComponent(mineradora)}`
            : "";

        try {
            const resposta = await fetch(
                `/torres/disponiveis/${encodeURIComponent(id || "")}${filtroMineradora}`
            );

            if (!resposta.ok) {
                throw new Error("Falha ao buscar torres disponíveis.");
            }

            const dados = await resposta.json();
            torresDisponiveis = Array.isArray(dados) ? dados : [];
            renderizarTorres();
        } catch (erro) {
            console.error("Erro ao carregar torres do modal:", erro);
            torresDisponiveis = [];
            listaTorres.innerHTML = '<p class="estado_vazio">Não foi possível carregar as torres.</p>';
            if (contador) contador.textContent = "0 torres";
        }
    }

    function abrirModal() {
        if (modal.open) return;

        carregarTorresDisponiveis();
        modal.showModal();
        campoBusca?.focus();
    }

    function fecharModal() {
        if (modal.open) modal.close();
    }

    window.selecionarTorre = abrirModal;

    btnAbrir?.addEventListener("click", abrirModal);
    btnFechar?.addEventListener("click", fecharModal);
    modal.addEventListener("click", function (evento) {
        if (evento.target === modal) fecharModal();
    });
    campoBusca?.addEventListener("input", renderizarTorres);
    listaTorres?.addEventListener("change", function (evento) {
        const checkbox = evento.target.closest('input[type="checkbox"]');
        if (!checkbox) return;

        if (checkbox.checked) {
            selecionadas.add(checkbox.value);
        } else {
            selecionadas.delete(checkbox.value);
        }

        atualizarIndicadores();
    });
    btnLimpar?.addEventListener("click", function () {
        selecionadas.clear();
        atualizarIndicadores();
        renderizarTorres();
    });
    btnAplicar?.addEventListener("click", function () {
        window.dispatchEvent(new CustomEvent("torresFiltradas", {
            detail: Array.from(selecionadas)
        }));
        fecharModal();
    });
    seletorMineradora?.addEventListener("change", carregarTorresDisponiveis);

    atualizarIndicadores();
});