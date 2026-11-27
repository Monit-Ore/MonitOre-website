// Cache local e temporário do processo Node. Não exige Redis nem banco.
const itens = new Map();
const LIMITE_ITENS = 200;

function obter(chave) {
  const item = itens.get(chave);
  if (!item) return null;

  if (item.expiraEm <= Date.now()) {
    itens.delete(chave);
    return null;
  }

  return item.valor;
}

function guardar(chave, valor, duracaoMs) {
  // Evita crescimento indefinido em um servidor que fica muito tempo ligado.
  if (itens.size >= LIMITE_ITENS) {
    const primeiraChave = itens.keys().next().value;
    if (primeiraChave !== undefined) itens.delete(primeiraChave);
  }

  itens.delete(chave);
  itens.set(chave, {
    valor,
    expiraEm: Date.now() + duracaoMs,
  });
  return valor;
}

function limpar() {
  itens.clear();
}

module.exports = { obter, guardar, limpar };
