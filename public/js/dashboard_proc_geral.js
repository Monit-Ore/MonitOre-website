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

function formatarDataHoraBr(dataHoraIso) {
    if (!dataHoraIso) return "-";
    const d = new Date(dataHoraIso);
    if (Number.isNaN(d.getTime())) return String(dataHoraIso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarDuracaoAlerta(inicioIso, fimIso) {
    if (!inicioIso || !fimIso) return "período indisponível";
    const ini = new Date(inicioIso).getTime();
    const fim = new Date(fimIso).getTime();
    if (Number.isNaN(ini) || Number.isNaN(fim) || fim < ini) return "período indisponível";
    const diffMin = Math.max(1, Math.round((fim - ini) / 60000));
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
}

function renderizarProcessosAtencao(processos) {
    const container = document.getElementById("lista_processos_atencao");
    const elQtdOc = document.getElementById("qtdOcorrenciasAtencao");
    const elQtdPcs = document.getElementById("qtdPcsOcorrenciasAtencao");
    if (!container) return;

    const ativos = (Array.isArray(processos) ? processos : [])
        .filter(p => p && (p.nivel === "Crítico" || p.nivel === "Atenção"));

    const totalOcorrencias = ativos.reduce((acc, p) => acc + (Number(p.ocorrencias) || 0), 0);
    const pcsAfetadosTotal = ativos.reduce((acc, p) => acc + (Number(p.pcs_afetados) || 0), 0);
    if (elQtdOc) elQtdOc.textContent = totalOcorrencias;
    if (elQtdPcs) elQtdPcs.textContent = pcsAfetadosTotal;

    if (ativos.length === 0) {
        container.innerHTML = `<p class="estado_vazio_processos">Não há processos que precisam de atenção</p>`;
        return;
    }

    container.innerHTML = ativos.map((p, idx) => {
        const nivel = p.nivel === "Crítico" ? "critico" : "atencao";
        const num = String(idx + 1).padStart(2, "0");
        const torreNome = p.torre || p.codigo_torre || "Torre não identificada";
        const idTorre = p.id_torre;
        const torreLink = idTorre ? `<a href="dashboard-torre.html?idTorre=${encodeURIComponent(idTorre)}">${torreNome}</a>` : `<span>${torreNome}</span>`;
        const componente = p.componente || (Number(p.pico_cpu_pct) >= Number(p.pico_ram_pct) ? "CPU" : "RAM");
        const valorComp = p.valor_componente ?? (componente === "CPU" ? p.pico_cpu_pct : p.pico_ram_pct);
        const valorFmt = valorComp != null ? `${Number(valorComp).toFixed(0)}%` : "-";
        const pc = p.pc_industrial || "PC não identificado";
        const processo = p.processo || "processo";
        const ult = p.ultima_captura_torre || {};
        const cpuUlt = ult.cpu_pct != null ? `${Number(ult.cpu_pct).toFixed(0)}%` : "-";
        const ramUlt = ult.ram_pct != null ? `${Number(ult.ram_pct).toFixed(0)}%` : (ult.ram_mb != null ? `${Number(ult.ram_mb).toFixed(0)}MB` : "-");
        const ultimaStr = formatarDataHoraBr(ult.data_hora || p.ultima_ocorrencia);
        const duracao = formatarDuracaoAlerta(p.primeira_ocorrencia || p.ultima_ocorrencia, p.ultima_ocorrencia);
        const desde = formatarDataHoraBr(p.primeira_ocorrencia || p.ultima_ocorrencia);

        return `
            <div class="situacao">
                <div class="informacao">
                    <span class="num_podio ${nivel}">${num}</span>
                    <div class="info_situacao">
                        <h3>${torreLink} • ${componente} excedeu limite (${valorFmt})</h3>
                        <span class="detalhe-ocorrencia"><strong>${processo}</strong> no ${pc} • última captura ${ultimaStr}: CPU ${cpuUlt} / RAM ${ramUlt}</span>
                        <span class="periodo-ocorrencia">Alerta ativo há ${duracao} (desde ${desde} até ${formatarDataHoraBr(p.ultima_ocorrencia)})</span>
                    </div>
                </div>
            </div>`;
    }).join("");
}

async function visualizarProcessosEmAtencao() {
    try {
        const resposta = await fetch("/gold/processos_atencao.json", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (!resposta.ok) {
            throw new Error(`Não foi possível carregar processos_atencao.json (HTTP ${resposta.status})`);
        }
        const dados = await resposta.json();
        const lista = Array.isArray(dados.processos_que_exigem_atencao)
            ? dados.processos_que_exigem_atencao
            : [];
        renderizarProcessosAtencao(lista);
    } catch (erro) {
        console.error("#ERRO ao carregar processos que exigem atenção:", erro);
    }
}

async function visualizarProcessosMonitorados() {
    try {
        const resposta = await fetch("/gold/processos_atencao.json", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (!resposta.ok) {
            throw new Error(`Não foi possível carregar processos_atencao.json (HTTP ${resposta.status})`);
        }

        const dados = await resposta.json();
        const resumo = dados.resumo || {};
        const processos = Array.isArray(dados.processos) ? dados.processos : [];

        const totalMonitorados = Number(resumo.processos_monitorados) || 0;

        function normalizarNivel(nivel) {
            return String(nivel || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
        }

        const pesoPorNivel = { atencao: 1, critico: 2 };
        const nivelPorProcesso = new Map();

        processos.forEach(function (item) {
            const nomeProcesso = String(item.processo || "").trim().toLowerCase();
            if (!nomeProcesso) return;
            const peso = pesoPorNivel[normalizarNivel(item.nivel)] || 0;
            const pesoAtual = nivelPorProcesso.get(nomeProcesso) || 0;
            if (peso > pesoAtual) nivelPorProcesso.set(nomeProcesso, peso);
        });

        let criticos = 0;
        let atencao = 0;
        nivelPorProcesso.forEach(function (peso) {
            if (peso === 2) criticos++;
            else if (peso === 1) atencao++;
        });

        if (nivelPorProcesso.size === 0) {
            atencao = Number(resumo.processos_com_alertas) || 0;
        }

        const normais = Math.max(totalMonitorados - criticos - atencao, 0);

        const elTotal = document.getElementById("qtdProcessosMonitorados");
        const elCrit = document.getElementById("qtdProcessosCriticos");
        const elAtenc = document.getElementById("qtdProcessosAtencao");
        const elNorm = document.getElementById("qtdProcessosNormais");
        if (elTotal) {
            elTotal.textContent = totalMonitorados;
            const nivelClasse = criticos > 0 ? "nivel-critico" : (atencao > 0 ? "nivel-atencao" : "nivel-normal");
            elTotal.classList.remove("nivel-critico", "nivel-atencao", "nivel-normal");
            elTotal.classList.add(nivelClasse);
        }
        if (elCrit) elCrit.textContent = criticos;
        if (elAtenc) elAtenc.textContent = atencao;
        if (elNorm) elNorm.textContent = normais;
    } catch (erro) {
        console.error("#ERRO ao carregar KPI de processos:", erro);
    }
}

// KPI: PCs que exigem atenção (JSON gold gerado pelo tratamento_processos.py)
async function visualizarPcsQueExigemAtencao() {
    try {
        const resposta = await fetch("/gold/processos_atencao.json", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        if (!resposta.ok) {
            throw new Error(`Não foi possível carregar processos_atencao.json (HTTP ${resposta.status})`);
        }

        const dados = await resposta.json();
        const kpis = dados.kpis || {};
        const statusPcs = Array.isArray(dados.status_pcs) ? dados.status_pcs : [];

        const criticos = Number(kpis.pcs_criticos ?? statusPcs.filter(p => p.STATUS_PC === "Crítico").length) || 0;
        const atencao = Number(kpis.pcs_atencao ?? statusPcs.filter(p => p.STATUS_PC === "Atenção").length) || 0;
        const total = Number(kpis.pcs_que_exigem_atencao ?? (criticos + atencao)) || 0;

        const elTotal = document.getElementById("qtdPcsExigemAtencao");
        const elCrit = document.getElementById("qtdPcsCriticosKpi");
        const elAtenc = document.getElementById("qtdPcsAtencaoKpi");
        if (elTotal) {
            elTotal.textContent = total;
            const nivelClasse = criticos > 0 ? "nivel-critico" : (atencao > 0 ? "nivel-atencao" : "nivel-normal");
            elTotal.classList.remove("nivel-critico", "nivel-atencao", "nivel-normal");
            elTotal.classList.add(nivelClasse);
        }
        if (elCrit) elCrit.textContent = criticos;
        if (elAtenc) elAtenc.textContent = atencao;
    } catch (erro) {
        console.error("#ERRO ao carregar KPI de PCs que exigem atenção:", erro);
    }
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
    visualizarProcessosMonitorados();
    visualizarPcsQueExigemAtencao();
    visualizarProcessosEmAtencao();

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