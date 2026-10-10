var torresModel = require("../models/torresModel");

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
      mineradoras
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
      pc_industrial,
      endereco,
      componentes,
    } = req.body;

    if (!nome || !codigo || !fk_mineradora) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações Gerais.",
      });
    }

    if (
      !pc_industrial ||
      !pc_industrial.identificador ||
      !pc_industrial.hostname ||
      !pc_industrial.uuid ||
      !endereco.cep ||
      !endereco.estado ||
      !endereco.cidade ||
      !endereco.logradouro ||
      !endereco.bairro ||
      !endereco.numero ||
      !endereco.complemento
    ) {
      return res.status(400).json({
        mensagem:
          "Preencha todos os campos obrigatórios de Informações do PC Industrial e/ou endereço da torre.",
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
      pc_industrial.uuid
    );

    if (codigoJaExiste) {
      return res
        .status(409)
        .json({ mensagem: "Já existe uma torre com esse código." });
    }

    const novaTorre = await torresModel.criarTorre(
      fkEmpresa,
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes
    );

    res.status(201).json(novaTorre);
  } catch (erro) {
    console.error("Erro ao cadastrar torre:", erro);
    res.status(500).json({ mensagem: "Erro ao cadastrar torre." });
  }
}


async function buscarTorrePorId(req, res) {
  try {
    const { id } = req.params;
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const torre = await torresModel.buscarTorrePorId(id, fkEmpresa);

    if (!torre) {
      return res.status(404).json({ mensagem: "Torre não encontrada." });
    }

    res.status(200).json(torre);
  } catch (erro) {
    console.error("Erro ao buscar torre por ID:", erro);
    res.status(500).json({ mensagem: "Erro ao buscar torre." });
  }
}

async function atualizarTorre(req, res) {
  try {
    const { id } = req.params;
    const { fkEmpresa } = req.query;

    if (!fkEmpresa) {
      return res.status(401).json({ mensagem: "Usuário não autenticado." });
    }

    const {
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes,
    } = req.body;

    if (!nome || !codigo || !fk_mineradora) {
      return res.status(400).json({
        mensagem: "Preencha todos os campos obrigatórios de Informações Gerais.",
      });
    }

    if (
      !pc_industrial ||
      !pc_industrial.identificador ||
      !pc_industrial.hostname ||
      !pc_industrial.uuid ||
      !endereco.cep ||
      !endereco.estado ||
      !endereco.cidade ||
      !endereco.logradouro ||
      !endereco.bairro ||
      !endereco.numero ||
      !endereco.complemento
    ) {
      return res.status(400).json({
        mensagem: "Preencha todos os campos obrigatórios do PC Industrial e Endereço.",
      });
    }

    if (!Array.isArray(componentes) || componentes.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione ao menos uma métrica de componente para monitorar.",
      });
    }

    await torresModel.atualizarTorre(
      id,
      fkEmpresa,
      nome,
      codigo,
      fk_mineradora,
      pc_industrial,
      endereco,
      componentes
    );

    res.status(200).json({ mensagem: "Torre atualizada com sucesso!" });
  } catch (erro) {
    console.error("Erro ao atualizar torre:", erro);
    res.status(500).json({ mensagem: "Erro ao atualizar torre." });
  }
}

// Certifique-se de exportar as novas funções junto com as antigas:
module.exports = {
  selecaoTorre,
  listarOpcoesCadastro,
  cadastrarTorre,
  buscarTorrePorId,
  atualizarTorre,
  
};
