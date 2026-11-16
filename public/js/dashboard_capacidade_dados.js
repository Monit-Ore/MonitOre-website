const horizontePrevisao = 15;
const semanasPorPeriodo = 4;
const regraAumentoPreocupante = { aumentoMinimoPp: 5, distanciaAtencaoPp: 10 };
// Amostra com oito medianas semanais e uma última leitura válida por período.
function componente(nome, uso, leiturasRecentes, { atencao = 80, critico = 90, habilitado = true } = {}) {
  return { nome, uso, leiturasRecentes, atencao, critico, habilitado };
}

const mineradorasDaAmostra = {
  Vale: "Vale S.A.",
  CSN: "CSN Mineração S.A.",
  Samarco: "Samarco Mineração S.A.",
  Anglo: "Anglo American Minério de Ferro Brasil S.A.",
  Gerdau: "Gerdau Aços Longos S.A.",
  Usiminas: "Mineração Usiminas S.A.",
  CBMM: "Companhia Brasileira de Metalurgia e Mineração",
  Nexa: "Nexa Recursos Minerais S.A.",
  MRN: "Mineração Rio do Norte S.A.",
  ArcelorMittal: "ArcelorMittal Brasil S.A.",
};

const torresDemonstrativas = [
  ["Vale 01", [componente("RAM", [55, 54, 56, 57, 61, 65, 70, 74], [57, 74])]],
  ["Vale 02", [componente("CPU", [52, 51, 52, 53, 53, 55, 54, 55], [53, 92])]],
  ["CSN 01", [componente("CPU", [63, 66, 69, 73, 74, 73, 69, 67], [73, 68])]],
  ["CSN 02", [componente("Disco", [51, 53, 55, 57, 58, 64, 70, 76], [57, 76])]],
  ["Samarco 01", [componente("Disco", [40, 42, 44, 46, 47, 51, 55, 59], [46, 60])]],
  ["Samarco 02", [componente("RAM", [52, 51, 51, 52, 51, 53, 52, 52], [52, 95])]],
  ["Anglo 01", [componente("Disco", [55, 57, 59, 62, 63, 63, 65, 64], [62, 65])]],
  ["Anglo 02", [componente("CPU", [61, 62, 60, 61, 61, 63, 62, 62], [61, 84])]],
  ["Gerdau 01", [
    componente("CPU", [60, 63, 65, 67, 68, 73, 78, 83], [67, 83]),
    componente("RAM", [51, 52, 52, 53, 53, 55, 54, 55], [53, 55]),
  ]],
  ["Gerdau 02", [componente("Disco", [58, 59, 62, 63, 65, 68, 70, 73], [63, 73])]],
  ["Usiminas 01", [componente("RAM", [80, 82, 84, 86, 87, 90, 92, 94], [86, 94])]],
  ["Usiminas 02", [componente("Disco", [59, 63, 67, 71, 72, 75, 78, 82], [71, 82], { atencao: 85, critico: 88 })]],
  ["CBMM 01", [componente("RAM", [59, 58, 60, 60, 59, 62, 60, 61], [60, 91])]],
  ["CBMM 02", [
    componente("Disco", [43, 44, 43, 46, 45, 44, 46, 45], [46, 45]),
    componente("CPU", [77, 80, 83, 86, 89, 92, 95, 98], [86, 98], { habilitado: false }),
  ]],
  ["Nexa 01", [componente("CPU", [61, 62, 63, 64, 67, 74, 73, 76], [64, 76])]],
  ["Nexa 02", [componente("RAM", [63, 63, 64, 62, 62, 63, 62, 62], [62, 86])]],
  ["MRN 01", [componente("Disco", [null, 56, 56, 57, 58, 57, 59, 58], [57, 58])]],
  ["MRN 02", [componente("RAM", [60, 61, null, null, null, 62, null, null], [null, null])]],
  ["ArcelorMittal 01", [componente("CPU", [61, 62, 60, 61, 61, 65, 61, 61], [61, 81])]],
  ["ArcelorMittal 02", [componente("CPU", [60, 61, 62, 63, null, null, null, null], [63, null])], false],
].map(([nome, componentes, habilitada = true]) => ({
  nome,
  codigo: `Torre-${nome.replaceAll(" ", "-")}`,
  mineradora: mineradorasDaAmostra[nome.split(" ")[0]],
  componentes: habilitada ? componentes.filter((item) => item.habilitado) : [],
}));

