var preditivaModel = require("../models/preditivaMetricasModel-isaac");
var agregacaoService = require("../services/agregacaoService-isaac");
var previsaoService = require("../services/previsaoService-isaac");

/**
 * Controller de Métricas e Previsões Preditivas (Beeling)
 * MonitOre - Isaac
 */

/**
 * Consulta e consolida métricas da torre, alimentando os gráficos da dashboard-isaac.
 * Endpoint: GET /preditiva/:idTorre
 */
async function obterDadosPreditiva(req, res) {
  try {
    var idTorreParam = req.params.idTorre;
    var historico = (req.query.historico || "24h").toLowerCase();
    var horizonte = (req.query.horizonte || "6h").toLowerCase();
    var idUsuarioParam = req.query.idUsuario;

    // 1. Validação estrita de parâmetros de entrada
    var idTorre = parseInt(idTorreParam, 10);
    if (!Number.isInteger(idTorre) || idTorre <= 0) {
      return res.status(400).json({
        mensagem: "Parâmetro idTorre inválido. Deve ser um número inteiro positivo."
      });
    }

    if (!idUsuarioParam) {
      return res.status(400).json({
        mensagem: "Parâmetro idUsuario é obrigatório na consulta."
      });
    }

    var idUsuario = parseInt(idUsuarioParam, 10);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      return res.status(400).json({
        mensagem: "Parâmetro idUsuario inválido. Deve ser um número inteiro positivo."
      });
    }

    var historicosValidos = ["24h", "12h", "6h"];
    if (!historicosValidos.includes(historico)) {
      return res.status(400).json({
        mensagem: "Parâmetro historico inválido. Valores aceitos: 24h, 12h ou 6h."
      });
    }

    var horizontesValidos = ["2h", "6h", "24h"];
    if (!horizontesValidos.includes(horizonte)) {
      return res.status(400).json({
        mensagem: "Parâmetro horizonte inválido. Valores aceitos: 2h, 6h ou 24h."
      });
    }

    // 2. Busca cadastro da torre e do PC Industrial vinculado
    var torre = await preditivaModel.buscarTorreComPc(idTorre);
    if (!torre) {
      return res.status(404).json({
        mensagem: "Torre ou PC Industrial não encontrado para o ID informado."
      });
    }

    // 3. Verificação de permissões do usuário
    var temPermissao = await preditivaModel.validarPermissaoUsuario(idUsuario, idTorre);
    if (!temPermissao) {
      return res.status(403).json({
        mensagem: "Acesso negado. Usuário sem permissão para acessar os dados desta torre."
      });
    }

    // 4. Busca os limites operacionais configurados para o PC no MySQL
    var limites = await preditivaModel.buscarLimitesAlerta(torre.id_pc_industrial);

    // 5. Busca telemetria tratada da camada Gold (S3 ou local)
    var dadosGold = await preditivaModel.buscarDadosGold(torre.hostname);
    var metadadosFonte = preditivaModel.obterMetadadosFonte(torre.hostname);

    // Caso a torre não tenha dados disponíveis (arquivo ausente / NoSuchKey)
    if (!dadosGold || !dadosGold.dados || !dadosGold.dados.hardware || dadosGold.dados.hardware.length === 0) {
      return res.status(200).json({
        semDados: true,
        aguardandoGold: true,
        mensagem: "Aguardando tratamento dos dados da camada Gold (EC2) para aplicar os gráficos da dashboard.",
        torre: {
          id: torre.id_torre,
          nome: torre.nome_torre,
          mineradora: torre.mineradora,
          hostname: torre.hostname,
          ultimaTelemetria: null,
          online: false
        },
        fonte: metadadosFonte
      });
    }

    var leiturasHardware = dadosGold.dados.hardware;
    var leiturasProcessos = dadosGold.dados.processos || [];
    var intervaloSegundos = dadosGold.intervaloSegundos || 60;

    // 6. Agrupamento temporal e consolidação de KPIs
    var cfgJanela = agregacaoService.obterConfiguracaoJanela(historico, horizonte);
    var agregacaoHw = agregacaoService.agregarHardware(
      leiturasHardware,
      cfgJanela.minutosJanela,
      cfgJanela.minutosBucket
    );

    var resumo = agregacaoHw.resumo;
    var buckets = agregacaoHw.buckets;

    // Agrupamento de processos por grupo conforme tabela do Figma
    var processosAgrupados = agregacaoService.agregarProcessosPorGrupo
      ? agregacaoService.agregarProcessosPorGrupo(leiturasProcessos)
      : agregacaoService.agregarProcessos(leiturasProcessos);

    var labelsObservados = buckets.map(function (b) { return b.label; });
    var observadosCpu = buckets.map(function (b) { return b.cpu; });
    var observadosRam = buckets.map(function (b) { return b.ram; });
    var observadosDisco = buckets.map(function (b) { return b.disco; });
    var serieProcessos = buckets.map(function (b) { return b.qtdProcessos; });

    var ultimaDataHora = resumo.ultimaLeitura.dataHora instanceof Date
      ? resumo.ultimaLeitura.dataHora
      : new Date(resumo.ultimaLeitura.dataHora);

    // 7. Avaliação de frescor da telemetria e status operacional
    var agoraMs = Date.now();
    var idadeTelemetriaSegundos = Math.max(0, Math.floor((agoraMs - ultimaDataHora.getTime()) / 1000));
    var limiteDefasagemSegundos = Math.max(3 * intervaloSegundos, 180);
    var dadosDefasados = idadeTelemetriaSegundos > limiteDefasagemSegundos;

    var statusOperacionalAtivo = (torre.status_operacional || "").toLowerCase() === "ativo";
    var torreOnline = statusOperacionalAtivo && !dadosDefasados;

    // 8. Geração de previsões e faixas preditivas (CPU, RAM, DISCO)
    var previsaoCpu = previsaoService.gerarProjecaoEResultados({
      observados: observadosCpu,
      labelsObservados: labelsObservados,
      intervaloMinutos: cfgJanela.minutosBucket,
      horizonteMinutos: cfgJanela.minutosHorizonte,
      limiteAtencao: limites.CPU.atencao,
      limiteCritico: limites.CPU.critico,
      ultimaDataHora: ultimaDataHora
    });

    var previsaoRam = previsaoService.gerarProjecaoEResultados({
      observados: observadosRam,
      labelsObservados: labelsObservados,
      intervaloMinutos: cfgJanela.minutosBucket,
      horizonteMinutos: cfgJanela.minutosHorizonte,
      limiteAtencao: limites.RAM.atencao,
      limiteCritico: limites.RAM.critico,
      ultimaDataHora: ultimaDataHora
    });

    var previsaoDisco = previsaoService.gerarProjecaoEResultados({
      observados: observadosDisco,
      labelsObservados: labelsObservados,
      intervaloMinutos: cfgJanela.minutosBucket,
      horizonteMinutos: cfgJanela.minutosHorizonte,
      limiteAtencao: limites.Disco.atencao,
      limiteCritico: limites.Disco.critico,
      ultimaDataHora: ultimaDataHora
    });

    // 9. Classificação dos KPIs de saturação
    var statusCpu = agregacaoService.calcularStatusLimite(
      resumo.cpu.atual,
      limites.CPU.atencao,
      limites.CPU.critico
    );
    var statusRam = agregacaoService.calcularStatusLimite(
      resumo.ram.atual,
      limites.RAM.atencao,
      limites.RAM.critico
    );
    var statusDisco = agregacaoService.calcularStatusLimite(
      resumo.disco.atual,
      limites.Disco.atencao,
      limites.Disco.critico
    );

    // 10. Resposta consolidada para a dashboard
    var resposta = {
      fonte: metadadosFonte,
      torre: {
        id: torre.id_torre,
        nome: torre.nome_torre,
        mineradora: torre.mineradora,
        hostname: torre.hostname,
        ultimaTelemetria: ultimaDataHora.toISOString(),
        online: torreOnline
      },
      dadosDefasados: dadosDefasados,
      idadeTelemetriaSegundos: idadeTelemetriaSegundos,
      limiteDefasagemSegundos: limiteDefasagemSegundos,
      indiceAgora: previsaoCpu.indiceAgora,
      kpis: {
        processos: {
          atual: resumo.processos.atual,
          media: resumo.processos.media,
          pico: resumo.processos.pico,
          variacaoPct: resumo.processos.variacaoPct
        },
        CPU: {
          atual: resumo.cpu.atual,
          media: resumo.cpu.media,
          pico: resumo.cpu.pico,
          atencao: limites.CPU.atencao,
          critico: limites.CPU.critico,
          status: statusCpu
        },
        RAM: {
          atual: resumo.ram.atual,
          media: resumo.ram.media,
          pico: resumo.ram.pico,
          usadoGb: resumo.ram.usadoGb,
          totalGb: resumo.ram.totalGb,
          atencao: limites.RAM.atencao,
          critico: limites.RAM.critico,
          status: statusRam
        },
        Disco: {
          atual: resumo.disco.atual,
          media: resumo.disco.media,
          pico: resumo.disco.pico,
          usadoGb: null,
          totalGb: null,
          atencao: limites.Disco.atencao,
          critico: limites.Disco.critico,
          status: statusDisco
        }
      },
      saturacao: {
        CPU: previsaoCpu.saturacao,
        RAM: previsaoRam.saturacao,
        Disco: previsaoDisco.saturacao
      },
      series: {
        CPU: {
          labels: previsaoCpu.labels,
          observado: previsaoCpu.observado,
          projecao: previsaoCpu.projecao,
          faixaSuperior: previsaoCpu.faixaSuperior,
          faixaInferior: previsaoCpu.faixaInferior,
          limiteLinha: limites.CPU.atencao,
          processosSerie: serieProcessos
        },
        RAM: {
          labels: previsaoRam.labels,
          observado: previsaoRam.observado,
          projecao: previsaoRam.projecao,
          faixaSuperior: previsaoRam.faixaSuperior,
          faixaInferior: previsaoRam.faixaInferior,
          limiteLinha: limites.RAM.atencao,
          processosSerie: serieProcessos
        },
        Disco: {
          labels: previsaoDisco.labels,
          observado: previsaoDisco.observado,
          projecao: previsaoDisco.projecao,
          faixaSuperior: previsaoDisco.faixaSuperior,
          faixaInferior: previsaoDisco.faixaInferior,
          limiteLinha: limites.Disco.atencao,
          processosSerie: serieProcessos
        }
      },
      processos: processosAgrupados
    };

    return res.status(200).json(resposta);
  } catch (erro) {
    if (erro instanceof preditivaModel.ErroFonteIndisponivel) {
      console.error("[PreditivaController] Fonte Gold indisponível:", erro.message, erro.causaOriginal || "");
      return res.status(503).json({
        fonteIndisponivel: true,
        mensagem: "Fonte de telemetria indisponível no momento. Tente novamente em instantes."
      });
    }

    console.error("[PreditivaController] Erro interno:", erro);
    return res.status(500).json({
      mensagem: "Erro interno no servidor ao processar análise preditiva.",
      detalhes: erro.message
    });
  }
}

module.exports = {
  obterDadosPreditiva
};
