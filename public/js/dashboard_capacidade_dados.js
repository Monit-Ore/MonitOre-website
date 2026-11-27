// As análises e previsões são calculadas pelo tratamento na camada Gold.
const horizontePrevisao = 15;
function leituraValida(valor) {
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}
