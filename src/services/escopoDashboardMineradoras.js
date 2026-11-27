// Agregados globais só podem ser reutilizados quando todas as torres da
// mineradora estão autorizadas. Com acesso parcial, reconstruímos a saúde
// pelas torres permitidas e omitimos métricas que não têm granularidade segura.
function filtrarDashboard(dashboard, alertasDiarios, acessos) {
  const idsTorres = new Set(acessos.map((torre) => String(torre.id_torre)));
  const grupos = new Map();
  for (const torre of acessos) {
    const id = String(torre.id_mineradora);
    if (!grupos.has(id)) grupos.set(id, new Map());
    grupos.get(id).set(String(torre.id_torre), torre);
  }
  const permitida = (item) => idsTorres.has(String(item.ID_TORRE));
  const statusTorres = (dashboard.status_torres || []).filter(permitida);
  const completas = new Set();
  const mineradoras = [];
  const prioridade = { "Desconhecido": 0, "Normal": 1, "Atenção": 2, "Crítico": 3 };

  for (const [id, torres] of grupos) {
    const original = (dashboard.mineradoras || []).find((item) => String(item.ID_MINERADORA) === id);
    const detalhes = (dashboard.status_torres || []).filter((item) => String(item.ID_MINERADORA) === id);
    if (original && Number(original.TOTAL_TORRES) === torres.size &&
        detalhes.every(permitida)) {
      completas.add(id);
      mineradoras.push(original);
      continue;
    }
    const estados = [...torres.keys()].map((idTorre) => {
      const status = statusTorres.find((item) => String(item.ID_TORRE) === idTorre);
      return status && Object.hasOwn(prioridade, status.STATUS_TORRE)
        ? status.STATUS_TORRE : "Desconhecido";
    });
    const contar = (estado) => estados.filter((item) => item === estado).length;
    mineradoras.push({
      ID_MINERADORA: [...torres.values()][0].id_mineradora,
      MINERADORA: [...torres.values()][0].mineradora_nome,
      TOTAL_TORRES: torres.size,
      TORRES_DESCONHECIDAS: contar("Desconhecido"),
      TORRES_NORMAIS: contar("Normal"),
      TORRES_ATENCAO: contar("Atenção"),
      TORRES_CRITICAS: contar("Crítico"),
      ESTADO: estados.reduce((pior, estado) => prioridade[estado] > prioridade[pior] ? estado : pior, "Desconhecido"),
      ALERTAS_HOJE: null,
      ALERTAS_ONTEM: null,
      VARIACAO_ALERTAS: null,
    });
  }

  const parcial = completas.size < grupos.size;
  const somar = (campo) => mineradoras.reduce((total, item) => total + Number(item[campo] || 0), 0);
  return {
    dashboard: {
      atualizado_em: dashboard.atualizado_em || null,
      mineradoras,
      status_torres: statusTorres,
      status_pcs: (dashboard.status_pcs || []).filter(permitida),
      processos_destaque: (dashboard.processos_destaque || []).filter(permitida),
      kpis: {
        TOTAL_MINERADORAS_MONITORADAS: mineradoras.length,
        TOTAL_TORRES_MONITORADAS: somar("TOTAL_TORRES"),
        TORRES_ATENCAO: somar("TORRES_ATENCAO"),
        TORRES_CRITICAS: somar("TORRES_CRITICAS"),
        ALERTAS_HOJE: parcial ? null : somar("ALERTAS_HOJE"),
        ALERTAS_ONTEM: parcial ? null : somar("ALERTAS_ONTEM"),
      },
    },
    alertasDiarios: alertasDiarios.filter((item) => completas.has(String(item.ID_MINERADORA))),
    mineradorasGrafico: mineradoras.filter((item) => completas.has(String(item.ID_MINERADORA))),
    mensagem: parcial
      ? "Exibindo somente suas torres autorizadas. Indicadores de alertas e o gráfico incluem apenas mineradoras com acesso completo; métricas sem detalhamento por torre aparecem como —."
      : "",
  };
}

module.exports = { filtrarDashboard };
