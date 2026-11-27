const ESTADOS = {
  none: "Operacional",
  minor: "Instabilidade",
  major: "Indisponibilidade parcial",
  critical: "Indisponibilidade crítica",
  maintenance: "Em manutenção",
};
async function carregarStatusJira() {
  const indicador = document.getElementById("status_jira_indicador");

  try {
    const resposta = await fetch("/suporte/status-jira", { signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error("Status do Jira indisponível.");
    const dados = await resposta.json();
    const data = new Date(dados.consultadoEm);
    if (!Object.hasOwn(ESTADOS, dados.indicador) || !Array.isArray(dados.incidentes) || Number.isNaN(data.getTime())) {
      throw new Error("Resposta de status inválida.");
    }
    indicador.textContent = ESTADOS[dados.indicador];
    indicador.dataset.status = dados.indicador;
    indicador.title = "Status público geral do Jira Cloud. Consultado em " + data.toLocaleString("pt-BR");
  } catch {
    indicador.textContent = "Status indisponível";
    indicador.dataset.status = "indisponivel";
    indicador.title = "Não foi possível consultar o status público do Jira Cloud. Nova tentativa em cinco minutos.";
  }
}

function iniciarStatusJira() {
  carregarStatusJira();
  window.setInterval(carregarStatusJira, 5 * 60 * 1000);
}

export { carregarStatusJira, iniciarStatusJira };
