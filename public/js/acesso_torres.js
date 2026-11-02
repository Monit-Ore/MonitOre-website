var torresDisponiveis = [];
var torresSelecionadas = [];
var acessosTorresCarregados = false;

function carregarAcessosTorres() {
  var lista = document.getElementById("lista_mineradoras");
  if (!lista) return;

  fetch("/usuarios/torres")
    .then(function (resposta) {
      if (!resposta.ok) throw new Error("Não foi possível carregar as torres.");
      return resposta.json();
    })
    .then(function (dados) {
      torresDisponiveis = Array.isArray(dados) ? dados : [];
      acessosTorresCarregados = true;
      renderizarMineradoras();
    })
    .catch(function (erro) {
      lista.innerHTML = "<p>Erro ao carregar mineradoras e torres.</p>";
      var mensagem = document.getElementById("mensagem_acesso");
      mensagem.textContent = erro.message;
      mensagem.style.color = "#ff6b6b";
    });
}

function obterTorresSelecionadas() {
  if (!acessosTorresCarregados) {
    throw new Error("Aguarde o carregamento das torres antes de cadastrar o usuário.");
  }
  return torresSelecionadas.slice();
}

function escaparHTML(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderizarMineradoras() {
  var lista = document.getElementById("lista_mineradoras");
  var mineradoras = [];

  torresDisponiveis.forEach(function (torre) {
    var idMineradora = Number(torre.id_mineradora);
    var mineradora = mineradoras.find(function (item) { return item.id === idMineradora; });
    if (!mineradora) {
      mineradora = { id: idMineradora, nome: torre.nome_mineradora, torres: [] };
      mineradoras.push(mineradora);
    }
    mineradora.torres.push(torre);
  });

  if (mineradoras.length === 0) {
    lista.innerHTML = "<p>Nenhuma mineradora ou torre cadastrada.</p>";
    return;
  }

  lista.innerHTML = mineradoras.map(function (mineradora) {
    var htmlTorres = mineradora.torres.map(function (torre) {
      var idTorre = Number(torre.id_torre);
      var selecionada = torresSelecionadas.includes(idTorre);
      return `<button type="button" class="botao_torre ${selecionada ? "selecionada" : ""}" aria-pressed="${selecionada}" onclick="alternarTorre(${idTorre})">${escaparHTML(torre.nome_torre)}</button>`;
    }).join("");

    return `<div class="item_mineradora">
      <div class="cabecalho_mineradora">
        <div class="nome_mineradora"><span class="icone_mineradora"><i class="fa-solid fa-mountain-sun"></i></span><span>${escaparHTML(mineradora.nome)}</span></div>
        <div class="torres_mineradora">${htmlTorres}<button type="button" class="selecionar_todas" onclick="alternarTodasTorres(${mineradora.id})">Selecionar todas</button></div>
      </div>
    </div>`;
  }).join("");
}

function alternarTorre(idTorre) {
  idTorre = Number(idTorre);
  var indice = torresSelecionadas.indexOf(idTorre);
  if (indice === -1) torresSelecionadas.push(idTorre);
  else torresSelecionadas.splice(indice, 1);
  renderizarMineradoras();
}

function alternarTodasTorres(idMineradora) {
  var torresDaMineradora = torresDisponiveis.filter(function (torre) {
    return Number(torre.id_mineradora) === Number(idMineradora);
  });
  var todasSelecionadas = torresDaMineradora.every(function (torre) {
    return torresSelecionadas.includes(Number(torre.id_torre));
  });

  torresDaMineradora.forEach(function (torre) {
    var idTorre = Number(torre.id_torre);
    var indice = torresSelecionadas.indexOf(idTorre);
    if (todasSelecionadas && indice !== -1) torresSelecionadas.splice(indice, 1);
    else if (!todasSelecionadas && indice === -1) torresSelecionadas.push(idTorre);
  });
  renderizarMineradoras();
}

document.addEventListener("DOMContentLoaded", carregarAcessosTorres);
