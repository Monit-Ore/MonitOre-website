/**
 * Serviço de Previsão Preditiva (Regressão Linear e Análise de Saturação)
 * MonitOre - Beeling (Isaac)
 */

const FORMATADOR_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

/**
 * Formata um objeto Date para "HH:mm" estritamente no fuso America/Sao_Paulo.
 */
function formatarHoraMinuto(data) {
  if (!data) return "";
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return "";
  return FORMATADOR_HORA_SP.format(d);
}

/**
 * Calcula regressão linear simples sobre uma série de dados numéricos.
 * @param {number[]} yValores - Array com os valores numéricos de Y.
 * @returns {{ inclinacao: number, intercepto: number, desvioPadraoResiduos: number }}
 */
function calcularRegressaoLinear(yValores) {
  const n = yValores.length;
  if (n < 2) {
    return { inclinacao: 0, intercepto: yValores[0] || 0, desvioPadraoResiduos: 0 };
  }

  let somaX = 0;
  let somaY = 0;
  let somaXY = 0;
  let somaX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = yValores[i];
    somaX += x;
    somaY += y;
    somaXY += x * y;
    somaX2 += x * x;
  }

  const mediaX = somaX / n;
  const mediaY = somaY / n;
  const denominador = somaX2 - n * mediaX * mediaX;

  const b = Math.abs(denominador) < 1e-12 ? 0 : (somaXY - n * mediaX * mediaY) / denominador;
  const a = mediaY - b * mediaX;

  // Cálculo dos resíduos e desvio padrão amostral
  let somaResiduos2 = 0;
  for (let i = 0; i < n; i++) {
    const yEstimado = a + b * i;
    const residuo = yValores[i] - yEstimado;
    somaResiduos2 += residuo * residuo;
  }

  const grausLiberdade = Math.max(1, n - 2);
  const desvioPadraoResiduos = Math.sqrt(somaResiduos2 / grausLiberdade);

  return {
    inclinacao: b,
    intercepto: a,
    desvioPadraoResiduos: desvioPadraoResiduos
  };
}

/**
 * Clampa um número entre min e max.
 */
function clampar(valor, min = 0, max = 100) {
  return Math.max(min, Math.min(max, valor));
}

/**
 * Arredonda para 1 casa decimal.
 */
function arredondar1(valor) {
  if (typeof valor !== "number" || isNaN(valor)) return 0;
  return Math.round(valor * 10) / 10;
}

/**
 * Gera a projeção e faixa de 95% para uma série observada.
 * 
 * @param {Object} params
 * @param {number[]} params.observados - Lista de pontos observados (ex: [44, 48, ...])
 * @param {string[]} params.labelsObservados - Labels de horário dos observados (ex: ["10:40", ...])
 * @param {number} params.intervaloMinutos - Duração de cada bucket (ex: 10 min)
 * @param {number} params.horizonteMinutos - Duração do horizonte futuro (ex: 360 min para 6h)
 * @param {number} params.limiteAtencao - Percentual do limite de atenção (ex: 80)
 * @param {number} params.limiteCritico - Percentual do limite crítico (ex: 90)
 * @param {Date} [params.ultimaDataHora] - Timestamp da última leitura
 * @param {number} [params.minimoPontos=12] - Quantidade mínima de pontos para calcular projeção
 * @param {number} [params.proporcaoJanela=0.25] - Proporção final da série para a regressão
 */
