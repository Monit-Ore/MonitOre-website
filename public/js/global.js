function ativarMenu(idAtivo) {
  document.querySelectorAll(".menu_navegacao .item_menu").forEach((item) => {
    item.classList.toggle("ativo", item.id === idAtivo);
  });
}

function ativarTorres() {
  ativarMenu("torres");
}

function ativarUsuarios() {
  ativarMenu("usuarios");
}

function ativarCargos() {
  ativarMenu("cargos");
}

function ativarAlertas() {
  ativarMenu("alertas");
}

function ativarManual() {
  ativarMenu("manual");
}

function ativarPerfil() {
  ativarMenu("perfil");
}

function carregarUsuarioMenu() {
  const nomeUsuario = sessionStorage.getItem("NOME_USUARIO");
  if (!nomeUsuario) {
    return;
  }
  nome_usuario.textContent = nomeUsuario;

  const cargoUsuario = sessionStorage.getItem("CARGO_USUARIO");
  if (!cargoUsuario) {
    return;
  }
  cargo_usuario.textContent = cargoUsuario;
}

function voltar() {
  window.history.back();
}

function tituloMetrica(nomeComponente) {
  const rotulos = {
    CPU: "Porcentagem CPU",
    RAM: "Uso da Memória RAM",
    Disco: "Disponibilidade do Disco",
  };
  return rotulos[nomeComponente] || nomeComponente;
}

/* Acionador de perfil isolado: cadastro.js redefine ativarPerfil() com IDs
   que não existem nas telas de perfil. Este nome não é sobrescrito. */
function ativarPerfilSeguro() {
  if (window.MonitoreSidebar && typeof window.MonitoreSidebar.ativarPerfil === "function") {
    window.MonitoreSidebar.ativarPerfil();
  }
}

/* Controlador único da barra lateral.
   Desktop (>900px): abre ao passar o mouse ou navegar pelo teclado.
   Mobile (<=900px): drawer original, controlado por `body.menu-aberto`. */
