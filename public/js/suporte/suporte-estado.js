// Estado compartilhado do dashboard: um só objeto no lugar de variáveis soltas.
const estado = {
  chamados: [],
  filtroSelecionado: "todos",
  responsavelSelecionado: "todos",
  graficoTendencia: null,
  graficoSla: null,
  graficoCapacidade: null,
  equipeDoGraficoCapacidade: [],
  quebrasSla: {},
  quebraSlaSelecionada: "prioridade",
  metaSla: 95,
  dadosSaoDemonstrativos: true,
  filtrosPreparados: false,
  quebrasSlaPreparadas: false,
};

// Os sinalizadores de "já preparei" permanecem: os eventos continuam registrados entre recarregamentos.
function reiniciarEstado() {
  estado.chamados = [];
  estado.quebrasSla = {};
  estado.equipeDoGraficoCapacidade = [];
  estado.filtroSelecionado = "todos";
  estado.responsavelSelecionado = "todos";
  estado.metaSla = 95;
}

export { estado, reiniciarEstado };