function gerarProjecaoEResultados({
  observados,
  labelsObservados,
  intervaloMinutos,
  horizonteMinutos,
  limiteAtencao,
  limiteCritico,
  ultimaDataHora = new Date(),
  minimoPontos = 12,
  proporcaoJanela = 0.25
}) {
  const m = observados ? observados.length : 0;

  // Se não houver pontos suficientes (< 12), projeção nula
  if (m < minimoPontos) {
    const valorAtual = m > 0 ? arredondar1(observados[m - 1]) : 0;
    return {
      status: "dados_insuficientes",
      projecaoDisponivel: false,
      indiceAgora: Math.max(0, m - 1),
      labels: labelsObservados || [],
      observado: observados || [],
      projecao: null,
      faixaSuperior: null,
      faixaInferior: null,
      limiteLinha: limiteAtencao,
      saturacao: {
        estado: valorAtual >= limiteCritico ? "critico" : valorAtual >= limiteAtencao ? "atencao" : "estavel",
        minutosAteAtencao: null,
        horarioAtencao: valorAtual >= limiteAtencao ? "já excedido" : null,
        minutosAteCritico: null,
        horarioCritico: valorAtual >= limiteCritico ? "já excedido" : null,
        projetadoNoHorizonte: valorAtual
      }
    };
  }

  // Define quantos pontos usar para a regressão (últimos 25% da janela, mínimo 12)
  const n = Math.min(m, Math.max(minimoPontos, Math.floor(m * proporcaoJanela)));
  const fatia = observados.slice(m - n);

  const { inclinacao, intercepto, desvioPadraoResiduos } = calcularRegressaoLinear(fatia);

  // Quantidade de pontos no horizonte futuro
  const kPassos = Math.max(1, Math.round(horizonteMinutos / Math.max(1, intervaloMinutos)));
  const totalPontos = m + kPassos;

  const labelsCompletos = [...labelsObservados];
  const serieObservado = new Array(totalPontos).fill(null);
  const serieProjecao = new Array(totalPontos).fill(null);
  const serieFaixaSuperior = new Array(totalPontos).fill(null);
  const serieFaixaInferior = new Array(totalPontos).fill(null);

  for (let i = 0; i < m; i++) {
    serieObservado[i] = arredondar1(observados[i]);
  }

  // Ponto de ancoragem ("Agora") no índice m - 1
  const idxAgora = m - 1;
  const valorAncora = serieObservado[idxAgora];
  serieProjecao[idxAgora] = valorAncora;
  serieFaixaSuperior[idxAgora] = clampar(arredondar1(valorAncora + 1.96 * desvioPadraoResiduos));
  serieFaixaInferior[idxAgora] = clampar(arredondar1(valorAncora - 1.96 * desvioPadraoResiduos));

  // Geração dos pontos futuros no fuso America/Sao_Paulo
  const xAncoraFatia = n - 1;

  for (let k = 1; k <= kPassos; k++) {
    const idxFuturo = idxAgora + k;
    const xFuturoFatia = xAncoraFatia + k;
    const yPred = intercepto + inclinacao * xFuturoFatia;

    const yClamped = clampar(arredondar1(yPred));
    serieProjecao[idxFuturo] = yClamped;
    serieFaixaSuperior[idxFuturo] = clampar(arredondar1(yPred + 1.96 * desvioPadraoResiduos));
    serieFaixaInferior[idxFuturo] = clampar(arredondar1(yPred - 1.96 * desvioPadraoResiduos));

    const dataFutura = new Date(ultimaDataHora.getTime() + k * intervaloMinutos * 60000);
    labelsCompletos.push(formatarHoraMinuto(dataFutura));
  }

  // Cálculo de saturação (tempo até cruzar atenção e crítico)
  const valorAtual = valorAncora;
  let minutosAteAtencao = null;
  let horarioAtencao = null;
  let minutosAteCritico = null;
  let horarioCritico = null;

  // Checagem se já está excedido no momento atual
  if (valorAtual >= limiteCritico) {
    minutosAteCritico = 0;
    horarioCritico = "já excedido";
  }
  if (valorAtual >= limiteAtencao) {
    minutosAteAtencao = 0;
    horarioAtencao = "já excedido";
  }

  // Se a tendência for crescente, calculamos quando cruza os limites
  if (inclinacao > 1e-7) {
    // Cruzamento com limite de atenção
    if (minutosAteAtencao === null) {
      const xAtencaoFatia = (limiteAtencao - intercepto) / inclinacao;
      const deltaPassosAtencao = xAtencaoFatia - xAncoraFatia;
      const minutosCalc = Math.round(deltaPassosAtencao * intervaloMinutos);

      if (minutosCalc > 0 && minutosCalc <= horizonteMinutos) {
        minutosAteAtencao = minutosCalc;
        const dataCruzamento = new Date(ultimaDataHora.getTime() + minutosCalc * 60000);
        horarioAtencao = formatarHoraMinuto(dataCruzamento);
      }
    }

    // Cruzamento com limite crítico
    if (minutosAteCritico === null) {
      const xCriticoFatia = (limiteCritico - intercepto) / inclinacao;
      const deltaPassosCritico = xCriticoFatia - xAncoraFatia;
      const minutosCalc = Math.round(deltaPassosCritico * intervaloMinutos);

      if (minutosCalc > 0 && minutosCalc <= horizonteMinutos) {
        minutosAteCritico = minutosCalc;
        const dataCruzamento = new Date(ultimaDataHora.getTime() + minutosCalc * 60000);
        horarioCritico = formatarHoraMinuto(dataCruzamento);
      }
    }
  }

  // Determinação do estado geral
  let estado = "estavel";
  if (minutosAteCritico !== null) {
    estado = "critico";
  } else if (minutosAteAtencao !== null) {
    estado = "atencao";
  }

  const projetadoNoHorizonte = serieProjecao[serieProjecao.length - 1];

  return {
    status: "ok",
    projecaoDisponivel: true,
    indiceAgora: idxAgora,
    labels: labelsCompletos,
    observado: serieObservado,
    projecao: serieProjecao,
    faixaSuperior: serieFaixaSuperior,
    faixaInferior: serieFaixaInferior,
    limiteLinha: limiteAtencao,
    saturacao: {
      estado,
      minutosAteAtencao,
      horarioAtencao,
      minutosAteCritico,
      horarioCritico,
      projetadoNoHorizonte
    }
  };
}

module.exports = {
  calcularRegressaoLinear,
  clampar,
  arredondar1,
  formatarHoraMinuto,
  gerarProjecaoEResultados
};
