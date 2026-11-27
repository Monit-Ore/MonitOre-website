const ENDPOINT = "https://jira-software.status.atlassian.com/api/v2/summary.json";
const TEMPO_CACHE = 5 * 60 * 1000;
const INDICADORES = new Set(["none", "minor", "major", "critical", "maintenance"]);

let cache;
let expiraEm = 0;
let consultaEmAndamento;

async function consultar() {
  const resposta = await fetch(ENDPOINT, { signal: AbortSignal.timeout(5000) });
  if (!resposta.ok) throw new Error("Falha HTTP ao consultar Jira: " + resposta.status);
  const dados = await resposta.json();
  if (!INDICADORES.has(dados?.status?.indicator) || !Array.isArray(dados.incidents)) {
    throw new Error("Resposta de status do Jira inválida.");
  }
  const incidentes = dados.incidents
    .filter((incidente) => !["resolved", "postmortem"].includes(incidente?.status))
    .map((incidente) => {
      if (typeof incidente?.name !== "string" || typeof incidente.status !== "string") {
        throw new Error("Incidente do Jira inválido.");
      }
      return { nome: incidente.name, status: incidente.status };
    });
  const agora = Date.now();
  cache = { indicador: dados.status.indicator, incidentes, consultadoEm: new Date(agora).toISOString() };
  expiraEm = agora + TEMPO_CACHE;
  return cache;
}

async function buscarStatusJira() {
  if (cache && Date.now() < expiraEm) return cache;
  if (!consultaEmAndamento) {
    consultaEmAndamento = consultar().finally(() => { consultaEmAndamento = undefined; });
  }
  return consultaEmAndamento;
}

module.exports = { buscarStatusJira };
