var fs = require("fs");
var path = require("path");
var database = require("../database/config");

/**
 * Model de Métricas Preditivas (Beeling) - Isaac
 *
 * Responsável por:
 * 1. Consultar dados cadastrais, limites operacionais e permissões no MySQL.
 * 2. Consumir dados tratados da camada Gold (S3 ou pasta local de desenvolvimento).
 * 3. Gerenciar cache em memória com TTL de 30s, ETag (304), deduplicação de requisições
 *    simultâneas e proteção contra arquivos > 25 MB.
 *
 * NUNCA recorre a fixtures legadas, CSVs ou pastas externas fora do contrato.
 */

// ============================================================================
// CLASSE DE ERRO PERSONALIZADA
// ============================================================================
class ErroFonteIndisponivel extends Error {
  constructor(mensagem, causaOriginal) {
    super(mensagem);
    this.name = "ErroFonteIndisponivel";
    this.causaOriginal = causaOriginal || null;
  }
}

// ============================================================================
// CACHE EM MEMÓRIA POR HOSTNAME E CONTROLE DE REQUISIÇÕES EM VOO
// ============================================================================
var cachePorHost = {};
var promessasEmVoo = {};
var TTL_CACHE_MS = 30 * 1000; // 30 segundos
var LIMITE_BYTES_MAX = 25 * 1024 * 1024; // 25 MB

// Cliente S3 injetável para testes unitários (singleton)
var s3ClientInjetado = null;
var _s3Singleton = null;
var _GetObjectCommandSingleton = null;

function _setS3Client(client) {
  s3ClientInjetado = client;
}

function _resetS3Client() {
  s3ClientInjetado = null;
  _s3Singleton = null;
  _GetObjectCommandSingleton = null;
}

/**
 * Retorna o cliente S3 singleton (reutilizado entre chamadas).
 * Se um cliente foi injetado para testes, usa ele.
 * Caso contrário, inicializa e reaproveita um único S3Client real.
 */
function obterClienteS3() {
  if (s3ClientInjetado) {
    return { client: s3ClientInjetado, GetObjectCommand: function (cmd) { return cmd; } };
  }
  if (_s3Singleton) {
    return { client: _s3Singleton, GetObjectCommand: _GetObjectCommandSingleton };
  }
  try {
    var awsSdk = require("@aws-sdk/client-s3");
    var regiao = process.env.AWS_REGION || "us-east-1";
    _s3Singleton = new awsSdk.S3Client({ region: regiao });
    _GetObjectCommandSingleton = awsSdk.GetObjectCommand;
    return { client: _s3Singleton, GetObjectCommand: _GetObjectCommandSingleton };
  } catch (e) {
    throw new ErroFonteIndisponivel("Módulo @aws-sdk/client-s3 não disponível no ambiente.", e);
  }
}

function _limparCache() {
  cachePorHost = {};
  promessasEmVoo = {};
}

// ============================================================================
// 1. CONSULTAS AO BANCO MYSQL
// ============================================================================

async function buscarTorreComPc(idTorre) {
  if (!Number.isInteger(Number(idTorre))) {
    throw new Error("idTorre inválido para consulta.");
  }

  var idTorreSeguro = Number(idTorre);

  var instrucaoSql = `
    SELECT 
      t.id_torre,
      t.nome AS nome_torre,
      t.codigo AS codigo_torre,
      m.razao_social AS mineradora,
      t.fk_fabricante,
      t.fk_mineradora,
      pc.id_pc_industrial,
      pc.hostname,
      pc.status_operacional
    FROM torre t
    INNER JOIN empresa m ON m.id_empresa = t.fk_mineradora
    INNER JOIN PC_Industrial pc ON pc.fk_torre = t.id_torre
    WHERE t.id_torre = ${idTorreSeguro};
  `;

  var resultados = await database.executar(instrucaoSql);
  return resultados && resultados.length > 0 ? resultados[0] : null;
}

