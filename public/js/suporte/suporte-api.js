// O navegador nunca recebe credenciais AWS: ele só conversa com a API do Node.
const CAMINHO_DADOS_SUPORTE = "/suporte/buscar";

async function buscarCaptura() {
  const resposta = await fetch(CAMINHO_DADOS_SUPORTE);

  if (!resposta.ok) {
    let mensagem = "Não foi possível carregar os dados do servidor.";

    try {
      const corpoErro = await resposta.json();
      if (corpoErro && corpoErro.mensagem) mensagem = corpoErro.mensagem;
    } catch (ignorado) {}

    throw new Error(mensagem);
  }

  return resposta.json();
}

function mensagemDoErro(erro) {
  if (erro && erro.name === "SyntaxError") {
    return "O servidor retornou uma resposta inválida.";
  }
  if (erro && erro.name === "TypeError") {
    return "Falha de rede ao consultar o servidor. Tente novamente.";
  }
  return (erro && erro.message) || "Não foi possível carregar os dados do suporte.";
}

export { buscarCaptura, mensagemDoErro, CAMINHO_DADOS_SUPORTE };