(function () {
  var CONSULTA_DESKTOP = "(width > 900px)";
  var ID_TOOLTIP = "monitore-tooltip";
  var raiz = document.documentElement;
  var Estado = { COLLAPSED: "collapsed", EXPANDED: "expanded" };
  var estado = Estado.COLLAPSED;
  var drawerAberto = false;
  var navegacao = null;
  var timerRecolher = null;
  var container = null;
  var botoes = [];
  var itensLaterais = [];
  var ajustesDesktop = [];
  var titulosDefinidos = [];
  var tooltip = null;
  var tooltipsConfigurados = false;
  var tooltipItem = null;
  var timerTooltip = null;
  var tooltipSuprimido = false;
  var timerMenu = null;
  var aoFimDaTransicao = null;

  function ehDesktop() {
    return !!(window.matchMedia && window.matchMedia(CONSULTA_DESKTOP).matches);
  }

  function reduzMovimento() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function atualizarExpansaoDesktop() {
    if (timerRecolher !== null) {
      window.clearTimeout(timerRecolher);
      timerRecolher = null;
    }
    if (!ehDesktop() || !navegacao) return;
    var foco = document.activeElement;
    var tecladoNoMenu = foco && navegacao.contains(foco) && foco.matches(":focus-visible");
    var novoEstado = navegacao.matches(":hover") || tecladoNoMenu
      ? Estado.EXPANDED : Estado.COLLAPSED;
    function aplicar() {
      timerRecolher = null;
      if (!ehDesktop() || estado === novoEstado) return;
      estado = novoEstado;
      esconderTooltip();
      sincronizarDesktop();
      agendarResize();
    }
    if (novoEstado === Estado.COLLAPSED) {
      timerRecolher = window.setTimeout(aplicar, 150);
    } else {
      aplicar();
    }
  }

  function registrarAjuste(registro) {
    ajustesDesktop.push(registro);
  }

  function textoDoItem(item) {
    if (item.dataset.monitoreRotulo) {
      return item.dataset.monitoreRotulo;
    }
    let texto = (item.textContent || "").replace(/\s+/g, " ").trim();
    item.dataset.monitoreRotulo = texto;
    registrarAjuste({ tipo: "atributo", alvo: item, nome: "data-monitore-rotulo" });
    return texto;
  }

  function prepararItensDesktop() {
    if (ajustesDesktop.length) return;

    itensLaterais.forEach(function (item) {
      var rotulo = textoDoItem(item);
      if (rotulo && !item.getAttribute("aria-label")) {
        item.setAttribute("aria-label", rotulo);
        registrarAjuste({ tipo: "atributo", alvo: item, nome: "aria-label" });
      }

      if (item.classList.contains("usuario_navegacao") && !item.querySelector(".icone_perfil_recolhido")) {
        var icone = document.createElement("span");
        icone.className = "icone_perfil_recolhido";
        icone.setAttribute("aria-hidden", "true");
        icone.innerHTML = `<i class="fa-solid fa-user"></i>`;
        item.insertBefore(icone, item.children[1] || null);
        registrarAjuste({ tipo: "no", alvo: item, no: icone });
      }

      if (item.classList.contains("usuario_navegacao") && !item.getAttribute("aria-label")) {
        var nome = document.getElementById("nome_usuario");
        var nomePerfil = (nome && nome.textContent || "").trim();
        item.setAttribute(
          "aria-label",
          nomePerfil && nomePerfil !== "Carregando..." ? "Perfil de " + nomePerfil : "Abrir meu perfil"
        );
        registrarAjuste({ tipo: "atributo", alvo: item, nome: "aria-label" });
      }
    });
  }

  function removerAjustesDesktop() {
    ajustesDesktop.forEach(function (ajuste) {
      if (ajuste.tipo === "no") {
        if (ajuste.no.parentNode === ajuste.alvo) ajuste.alvo.removeChild(ajuste.no);
      } else {
        ajuste.alvo.removeAttribute(ajuste.nome);
      }
    });
    ajustesDesktop = [];
    titulosDefinidos.forEach(function (item) {
      item.removeAttribute("title");
    });
    titulosDefinidos = [];
    if (tooltip) {
      cancelarOcultarTooltip();
      tooltip.hidden = true;
      tooltipItem = null;
      tooltipSuprimido = false;
      itensLaterais.forEach(function (item) {
        item.removeAttribute("aria-describedby");
      });
    }
  }

  function sincronizarBotoes(rotulo, expandido) {
    botoes.forEach(function (botao) {
      botao.setAttribute("aria-expanded", expandido ? "true" : "false");
      botao.setAttribute("aria-label", rotulo);
      botao.setAttribute("title", rotulo);
    });
  }

  function sincronizarDesktop() {
    raiz.dataset.sidebar = estado;
    if (document.body) document.body.classList.remove("menu-aberto");

    var rotulo = estado === Estado.COLLAPSED
      ? "Expandir menu lateral"
      : "Recolher menu lateral";
    sincronizarBotoes(rotulo, estado === Estado.EXPANDED);

    itensLaterais.forEach(function (item) {
      if (estado === Estado.COLLAPSED) {
        var rotuloItem = item.getAttribute("aria-label") || textoDoItem(item);
        if (rotuloItem) {
          item.setAttribute("title", rotuloItem);
          if (titulosDefinidos.indexOf(item) === -1) titulosDefinidos.push(item);
        }
      } else {
        item.removeAttribute("title");
      }
    });
  }

  function sincronizarMobile() {
    delete raiz.dataset.sidebar;
    if (document.body) document.body.classList.toggle("menu-aberto", drawerAberto);
    sincronizarBotoes(
      drawerAberto ? "Fechar menu" : "Abrir menu",
      drawerAberto
    );
  }

  function garantirTooltip() {
    if (tooltip || !document.body || !document.getElementById) return tooltip;
    tooltip = document.getElementById(ID_TOOLTIP);
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = ID_TOOLTIP;
      tooltip.setAttribute("role", "tooltip");
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function cancelarOcultarTooltip() {
    if (timerTooltip !== null && window.clearTimeout) {
      window.clearTimeout(timerTooltip);
      timerTooltip = null;
    }
  }

  function esconderTooltip(item) {
    cancelarOcultarTooltip();
    if (!tooltip) return;
    tooltip.hidden = true;
    var alvo = item || tooltipItem;
    if (alvo) alvo.removeAttribute("aria-describedby");
    tooltipItem = null;
  }

  function agendarOcultarTooltip() {
    cancelarOcultarTooltip();
    timerTooltip = window.setTimeout(function () {
      timerTooltip = null;
      esconderTooltip();
    }, 140);
  }

  function liberarSupressaoTooltip() {
    tooltipSuprimido = false;
  }

  function mostrarTooltip(item) {
    if (tooltipSuprimido || !ehDesktop() || estado !== Estado.COLLAPSED || !garantirTooltip()) return;
    var texto = item.getAttribute("aria-label") || textoDoItem(item);
    if (!texto) return;

    cancelarOcultarTooltip();
    if (tooltipItem && tooltipItem !== item) tooltipItem.removeAttribute("aria-describedby");
    tooltipItem = item;
    tooltip.textContent = texto;
    tooltip.hidden = false;
    var itemRect = item.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var x = Math.min(itemRect.right + 10, window.innerWidth - tipRect.width - 8);
    var y = itemRect.top + itemRect.height / 2 - tipRect.height / 2;
    y = Math.max(8, Math.min(y, window.innerHeight - tipRect.height - 8));
    tooltip.style.left = Math.max(8, x) + "px";
    tooltip.style.top = y + "px";
    item.setAttribute("aria-describedby", ID_TOOLTIP);
  }

  function configurarTooltips() {
    if (tooltipsConfigurados || !garantirTooltip()) return;
    tooltipsConfigurados = true;
    itensLaterais.forEach(function (item) {
      item.addEventListener("mouseenter", function () { mostrarTooltip(item); });
      item.addEventListener("mouseleave", function (evento) {
        liberarSupressaoTooltip();
        if (document.activeElement === item) return;
        if (evento.relatedTarget !== tooltip) agendarOcultarTooltip();
      });
      item.addEventListener("focus", function () { mostrarTooltip(item); });
      item.addEventListener("blur", function (evento) {
        if (evento.relatedTarget === tooltip) return;
        if (item.matches(":hover") || tooltip.matches(":hover")) return;
        agendarOcultarTooltip();
      });
    });

    tooltip.addEventListener("mouseenter", cancelarOcultarTooltip);
    tooltip.addEventListener("mouseleave", function (evento) {
      if (evento.relatedTarget && tooltipItem && tooltipItem.contains(evento.relatedTarget)) return;
      if (tooltipItem && (document.activeElement === tooltipItem || tooltipItem.matches(":hover"))) return;
      agendarOcultarTooltip();
    });

    document.addEventListener("mousedown", liberarSupressaoTooltip, true);
    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape") {
        if (tooltip && !tooltip.hidden) {
          evento.preventDefault();
          esconderTooltip();
          tooltipSuprimido = true;
        }
        return;
      }
      liberarSupressaoTooltip();
    }, true);
  }

  function cancelarResize() {
    if (window.clearTimeout && timerMenu !== null) {
      window.clearTimeout(timerMenu);
      timerMenu = null;
    }
    if (aoFimDaTransicao && container) {
      container.removeEventListener("transitionend", aoFimDaTransicao);
      aoFimDaTransicao = null;
    }
  }

  function redimensionarGraficos() {
    var Chart = window.Chart;
    if (!Chart || !Chart.instances) return;
    Object.keys(Chart.instances).forEach(function (id) {
      var grafico = Chart.instances[id];
      if (grafico && typeof grafico.resize === "function") {
        grafico.resize();
      }
    });
  }

  function agendarResize() {
    cancelarResize();
    container = document.querySelector(".container_responsivo") || document.body;
    if (!container) return;

    var concluido = false;
    function finalizar() {
      if (concluido) return;
      concluido = true;
      cancelarResize();
      redimensionarGraficos();
    }

    aoFimDaTransicao = function (evento) {
      if (evento.target !== container) return;
      if (evento.propertyName && !/grid-template-columns|width/.test(evento.propertyName)) return;
      finalizar();
    };
    container.addEventListener("transitionend", aoFimDaTransicao);
    timerMenu = window.setTimeout(finalizar, reduzMovimento() ? 0 : 340);
  }

  function alternar() {
    if (ehDesktop()) return;

    drawerAberto = !drawerAberto;
    sincronizarMobile();
  }

  function marcarPerfilAtivo() {
    document.querySelectorAll(".menu_navegacao .item_menu").forEach(function (item) {
      item.classList.remove("ativo");
    });
    var alvo = document.querySelector("#perfil .usuario_navegacao") ||
      document.getElementById("perfil") ||
      document.getElementById("usuario_logado");
    if (alvo) alvo.classList.add("ativo");
  }

  function aoMudarBreakpoint() {
    cancelarResize();
    if (timerRecolher !== null) window.clearTimeout(timerRecolher);
    timerRecolher = null;
    if (ehDesktop()) {
      drawerAberto = false;
      if (document.body) document.body.classList.remove("menu-aberto");
      estado = Estado.COLLAPSED;
      prepararItensDesktop();
      sincronizarDesktop();
      configurarTooltips();
      atualizarExpansaoDesktop();
    } else {
      esconderTooltip();
      removerAjustesDesktop();
      drawerAberto = false;
      sincronizarMobile();
    }
  }

  function iniciar() {
    container = document.querySelector(".container_responsivo") || document.body;
    navegacao = document.querySelector(".navegacao");
    botoes = Array.prototype.slice.call(document.querySelectorAll("[data-menu-toggle]"));
    // Os cabeçalhos locais têm layouts distintos: a alternância ocupa sempre
    // a primeira faixa do conteúdo, fora das linhas de título e filtros.
    var conteudo = document.querySelector(".container_responsivo > main, .container_responsivo > .conteudo_layout");
    if (conteudo && botoes.length) {
      conteudo.classList.add("conteudo_com_controle_sidebar");
      var barra = document.createElement("div");
      barra.className = "barra_controle_sidebar";
      barra.appendChild(botoes[0]);
      conteudo.insertBefore(barra, conteudo.firstChild);
      botoes.slice(1).forEach(function (botao) { botao.remove(); });
      botoes = [botoes[0]];
    }
    itensLaterais = Array.prototype.slice.call(
      document.querySelectorAll(
        ".navegacao .item_menu, .navegacao .usuario_navegacao, .navegacao .botao_sair"
      )
    );
    drawerAberto = !!(document.body && document.body.classList.contains("menu-aberto"));

    if (ehDesktop()) {
      estado = Estado.COLLAPSED;
      prepararItensDesktop();
      sincronizarDesktop();
      configurarTooltips();
      atualizarExpansaoDesktop();
    } else {
      removerAjustesDesktop();
      sincronizarMobile();
    }

    botoes.forEach(function (botao) {
      botao.addEventListener("click", alternar);
    });

    if (navegacao) {
      ["mouseenter", "mouseleave", "focusin"].forEach(function (evento) {
        navegacao.addEventListener(evento, atualizarExpansaoDesktop);
      });
      navegacao.addEventListener("focusout", function () {
        queueMicrotask(atualizarExpansaoDesktop);
      });
    }

    // Preserva o fechamento por Escape e clique externo também nas telas
    // que passaram a usar o controlador compartilhado.
    document.addEventListener("keydown", function (evento) {
      if (evento.key !== "Escape" || ehDesktop() || !drawerAberto) return;
      drawerAberto = false;
      sincronizarMobile();
      if (botoes[0]) botoes[0].focus();
    });
    document.addEventListener("click", function (evento) {
      if (ehDesktop() || !drawerAberto) return;
      var navegacao = document.querySelector(".navegacao");
      if (navegacao && navegacao.contains(evento.target)) return;
      if (botoes.some(function (botao) { return botao.contains(evento.target); })) return;
      drawerAberto = false;
      sincronizarMobile();
    });

    if (window.matchMedia) {
      var consulta = window.matchMedia(CONSULTA_DESKTOP);
      if (typeof consulta.addEventListener === "function") {
        consulta.addEventListener("change", aoMudarBreakpoint);
      } else if (typeof consulta.addListener === "function") {
        consulta.addListener(aoMudarBreakpoint);
      }
    }
  }

  window.MonitoreSidebar = { ativarPerfil: marcarPerfilAtivo };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
