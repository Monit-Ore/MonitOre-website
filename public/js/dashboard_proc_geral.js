var id = sessionStorage.getItem("ID_USUARIO");

var filtrosDashboard = {
    mineradora: "",
    torres: [],
    periodoHoras: 24,
};
var dadosProcessosCache = null;
var carregandoProcessos = null;

function obterMineradoraSelecionada() {
    const el = document.getElementById("selecao_mineradora");
    const valor = el ? el.value : "";
    return valor && valor !== "-" ? valor : "";
}

function obterPeriodoHoras() {
    const el = document.getElementById("selecao_periodo");
    const horas = Number(el ? el.value : 24);
    return Number.isFinite(horas) && horas > 0 ? horas : 24;
}

function dentroDoPeriodo(dataHoraIso, horas) {
    if (!dataHoraIso) return false;
    const t = new Date(dataHoraIso).getTime();
    if (Number.isNaN(t)) return false;
    const agora = Date.now();
    return t >= agora - horas * 60 * 60 * 1000 && t <= agora + 60 * 60 * 1000;
}

function filtrarProcessos(dados) {
    if (!dados) return { resumo: {}, processos: [], processos_que_exigem_atencao: [], status_pcs: [] };
    const mineradora = filtrosDashboard.mineradora;
    const torres = new Set((filtrosDashboard.torres || []).map(String));
    const horas = filtrosDashboard.periodoHoras;

    const filtrarItem = (item) => {
        const mineradoraItem = item.mineradora || item.MINERADORA;
        const idsMineradoras = item.ids_mineradoras_afetadas || item.IDS_MINERADORAS_AFETADAS;
        const nomesMineradoras = item.mineradoras_afetadas || item.MINERADORAS_AFETADAS;
        if (mineradora) {
            if (mineradoraItem) {
                if (String(mineradoraItem) !== mineradora) return false;
            } else if (Array.isArray(nomesMineradoras) && nomesMineradoras.length > 0) {
                if (!nomesMineradoras.map(String).includes(String(mineradora))) return false;
            } else if (Array.isArray(idsMineradoras) && idsMineradoras.length > 0) {
                // idsMineradoras contém IDs; filtro por nome não consegue validar - não descartar para evitar falso negativo.
            } else {
                return false;
            }
        }
        const idTorre = item.id_torre ?? item.ID_TORRE;
        const idsTorres = item.ids_torres_afetadas || item.IDS_TORRES_AFETADAS;
        if (torres.size > 0) {
            if (idTorre != null && String(idTorre) !== "") {
                if (!torres.has(String(idTorre))) return false;
            } else if (Array.isArray(idsTorres) && idsTorres.length > 0) {
                const temIntersecao = idsTorres.some(id => torres.has(String(id)));
                if (!temIntersecao) return false;
            }
        }
        const dh = item.ultima_ocorrencia || item.DATA_HORA_ULTIMA_CAPTURA || item.data_hora || (item.ultima_captura_torre && item.ultima_captura_torre.data_hora);
        if (dh && !dentroDoPeriodo(dh, horas)) return false;
        return true;
    };

    const processos = (dados.processos || []).filter(filtrarItem);
    const atencao = (dados.processos_que_exigem_atencao || []).filter(filtrarItem);
    const statusPcs = (dados.status_pcs || []).filter(filtrarItem);
    const temContextoProcesso = (dados.processos || []).some(p => p.mineradora || p.MINERADORA || p.id_torre != null || p.ID_TORRE != null);
    const usarResumoGeral = !mineradora && torres.size === 0 && !temContextoProcesso
        && Array.isArray(dados.processos) && dados.processos.length > 0
        && processos.length === dados.processos.length;

    function normNivel(n) {
        return String(n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }
    const peso = { atencao: 1, critico: 2 };
    const porNome = new Map();
    processos.forEach(p => {
        const nome = String(p.processo || "").trim().toLowerCase();
        if (!nome) return;
        const n = peso[normNivel(p.nivel)] || 0;
        if (n > (porNome.get(nome) || 0)) porNome.set(nome, n);
    });
    let criticos = 0, atenc = 0, normaisCount = 0;
    porNome.forEach(v => {
        if (v === 2) criticos++;
        else if (v === 1) atenc++;
        else normaisCount++;
    });
    let totalMonitorados = porNome.size;
    let normais = normaisCount;
    if (usarResumoGeral) {
        const r = dados.resumo || {};
        totalMonitorados = Number(r.processos_monitorados) || totalMonitorados;
        criticos = Number(r.criticos) || criticos;
        atenc = Number(r.atencao) || atenc;
        normais = Number(r.normais) || Math.max(totalMonitorados - criticos - atenc, 0);
    }

    const pcNivel = new Map();
    atencao.forEach(p => {
        const idPc = p.id_pc_industrial ?? p.ID_PC_INDUSTRIAL ?? p.pc_industrial ?? p.PC_INDUSTRIAL;
        if (idPc == null || String(idPc).trim() === "") return;
        const key = String(idPc).trim();
        const n = normNivel(p.nivel);
        const w = peso[n] || 0;
        if (w > (pcNivel.get(key) || 0)) pcNivel.set(key, w);
    });
    let pcsCrit = 0, pcsAtenc = 0;
    pcNivel.forEach(w => { if (w === 2) pcsCrit++; else if (w === 1) pcsAtenc++; });
    const pcsQueExigem = pcNivel.size;

    return {
        resumo: {
            processos_monitorados: totalMonitorados,
            processos_com_alertas: criticos + atenc,
            criticos,
            atencao: atenc,
            normais,
        },
        kpis: {
            pcs_criticos: pcsCrit,
            pcs_atencao: pcsAtenc,
            pcs_que_exigem_atencao: pcsQueExigem,
            total_pcs_monitorados: statusPcs.length,
        },
        processos,
        processos_que_exigem_atencao: atencao,
        status_pcs: statusPcs,
    };
}

function aplicarFiltrosDashboard() {
    filtrosDashboard.mineradora = obterMineradoraSelecionada();
    filtrosDashboard.periodoHoras = obterPeriodoHoras();
    try {
        const salvas = JSON.parse(sessionStorage.getItem("ID_TORRES_SELECIONADAS") || "[]");
        filtrosDashboard.torres = Array.isArray(salvas) ? salvas : [];
    } catch { filtrosDashboard.torres = []; }

    visualizarQtdTorreAtivas(filtrosDashboard.mineradora);

    if (dadosProcessosCache) {
        const filtrado = filtrarProcessos(dadosProcessosCache);
        renderizarKpiProcessos(filtrado);
        renderizarKpiPcsAtencao(filtrado);
        renderizarProcessosAtencao(filtrado.processos_que_exigem_atencao);
    } else {
        carregarDadosProcessos();
    }
}

async function visualizarQtdTorreAtivas(mineradora) {
    try {
        const banco = await dashboardProcessosService.qtdTorresAtivas(id, mineradora);
        console.log("Dados recebidos com sucesso");

        var qtdTotal = banco.qtdTotalTorres;
        var qtdAtiva = banco.torres_online;
        var qtdTotalAtiva = banco.torres_online;

        document.getElementById("qtdAtiva").innerHTML = qtdAtiva;
        document.getElementById("qtdTorres").innerHTML = qtdTotal;
        document.getElementById("qtdTotalAtiva").innerHTML = qtdTotalAtiva;
    } catch (erro) {
        console.error("#ERRO ao carregar quantidade de torres ativas:", erro);
    }
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
    if (dadosProcessosCache) { renderizarProcessosAtencao(filtrarProcessos(dadosProcessosCache).processos_que_exigem_atencao); return; }
    await carregarDadosProcessos();
}

function renderizarKpiProcessos(dados) {
    const resumo = dados.resumo || {};
    const totalMonitorados = Number(resumo.processos_monitorados) || 0;
    const criticos = Number(resumo.criticos) || 0;
    const atencao = Number(resumo.atencao) || 0;
    const normais = Number(resumo.normais) || 0;

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
}

function renderizarKpiPcsAtencao(dados) {
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
}

async function carregarDadosProcessos() {
    if (carregandoProcessos) return carregandoProcessos;

    carregandoProcessos = dashboardProcessosService.carregarProcessos()
        .then(function (dados) {
            dadosProcessosCache = dados;
            aplicarFiltrosDashboard();
        })
        .catch(function (erro) {
            console.error("#ERRO ao carregar dados de processos:", erro);
        })
        .finally(function () {
            carregandoProcessos = null;
        });

    return carregandoProcessos;
}

async function visualizarProcessosMonitorados() { 
    await carregarDadosProcessos(); 
}

async function visualizarPcsQueExigemAtencao() {
    if (dadosProcessosCache) { renderizarKpiPcsAtencao(filtrarProcessos(dadosProcessosCache)); return; }
    await carregarDadosProcessos();
}

async function visualizarMineradorasDoUsuario() {
    try {
        const banco = await dashboardProcessosService.listarMineradoras(id);
        console.log("Dados recebidos com sucesso");
        let selecionarMineradora = `<option value="-">Mineradora: Todos</option>`;

        for (let i = 0; i < banco.length; i++) {
            let mineradora = banco[i].Mineradoras;
            selecionarMineradora += `
                <option value="${mineradora}">${mineradora}</option>
            `;
        }

        const selectMineradora = document.getElementById("selecao_mineradora");
        selectMineradora.innerHTML = selecionarMineradora;
        selectMineradora.addEventListener("change", function (evento) {
            visualizarQtdTorreAtivas(evento.target.value);
        });
    } catch (erro) {
        console.error("#ERRO ao carregar mineradoras:", erro);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    visualizarMineradorasDoUsuario();

    const modalRelatorio = document.getElementById("modalRelatorio");
    const abrirModalRelatorio = document.getElementById("abrirModalRelatorio");
    const fecharModalRelatorio = document.getElementById("fecharModalRelatorio");
    const cancelarRelatorio = document.getElementById("cancelarRelatorio");

    function abrirRelatorio() { if (modalRelatorio) modalRelatorio.showModal(); }
    function fecharRelatorio() { if (modalRelatorio && modalRelatorio.open) modalRelatorio.close(); }

    abrirModalRelatorio?.addEventListener("click", abrirRelatorio);
    fecharModalRelatorio?.addEventListener("click", fecharRelatorio);
    cancelarRelatorio?.addEventListener("click", fecharRelatorio);
    modalRelatorio?.addEventListener("click", function (evento) {
        if (evento.target === modalRelatorio) fecharRelatorio();
    });
    aplicarFiltrosDashboard();
    carregarDadosProcessos();

    const modal = document.getElementById("meuModal");
    const btnAbrir = document.getElementById("abrirModal");
    const btnFechar = document.getElementById("fecharModal");
    const seletorMineradora = document.getElementById("selecao_mineradora");
    const seletorPeriodo = document.getElementById("selecao_periodo");
    seletorPeriodo?.addEventListener("change", aplicarFiltrosDashboard);

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
            btnAbrir.textContent = total === 0
                ? "Filtragem de Torre (Todas)"
                : `Filtragem de Torre (${total})`;
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

        try {
            const dados = await dashboardProcessosService.listarTorresDisponiveis(id, mineradora);
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
        const total = selecionadas.size;
        if (total === 1) {
            alert("Selecione pelo menos 2 torres, ou deixe nenhuma selecionada para considerar todas.");
            return;
        }
        window.dispatchEvent(new CustomEvent("torresFiltradas", {
            detail: Array.from(selecionadas)
        }));
        aplicarFiltrosDashboard();
        fecharModal();
    });
    seletorMineradora?.addEventListener("change", function () {
        selecionadas.clear();
        salvarSelecao();
        atualizarIndicadores();
        carregarTorresDisponiveis();
        aplicarFiltrosDashboard();
    });

    atualizarIndicadores();
});