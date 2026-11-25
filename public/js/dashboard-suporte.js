// Ponto de entrada: prepara a tela, busca a captura e entrega cada parte ao módulo responsável.
import { estado, reiniciarEstado } from "./suporte-estado.js";
import { buscarCaptura } from "./suporte-api.js";
import {
  definirAvisoDemonstrativo,
  atualizarDescricaoChamados,
  mostrarErroDashboard,
  mostrarIndicadores,
  prepararQuebrasSla,
} from "./suporte-indicadores.js";
import { destruirGraficos, criarGraficos } from "./suporte-graficos.js";
import { prepararFiltros, mostrarChamados } from "./suporte-tabela.js";

function prepararEstadoCarregamento() {
  destruirGraficos();
  reiniciarEstado();

  document.getElementById("data_atualizacao").textContent = "Carregando...";
  document.getElementById("texto_aviso_sla").textContent = "Carregando chamados que precisam de atenção...";
  document.getElementById("tabela_chamados").innerHTML = '<tr><td colspan="7">Carregando dados...</td></tr>';
  document.getElementById("rodape_tabela").textContent = "";
  document.getElementById("lista_quebras_sla").innerHTML = "";
  document.getElementById("filtro_responsavel").innerHTML = '<option value="todos">Todos</option>';
  document.getElementById("busca_chamado").value = "";

  document.querySelectorAll(".filtros_tabela [data-filtro]").forEach((item) => {
    item.classList.toggle("filtro_ativo", item.dataset.filtro === "todos");
  });
}

async function carregarDashboardSuporte() {
  prepararEstadoCarregamento();

  try {
    const envelope = await buscarCaptura();
    const dados = envelope.captura || envelope;
    const historico = envelope.historico || {};

    estado.dadosSaoDemonstrativos = dados.metadados.dados_demonstrativos !== false;
    estado.chamados = dados.chamados_que_precisam_de_atencao || [];

    definirAvisoDemonstrativo();
    atualizarDescricaoChamados();
    mostrarIndicadores(dados, historico);
    prepararQuebrasSla(dados.quebras_sla);
    criarGraficos(dados);
    prepararFiltros(dados.capacidade_da_equipe);
    mostrarChamados();
  } catch (erro) {
    console.error(erro);
    mostrarErroDashboard(erro);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const nome = sessionStorage.getItem("NOME_USUARIO");
  const cargo = sessionStorage.getItem("CARGO_USUARIO");

  if (nome) {
    document.getElementById("nome_usuario").textContent = nome;
    document.getElementById("avatar_usuario").textContent =
      nome.split(" ").map((parte) => parte[0]).slice(0, 2).join("").toUpperCase();
  }
  if (cargo) document.getElementById("cargo_usuario").textContent = cargo;

  document.getElementById("botao_sair").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "./login.html";
  });

  document.querySelector(".btn-notificacao").addEventListener("click", () => {
    document.body.classList.toggle("menu-aberto");
  });

  carregarDashboardSuporte();
});
