var torresModel = require("../models/torresModel");

const ESTADOS = [
  "Acre",
  "Alagoas",
  "Amapá",
  "Amazonas",
  "Bahia",
  "Ceará",
  "Distrito Federal",
  "Espírito Santo",
  "Goiás",
  "Maranhão",
  "Mato Grosso",
  "Mato Grosso do Sul",
  "Minas Gerais",
  "Pará",
  "Paraíba",
  "Paraná",
  "Pernambuco",
  "Piauí",
  "Rio de Janeiro",
  "Rio Grande do Norte",
  "Rio Grande do Sul",
  "Rondônia",
  "Roraima",
  "Santa Catarina",
  "São Paulo",
  "Sergipe",
  "Tocantins",
];

const SISTEMAS_OPERACIONAIS = [
  "Windows Server 2019",
  "Windows Server 2022",
  "Ubuntu Server 20.04",
  "Ubuntu Server 22.04",
  "Debian 12",
  "CentOS Stream 9",
];

function mapearStatusExibicao(statusBanco) {
  return statusBanco === "Alerta" ? "Alerta" : "Regular";
}

async function selecaoTorre(req, res) {
  try {
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const torres = await torresModel.listarTorresComMineradora(fkEmpresa);
    const mapaMineradoras = new Map();

    torres.forEach((torre) => {
      const nomeMineradora = torre.mineradora_nome;

      if (!mapaMineradoras.has(nomeMineradora)) {
        mapaMineradoras.set(nomeMineradora, []);
      }

      mapaMineradoras.get(nomeMineradora).push({
        id_torre: torre.id_torre,
        codigo: torre.codigo,
        status: mapearStatusExibicao(torre.status_operacional),
      });
    });

    const resposta = Array.from(
      mapaMineradoras,
      ([mineradora, listaTorres]) => ({
        mineradora,
        torres: listaTorres,
      }),
    );

    res.status(200).json(resposta);
    console.log("Resposta enviada:", resposta);
  } catch (erro) {
    console.error("Erro ao buscar torres para seleção:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar torres." });
  }
}

async function listarOpcoesCadastro(req, res) {
  try {
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const mineradoras = await torresModel.listarMineradoras(fkEmpresa);

    res.status(200).json({
      mineradoras,
      estados: ESTADOS,
      sistemasOperacionais: SISTEMAS_OPERACIONAIS,
    });
  } catch (erro) {
    console.error("Erro ao buscar opções de cadastro:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar opções de cadastro." });
  }
}

async function cadastrarTorre(req, res) {
  try {
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const {
      nome,
      codigo,
      fk_mineradora,
      localizacao,
      estado,
      cidade,
      descricao,
      monitoramento_ativo,
      servidor,
      componentes,
    } = req.body;

    if (
      !nome ||
      !codigo ||
      !fk_mineradora ||
      !localizacao ||
      !estado ||
      !cidade
    ) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações Gerais.",
      });
    }

    if (
      !servidor ||
      !servidor.identificador ||
      !servidor.ip ||
      !servidor.sistema_operacional ||
      !servidor.status
    ) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações do Servidor.",
      });
    }

    if (!Array.isArray(componentes) || componentes.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione ao menos uma métrica de componente para monitorar.",
      });
    }

    const codigoJaExiste = await torresModel.verificarCodigoExistente(
      fkEmpresa,
      codigo,
    );

    if (codigoJaExiste) {
      return res
        .status(409)
        .json({ mensagem: "Já existe uma torre com esse código." });
    }

    const novaTorre = await torresModel.criarTorre(fkEmpresa, {
      nome,
      codigo,
      fk_mineradora,
      localizacao,
      estado,
      cidade,
      descricao,
      monitoramento_ativo: monitoramento_ativo ?? true,
      servidor,
      componentes,
    });

    res.status(201).json(novaTorre);
  } catch (erro) {
    console.error("Erro ao cadastrar torre:", erro);
    res.status(500).json({ mensagem: "Erro ao cadastrar torre." });
  }
}

module.exports = {
  selecaoTorre,
  listarOpcoesCadastro,
  cadastrarTorre,
};