function leituraValida(valor) {
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

function limitesValidos(item) {
  return leituraValida(item.atencao) && leituraValida(item.critico) && item.atencao < item.critico;
}

function estimarCruzamentos(semanas, item, atual) {
  const media = semanas.reduce((total, valor) => total + valor, 0) / semanasPorPeriodo;
  const semanaCentral = (semanas.length - 1) / 2;
  const variacaoTempo = semanas.reduce((total, _, i) => total + (i - semanaCentral) ** 2, 0);
  const inclinacao = semanas.reduce((total, valor, i) => total + (i - semanaCentral) * (valor - media), 0) / variacaoTempo;
  const variacaoTotal = semanas.reduce((total, valor) => total + (valor - media) ** 2, 0);
  const ajuste = variacaoTotal ? variacaoTempo * inclinacao ** 2 / variacaoTotal : 0;
  if (ajuste < 0.8) return null;

  return [
    ["atencao", item.atencao],
    ["critico", item.critico],
  ].flatMap(([nivel, limite]) => {
    if (atual >= limite) return [];
    const dias = Math.ceil((limite - atual) * 7 / inclinacao);
    return dias <= horizontePrevisao ? [{ nivel, dias, ajuste }] : [];
  });
}

function analisarComponente(item, inicio) {
  const semanas = item.uso.slice(inicio, inicio + semanasPorPeriodo);
  const atual = item.leiturasRecentes[inicio / semanasPorPeriodo];
  const ultimaSemana = semanas.at(-1);
  const comparavel = semanas.length === semanasPorPeriodo && semanas.every(leituraValida) && limitesValidos(item);
  const variacao = leituraValida(semanas[0]) && leituraValida(ultimaSemana) ? ultimaSemana - semanas[0] : null;
  const crescente = comparavel && variacao >= regraAumentoPreocupante.aumentoMinimoPp &&
    semanas.slice(1).every((valor, i) => valor > semanas[i]);
  const previsoes = crescente && leituraValida(atual) ? estimarCruzamentos(semanas, item, atual) : null;
  let situacao = "sem_dados";
  if (leituraValida(atual) && limitesValidos(item)) {
    situacao = atual >= item.critico ? "critico" : atual >= item.atencao ? "atencao" : "normal";
  }
  return { ...item, semanas, atual, comparavel, crescente, previsoes, situacao, variacao };
}

function analisarPeriodo(inicio) {
  return torresDemonstrativas.map((torre) => {
    const componentes = torre.componentes.map((item) => analisarComponente(item, inicio));
    const situacao = ["critico", "atencao", "normal"].find((nivel) => componentes.some((item) => item.situacao === nivel));
    const previsoes = componentes.flatMap((item) => item.previsoes ?? []);
    return {
      ...torre,
      componentes,
      situacao: componentes.length ? situacao ?? "sem_dados" : "sem_monitoramento",
      crescente: componentes.some((item) => item.crescente),
      elegivel: componentes.some((item) => item.comparavel),
      dadosInsuficientes: componentes.some((item) => !item.comparavel || !leituraValida(item.atual)),
      atencaoPrevista: previsoes.some((item) => item.nivel === "atencao"),
      criticoPrevisto: previsoes.some((item) => item.nivel === "critico"),
    };
  });
}

function medirPressao(semana) {
  const analisaveis = torresDemonstrativas.map((torre) => {
    const componentes = torre.componentes.filter((item) =>
      limitesValidos(item) && leituraValida(item.uso[semana - 1]) && leituraValida(item.uso[semana]));
    const sobPressao = componentes.filter((item) =>
      Math.min(item.uso[semana - 1], item.uso[semana]) >= item.atencao * 0.9);
    return { nome: torre.nome, componentes, sobPressao };
  }).filter((torre) => torre.componentes.length);

  return {
    cobertura: analisaveis.length,
    analisaveis,
    torres: analisaveis.filter((torre) => torre.sobPressao.length),
  };
}

function medirAumentoPreocupante(torres) {
  const elegiveis = torres.filter((torre) => torre.elegivel);
  const quantidade = elegiveis.filter((torre) => torre.componentes.some((item) =>
    item.crescente && Math.abs(item.semanas.at(-1) - item.atencao) < regraAumentoPreocupante.distanciaAtencaoPp)).length;
  return { quantidade, codigos: new Set(elegiveis.map((torre) => torre.codigo)) };
}

const panoramaAtual = analisarPeriodo(semanasPorPeriodo);
const panoramaAnterior = analisarPeriodo(0);
const pressaoSemanal = Array.from({ length: semanasPorPeriodo }, (_, i) => medirPressao(i + semanasPorPeriodo));