async function buscarLimitesAlerta(idPcIndustrial) {
  if (!Number.isInteger(Number(idPcIndustrial))) {
    throw new Error("idPcIndustrial inválido para consulta.");
  }

  var idPcSeguro = Number(idPcIndustrial);

  var instrucaoSql = `
    SELECT 
      c.nome AS componente,
      la.atencao,
      la.critico
    FROM limite_alerta la
    INNER JOIN componente c ON c.id_componente = la.fk_componente
    WHERE la.fk_pc_industrial = ${idPcSeguro};
  `;

  var resultados = await database.executar(instrucaoSql);

  var mapa = {
    CPU: { atencao: 80, critico: 90 },
    RAM: { atencao: 80, critico: 90 },
    Disco: { atencao: 75, critico: 90 }
  };

  if (Array.isArray(resultados)) {
    for (var i = 0; i < resultados.length; i++) {
      var item = resultados[i];
      var comp = (item.componente || "").toUpperCase();
      if (comp.includes("CPU")) {
        mapa.CPU = { atencao: Number(item.atencao), critico: Number(item.critico) };
      } else if (comp.includes("RAM") || comp.includes("MEMORIA")) {
        mapa.RAM = { atencao: Number(item.atencao), critico: Number(item.critico) };
      } else if (comp.includes("DISCO") || comp.includes("HD") || comp.includes("SSD")) {
        mapa.Disco = { atencao: Number(item.atencao), critico: Number(item.critico) };
      }
    }
  }

  return mapa;
}

async function validarPermissaoUsuario(idUsuario, idTorre) {
  if (!Number.isInteger(Number(idUsuario)) || !Number.isInteger(Number(idTorre))) {
    return false;
  }

  var idUsuarioSeguro = Number(idUsuario);
  var idTorreSeguro = Number(idTorre);

  var instrucaoSql = `
    SELECT 
      u.id_usuario,
      u.cargo,
      u.fk_empresa,
      t.fk_fabricante,
      t.fk_mineradora,
      (
        SELECT COUNT(*) 
        FROM permissionamento p 
        WHERE p.usuario_id_usuario = u.id_usuario 
          AND p.torre_id_torre = ${idTorreSeguro}
      ) AS tem_permissao_especifica
    FROM usuario u
    CROSS JOIN (SELECT fk_fabricante, fk_mineradora FROM torre WHERE id_torre = ${idTorreSeguro}) t
    WHERE u.id_usuario = ${idUsuarioSeguro};
  `;

  var resultados = await database.executar(instrucaoSql);
  if (!resultados || resultados.length === 0) {
    return false;
  }

  var reg = resultados[0];
  var cargo = (reg.cargo || "").toLowerCase();

  // 1. Permissão individual na tabela permissionamento
  if (Number(reg.tem_permissao_especifica) > 0) {
    return true;
  }

  // 2. Administrador do fabricante ou mineradora da torre
  if (cargo === "administrador") {
    if (reg.fk_empresa === reg.fk_fabricante || reg.fk_empresa === reg.fk_mineradora) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// 2. NORMALIZAÇÃO, VALIDAÇÃO E DEDUPLICAÇÃO DE DADOS GOLD
// ============================================================================

function normalizarDataHora(item) {
  if (!item) return null;

  var campoIso = item.dataHora || item.DATA_HORA || item.timestamp;
  if (campoIso) {
    var dIso = new Date(campoIso);
    if (!isNaN(dIso.getTime())) return dIso;
  }

  var dataStr = item.data || item.DATA || "";
  var horaStr = item.hora || item.HORA || "";

  if (dataStr && horaStr) {
    var partesData = dataStr.trim().split("/");
    if (partesData.length === 3) {
      var dia = parseInt(partesData[0], 10);
      var mes = parseInt(partesData[1], 10) - 1;
      var ano = parseInt(partesData[2], 10);

      var partesHora = horaStr.trim().split(":");
      var horas = parseInt(partesHora[0], 10) || 0;
      var minutos = parseInt(partesHora[1], 10) || 0;
      var segundos = parseInt(partesHora[2], 10) || 0;

      var d = new Date(Date.UTC(ano, mes, dia, horas, minutos, segundos));
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

function parseNum(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  if (typeof v === "string") {
    var parsed = parseFloat(v.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizarRegistroHardwareJson(item) {
  if (!item || typeof item !== "object") return null;

  var hostname = (item.hostname || item.pcIndustrial || item.PC_INDUSTRIAL || "").trim().toUpperCase();
  var dataHora = normalizarDataHora(item);
  if (!dataHora) return null;

  var cpu = parseNum(item.cpuTotalPct !== undefined ? item.cpuTotalPct : item.CPU_TOTAL_PCT);
  var ram = parseNum(item.ramTotalPct !== undefined ? item.ramTotalPct : item.RAM_TOTAL_PCT);
  var ramMb = parseNum(item.ramTotalMb !== undefined ? item.ramTotalMb : item.RAM_TOTAL_MB);
  var disco = parseNum(item.discoTotalPct !== undefined ? item.discoTotalPct : item.DISCO_TOTAL_PCT);
  var qtdProcRaw = item.qtdProcessos !== undefined ? item.qtdProcessos : item.QTD_PROCESSOS;
  var rodadaRaw = item.rodada !== undefined ? item.rodada : item.RODADA;

  var rodada = typeof rodadaRaw === "number" ? rodadaRaw : parseInt(rodadaRaw, 10);
  var qtdProcessos = typeof qtdProcRaw === "number" ? qtdProcRaw : parseInt(qtdProcRaw, 10);

  // Validação: se presente, métrica deve estar em 0-100; ausente/null é permitido para componente não configurado
  if (cpu !== null && (cpu < 0 || cpu > 100)) return null;
  if (ram !== null && (ram < 0 || ram > 100)) return null;
  if (disco !== null && (disco < 0 || disco > 100)) return null;
  if (isNaN(rodada)) return null;
  if (cpu === null && ram === null && disco === null) return null;

  return {
    rodada: rodada,
    hostname: hostname,
    dataHora: dataHora,
    cpuTotalPct: cpu,
    ramTotalPct: ram,
    ramTotalMb: ramMb !== null && ramMb >= 0 ? ramMb : null,
    discoTotalPct: disco,
    qtdProcessos: !isNaN(qtdProcessos) && qtdProcessos >= 0 ? qtdProcessos : 0
  };
}

function normalizarRegistroProcessoJson(item) {
  if (!item || typeof item !== "object") return null;

  var hostname = (item.hostname || item.pcIndustrial || item.PC_INDUSTRIAL || "").trim().toUpperCase();
  var dataHora = normalizarDataHora(item);

  var procNome = item.processo || item.PROCESSO || item.nome || item.NOME_PROCESSO || "";
  procNome = String(procNome).trim();
  if (!procNome) return null;

  var pidRaw = item.pid !== undefined ? item.pid : item.PID;
  var rodadaRaw = item.rodada !== undefined ? item.rodada : item.RODADA;
  var pid = typeof pidRaw === "number" ? pidRaw : parseInt(pidRaw, 10);
  var rodada = typeof rodadaRaw === "number" ? rodadaRaw : parseInt(rodadaRaw, 10);

  var cpuAbs = parseNum(item.procCpuAbsolutaPct !== undefined ? item.procCpuAbsolutaPct : item.PROC_CPU_ABSOLUTA_PCT);
  var cpuGlob = parseNum(item.procCpuGlobalPct !== undefined ? item.procCpuGlobalPct : item.PROC_CPU_GLOBAL_PCT);
  var ramPct = parseNum(item.procRamPct !== undefined ? item.procRamPct : item.PROC_RAM_PCT);
  var ramMb = parseNum(item.procRamMb !== undefined ? item.procRamMb : item.PROC_RAM_MB);
  var discoIo = parseNum(item.procDiscoIoMbs !== undefined ? item.procDiscoIoMbs : item.PROC_DISCO_IO_MBS);

  if (cpuGlob !== null && (cpuGlob < 0 || cpuGlob > 100)) return null;
  if (ramPct !== null && (ramPct < 0 || ramPct > 100)) return null;
  if (cpuAbs !== null && cpuAbs < 0) return null;
  if (ramMb !== null && ramMb < 0) return null;
  if (isNaN(rodada) || isNaN(pid)) return null;
  if (cpuGlob === null && ramPct === null && ramMb === null && cpuAbs === null) return null;

  return {
    rodada: rodada,
    hostname: hostname,
    dataHora: dataHora,
    pid: pid,
    processo: procNome,
    procCpuAbsolutaPct: cpuAbs,
    procCpuGlobalPct: cpuGlob,
    procRamPct: ramPct,
    procRamMb: ramMb !== null ? ramMb : 0,
    procDiscoIoMbs: discoIo !== null && discoIo >= 0 ? discoIo : null
  };
}

function processarEFiltrarObjetoGold(obj, hostnameAlvo, hostnameDefault) {
  if (!obj || typeof obj !== "object") return null;

  var listaHw = Array.isArray(obj.hardware) ? obj.hardware : [];
  var listaProc = Array.isArray(obj.processos) ? obj.processos : [];

  var hwDeduplicado = [];
  var chavesHwVistas = new Set();
  var descartesHw = 0;

  for (var i = 0; i < listaHw.length; i++) {
    var regHw = normalizarRegistroHardwareJson(listaHw[i]);
    if (!regHw) {
      descartesHw++;
      continue;
    }
    // Fallback: se o registro não tiver hostname, assume o do arquivo/chave S3
    if (regHw.hostname === '' && hostnameDefault) {
      regHw.hostname = hostnameDefault;
    }
    if (hostnameAlvo && regHw.hostname !== hostnameAlvo) {
      continue;
    }
    var chaveHw = `${regHw.hostname}_${regHw.rodada}_${regHw.dataHora.toISOString()}`;
    if (!chavesHwVistas.has(chaveHw)) {
      chavesHwVistas.add(chaveHw);
      hwDeduplicado.push(regHw);
    }
  }

  var procDeduplicado = [];
  var chavesProcVistas = new Set();
  var descartesProc = 0;

  for (var j = 0; j < listaProc.length; j++) {
    var regProc = normalizarRegistroProcessoJson(listaProc[j]);
    if (!regProc) {
      descartesProc++;
      continue;
    }
    // Fallback: se o registro não tiver hostname, assume o do arquivo/chave S3
    if (regProc.hostname === '' && hostnameDefault) {
      regProc.hostname = hostnameDefault;
    }
    if (hostnameAlvo && regProc.hostname !== hostnameAlvo) {
      continue;
    }
    var dataHoraStr = regProc.dataHora ? regProc.dataHora.toISOString() : "sem_data";
    var chaveProc = `${regProc.hostname}_${regProc.rodada}_${dataHoraStr}_${regProc.pid}_${regProc.processo}`;
    if (!chavesProcVistas.has(chaveProc)) {
      chavesProcVistas.add(chaveProc);
      procDeduplicado.push(regProc);
    }
  }

  if (descartesHw > 0 || descartesProc > 0) {
    console.warn(`[Gold JSON] Registros inválidos descartados para ${hostnameAlvo}: ${descartesHw} hardware, ${descartesProc} processos.`);
  }

  hwDeduplicado.sort(function (a, b) {
    return a.dataHora.getTime() - b.dataHora.getTime();
  });

  procDeduplicado.sort(function (a, b) {
    var tA = a.dataHora ? a.dataHora.getTime() : 0;
    var tB = b.dataHora ? b.dataHora.getTime() : 0;
    return tA - tB;
  });

  return {
    schemaVersion: obj.schemaVersion || 1,
    origem: obj.origem || "EC2-ETL",
    geradoEm: obj.geradoEm || null,
    hostname: (obj.hostname || hostnameAlvo).toUpperCase(),
    intervaloSegundos: parseNum(obj.intervaloSegundos) || 60,
    hardware: hwDeduplicado,
    processos: procDeduplicado
  };
}

// ============================================================================
// 3. CAMADA DE LEITURA (S3 OU LOCAL)
// ============================================================================

function obterModoFonte() {
  if (process.env.PREDITIVA_FONTE) {
    return process.env.PREDITIVA_FONTE.trim().toLowerCase();
  }
  return process.env.NODE_ENV === "production" ? "s3" : "local";
}

async function streamParaTextoComLimite(stream, limiteBytes) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var tamanhoAcumulado = 0;

    stream.on("data", function (chunk) {
      tamanhoAcumulado += chunk.length;
      if (tamanhoAcumulado > limiteBytes) {
        stream.destroy();
        reject(new ErroFonteIndisponivel(`Objeto S3 excede o limite máximo permitido de ${limiteBytes / (1024 * 1024)} MB.`));
      } else {
        chunks.push(chunk);
      }
    });

    stream.on("error", function (err) {
      reject(new ErroFonteIndisponivel("Falha ao ler stream do objeto S3.", err));
    });

    stream.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
  });
}

async function buscarObjetoS3(hostnameFormatado) {
  var bucket = process.env.S3_BUCKET_OURO;
  if (!bucket) {
    throw new ErroFonteIndisponivel("Variável S3_BUCKET_OURO não configurada para leitura do S3.");
  }

  // Padrão alinhado ao etl_pipeline.py: ouro/<HOSTNAME>/ultimas-24h.json
  var prefixo = process.env.S3_PREFIXO_OURO || "ouro/";
  if (prefixo && !prefixo.endsWith("/")) prefixo += "/";
  var chave = `${prefixo}${hostnameFormatado}/ultimas-24h.json`;
  var regiao = process.env.AWS_REGION || "us-east-1";

  var cached = cachePorHost[hostnameFormatado];
  var agora = Date.now();

  // Cache hit dentro do TTL
  if (cached && agora - cached.timestampLeitura < TTL_CACHE_MS) {
    return cached;
  }

  // Obtém cliente S3 singleton (reutilizado entre chamadas)
  var sdk = obterClienteS3();
  var s3Client = sdk.client;
  var GetObjectCommandClass = sdk.GetObjectCommand;

  var params = {
    Bucket: bucket,
    Key: chave
  };

  if (cached && cached.etag) {
    params.IfNoneMatch = cached.etag;
  }

  try {
    var comando = new GetObjectCommandClass(params);
    var resposta = await s3Client.send(comando);

    // 304 Not Modified
    if (resposta && resposta.$metadata && resposta.$metadata.httpStatusCode === 304) {
      if (cached) {
        cached.timestampLeitura = agora;
        return cached;
      }
    }

    if (resposta.ContentLength && resposta.ContentLength > LIMITE_BYTES_MAX) {
      throw new ErroFonteIndisponivel(`Objeto S3 excede o limite máximo permitido de ${LIMITE_BYTES_MAX / (1024 * 1024)} MB.`);
    }

    var texto = "";
    if (resposta.Body && typeof resposta.Body.transformToString === "function") {
      texto = await resposta.Body.transformToString("utf-8");
      if (Buffer.byteLength(texto, "utf-8") > LIMITE_BYTES_MAX) {
        throw new ErroFonteIndisponivel(`Objeto S3 excede o limite máximo permitido de ${LIMITE_BYTES_MAX / (1024 * 1024)} MB.`);
      }
    } else if (resposta.Body && typeof resposta.Body.on === "function") {
      texto = await streamParaTextoComLimite(resposta.Body, LIMITE_BYTES_MAX);
    } else if (typeof resposta.Body === "string") {
      texto = resposta.Body;
    } else {
      throw new ErroFonteIndisponivel("Formato de corpo de resposta S3 não reconhecido.");
    }

    var objJson = JSON.parse(texto);
    var processado = processarEFiltrarObjetoGold(objJson, hostnameFormatado, hostnameFormatado);

    var novoCache = {
      tipo: "s3",
      bucket: bucket,
      chave: chave,
      etag: resposta.ETag || null,
      ultimaModificacao: resposta.LastModified ? new Date(resposta.LastModified).toISOString() : new Date().toISOString(),
      timestampLeitura: agora,
      geradoEm: processado ? processado.geradoEm : null,
      schemaVersion: processado ? processado.schemaVersion : 1,
      intervaloSegundos: processado ? processado.intervaloSegundos : 60,
      dados: processado
    };

    cachePorHost[hostnameFormatado] = novoCache;
    return novoCache;
  } catch (err) {
    // 304 lançado como exceção pelo SDK
    var statusCode = (err.$metadata && err.$metadata.httpStatusCode) || err.status || err.statusCode;
    if (statusCode === 304 || err.name === "304NotModified" || err.name === "NotModified") {
      if (cached) {
        cached.timestampLeitura = agora;
        return cached;
      }
    }

    // 404 / Objeto inexistente -> Retorna null (aguardando Gold)
    if (statusCode === 404 || err.name === "NoSuchKey" || err.name === "NotFound" || err.Code === "NoSuchKey") {
      return null;
    }

    // Erros reclassificados como ErroFonteIndisponivel
    if (err instanceof ErroFonteIndisponivel) {
      throw err;
    }

    throw new ErroFonteIndisponivel(`Falha ao acessar objeto S3 (${chave}): ${err.message}`, err);
  }
}

async function buscarObjetoLocal(hostnameFormatado) {
  var pastaGold = process.env.PREDITIVA_PASTA_GOLD || path.join(__dirname, "../../fixtures-isaac/gold-dev");
  var caminhoArquivo = path.join(pastaGold, hostnameFormatado, "ultimas-24h.json");

  if (!fs.existsSync(caminhoArquivo)) {
    return null;
  }

  var stats = fs.statSync(caminhoArquivo);
  if (stats.size > LIMITE_BYTES_MAX) {
    throw new ErroFonteIndisponivel(`Arquivo local (${caminhoArquivo}) excede o limite máximo de ${LIMITE_BYTES_MAX / (1024 * 1024)} MB.`);
  }

  var agora = Date.now();
  var cached = cachePorHost[hostnameFormatado];

  if (cached && agora - cached.timestampLeitura < TTL_CACHE_MS && cached.mtimeMs === stats.mtimeMs) {
    return cached;
  }

  try {
    var raw = fs.readFileSync(caminhoArquivo, "utf-8");
    var objJson = JSON.parse(raw);
    var processado = processarEFiltrarObjetoGold(objJson, hostnameFormatado, hostnameFormatado);

    var novoCache = {
      tipo: "local",
      pasta: pastaGold,
      chave: caminhoArquivo,
      etag: `local-${stats.mtimeMs}-${stats.size}`,
      mtimeMs: stats.mtimeMs,
      ultimaModificacao: stats.mtime.toISOString(),
      timestampLeitura: agora,
      geradoEm: processado ? processado.geradoEm : null,
      schemaVersion: processado ? processado.schemaVersion : 1,
      intervaloSegundos: processado ? processado.intervaloSegundos : 60,
      dados: processado
    };

    cachePorHost[hostnameFormatado] = novoCache;
    return novoCache;
  } catch (err) {
    throw new ErroFonteIndisponivel(`Erro ao carregar telemetria Gold local em ${caminhoArquivo}: ${err.message}`, err);
  }
}

async function buscarDadosGold(hostname) {
  var hostnameFormatado = (hostname || "").trim().toUpperCase();
  if (!hostnameFormatado) return null;

  // Deduplicação de requisições simultâneas em voo para o mesmo hostname
  if (promessasEmVoo[hostnameFormatado]) {
    return await promessasEmVoo[hostnameFormatado];
  }

  var promessa = (async function () {
    try {
      var modo = obterModoFonte();
      if (modo === "s3") {
        return await buscarObjetoS3(hostnameFormatado);
      } else {
        return await buscarObjetoLocal(hostnameFormatado);
      }
    } finally {
      delete promessasEmVoo[hostnameFormatado];
    }
  })();

  promessasEmVoo[hostnameFormatado] = promessa;
  return await promessa;
}

// ============================================================================
// 4. INTERFACE PÚBLICA PARA O CONTROLLER
// ============================================================================

async function buscarMetricasHardware(hostname) {
  var resultado = await buscarDadosGold(hostname);
  if (!resultado || !resultado.dados) return null;
  return resultado.dados.hardware || [];
}

async function buscarMetricasProcessos(hostname) {
  var resultado = await buscarDadosGold(hostname);
  if (!resultado || !resultado.dados) return null;
  return resultado.dados.processos || [];
}

function obterMetadadosFonte(hostname) {
  var hostnameFormatado = (hostname || "").trim().toUpperCase();
  var cached = cachePorHost[hostnameFormatado];
  var modo = obterModoFonte();

  if (cached) {
    return {
      tipo: cached.tipo,
      bucket: cached.bucket || null,
      pasta: cached.pasta || null,
      chave: cached.chave,
      etag: cached.etag,
      ultimaModificacao: cached.ultimaModificacao,
      geradoEm: cached.geradoEm,
      schemaVersion: cached.schemaVersion,
      intervaloSegundos: cached.intervaloSegundos
    };
  }

  return {
    tipo: modo,
    bucket: modo === "s3" ? (process.env.S3_BUCKET_OURO || null) : null,
    pasta: modo === "local" ? (process.env.PREDITIVA_PASTA_GOLD || "./fixtures-isaac/gold-dev") : null,
    chave: null,
    etag: null,
    ultimaModificacao: null,
    geradoEm: null,
    schemaVersion: 1,
    intervaloSegundos: 60
  };
}

module.exports = {
  ErroFonteIndisponivel: ErroFonteIndisponivel,
  buscarTorreComPc: buscarTorreComPc,
  buscarLimitesAlerta: buscarLimitesAlerta,
  validarPermissaoUsuario: validarPermissaoUsuario,
  buscarDadosGold: buscarDadosGold,
  buscarMetricasHardware: buscarMetricasHardware,
  buscarMetricasProcessos: buscarMetricasProcessos,
  obterMetadadosFonte: obterMetadadosFonte,
  normalizarRegistroHardwareJson: normalizarRegistroHardwareJson,
  normalizarRegistroProcessoJson: normalizarRegistroProcessoJson,
  _setS3Client: _setS3Client,
  _resetS3Client: _resetS3Client,
  _limparCache: _limparCache
};
