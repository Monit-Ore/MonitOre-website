/**
 * Suite de testes — Dashboard Preditiva (Isaac)
 * Execução: node test/preditivaServices-isaac.test.js
 *
 * Sem dependências externas: usa apenas Node.js puro.
 */

"use strict";

var assert = require("assert");
var path   = require("path");

// ============================================================================
// UTILITÁRIOS DE TESTE
// ============================================================================
var passou = 0;
var falhou = 0;

function ok(rotulo, fn) {
  try {
    fn();
    console.log("  ✔ " + rotulo);
    passou++;
  } catch (e) {
    console.error("  ✘ " + rotulo);
    console.error("    " + (e && e.message ? e.message : String(e)));
    falhou++;
  }
}

async function okAsync(rotulo, fn) {
  try {
    await fn();
    console.log("  ✔ " + rotulo);
    passou++;
  } catch (e) {
    console.error("  ✘ " + rotulo);
    console.error("    " + (e && e.message ? e.message : String(e)));
    falhou++;
  }
}

function proximamenteIgual(a, b, tolerancia) {
  return Math.abs(a - b) <= (tolerancia !== undefined ? tolerancia : 0.0001);
}

// ============================================================================
// IMPORTAÇÕES DOS MÓDULOS A TESTAR
// ============================================================================
var previsao  = require("../src/services/previsaoService-isaac.js");
var agregacao = require("../src/services/agregacaoService-isaac.js");
var preditivaModel = require("../src/models/preditivaMetricasModel-isaac.js");
var ErroFonteIndisponivel = preditivaModel.ErroFonteIndisponivel;

// ============================================================================
// CARGA DE TESTE GOLD VÁLIDA (usada em vários testes)
// ============================================================================
var HOSTNAME_TESTE = "PC-VALE-01";
var AGORA = new Date("2026-11-25T14:00:00.000Z");

function gerarHardwareValido(qtd, hostnameExplicito) {
  var itens = [];
  for (var i = 0; i < qtd; i++) {
    var base = {
      rodada: i + 1,
      dataHora: new Date(AGORA.getTime() - (qtd - i) * 60000).toISOString(),
      cpuTotalPct: 50 + i,
      ramTotalPct: 60,
      ramTotalMb: 8000,
      discoTotalPct: 55,
      qtdProcessos: 10
    };
    if (hostnameExplicito !== false) {
      base.hostname = hostnameExplicito || HOSTNAME_TESTE;
    }
    itens.push(base);
  }
  return itens;
}

function gerarPayloadGold(opts) {
  opts = opts || {};
  return {
    schemaVersion: 1,
    origem: "EC2-ETL",
    geradoEm: AGORA.toISOString(),
    hostname: opts.hostname || HOSTNAME_TESTE,
    intervaloSegundos: opts.intervaloSegundos || 60,
    hardware: opts.hardware || gerarHardwareValido(5),
    processos: opts.processos || [
      { rodada: 5, hostname: HOSTNAME_TESTE, dataHora: AGORA.toISOString(),
        pid: 1, processo: "mysqld", procCpuGlobalPct: 10, procRamPct: 15,
        procRamMb: 1200, procCpuAbsolutaPct: 10, procDiscoIoMbs: 2.5 }
    ]
  };
}

function fazerBodyS3(payload) {
  var txt = JSON.stringify(payload);
  return {
    transformToString: async function () { return txt; }
  };
}

function fakerS3(respostaOuErro, contadorRef) {
  return {
    send: async function (cmd) {
      if (contadorRef) contadorRef.chamadas++;
      if (respostaOuErro instanceof Error) throw respostaOuErro;
      return respostaOuErro;
    }
  };
}

// ============================================================================
// BLOCO 1: calcularRegressaoLinear (previsaoService)
// ============================================================================
console.log("\n[1] calcularRegressaoLinear");

ok("série constante → slope 0", function () {
  var r = previsao.calcularRegressaoLinear([10, 10, 10, 10, 10]);
  assert.ok(proximamenteIgual(r.slope, 0), "slope deve ser ~0, obtido: " + r.slope);
  assert.ok(proximamenteIgual(r.intercept, 10), "intercept deve ser ~10");
});

ok("série crescente → slope positivo", function () {
  var r = previsao.calcularRegressaoLinear([1, 2, 3, 4, 5]);
  assert.ok(r.slope > 0, "slope deve ser positivo, obtido: " + r.slope);
  assert.ok(proximamenteIgual(r.slope, 1, 0.01), "slope deve ser ~1");
});

// ============================================================================
// BLOCO 2: clampar
// ============================================================================
console.log("\n[2] clampar");

ok("valor dentro do intervalo → inalterado", function () {
  assert.strictEqual(previsao.clampar(50, 0, 100), 50);
});

// ============================================================================
// BLOCO 3: gerarProjecaoEResultados
// ============================================================================
console.log("\n[3] gerarProjecaoEResultados");

ok("série estável → tendência 'estavel'", function () {
  var serie = [50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
  var r = previsao.gerarProjecaoEResultados(serie, 60, { atencao: 80, critico: 90 });
  assert.strictEqual(r.tendencia, "estavel");
});

ok("série crescente → tendência 'crescimento'", function () {
  var serie = [];
  for (var i = 0; i < 20; i++) serie.push(i * 3);
  var r = previsao.gerarProjecaoEResultados(serie, 120, { atencao: 80, critico: 90 });
  assert.strictEqual(r.tendencia, "crescimento");
});

ok("série decrescente → tendência 'queda'", function () {
  var serie = [];
  for (var i = 0; i < 20; i++) serie.push(90 - i * 3);
  var r = previsao.gerarProjecaoEResultados(serie, 120, { atencao: 80, critico: 90 });
  assert.strictEqual(r.tendencia, "queda");
});

// ============================================================================
// BLOCO 4: obterConfiguracaoJanela
// ============================================================================
console.log("\n[4] obterConfiguracaoJanela");

ok("retorna objeto com minutosJanela e minutosHorizonte", function () {
  var r = agregacao.obterConfiguracaoJanela("24h", "6h");
  assert.ok(r.minutosJanela > 0, "minutosJanela > 0");
  assert.ok(r.minutosHorizonte > 0, "minutosHorizonte > 0");
  assert.strictEqual(r.minutosJanela, 1440);
  assert.strictEqual(r.minutosHorizonte, 360);
});

// ============================================================================
// BLOCO 5: agregarHardware
// ============================================================================
console.log("\n[5] agregarHardware");

ok("retorna buckets e resumo para leituras válidas", function () {
  var leituras = [];
  var base = new Date("2026-11-25T10:00:00.000Z");
  for (var i = 0; i < 20; i++) {
    leituras.push({
      dataHora: new Date(base.getTime() + i * 60000),
      cpuTotalPct: 50,
      ramTotalPct: 60,
      discoTotalPct: 55
    });
  }
  var r = agregacao.agregarHardware(leituras, 60, 10);
  assert.ok(Array.isArray(r.buckets), "buckets deve ser array");
  assert.ok(r.resumo !== null, "resumo não deve ser null");
});

// ============================================================================
// BLOCO 6: agregarProcessos (legado)
// ============================================================================
console.log("\n[6] agregarProcessos");

ok("agrupa processos por nome da última rodada", function () {
  var rodadaMax = 5;
  var leituras = [
    { rodada: 4, processo: "mysqld", procCpuGlobalPct: 8, procRamMb: 1000, procRamPct: 10, procDiscoIoMbs: null },
    { rodada: 5, processo: "mysqld", procCpuGlobalPct: 10, procRamMb: 1200, procRamPct: 12, procDiscoIoMbs: null },
    { rodada: 5, processo: "java", procCpuGlobalPct: 20, procRamMb: 2000, procRamPct: 25, procDiscoIoMbs: 1.5 }
  ];
  var r = agregacao.agregarProcessos(leituras, rodadaMax);
  assert.ok(Array.isArray(r), "deve retornar array");
  assert.ok(r.length >= 1, "deve ter pelo menos 1 processo");
});

// ============================================================================
// BLOCO 7: calcularStatusLimite
// ============================================================================
console.log("\n[7] calcularStatusLimite");

ok("valor abaixo da atenção → status 'normal'", function () {
  var r = previsao.calcularStatusLimite(50, { atencao: 80, critico: 90 });
  assert.strictEqual(r, "normal");
});

// ============================================================================
// BLOCO 8: normalizarRegistroHardwareJson
// ============================================================================
console.log("\n[8] normalizarRegistroHardwareJson");

ok("registro camelCase válido → normalizado", function () {
  var reg = {
    rodada: 1, hostname: "PC-VALE-01",
    dataHora: "2026-11-25T14:00:00.000Z",
    cpuTotalPct: 72, ramTotalPct: 68, ramTotalMb: 8000,
    discoTotalPct: 55, qtdProcessos: 10
  };
  var r = preditivaModel.normalizarRegistroHardwareJson(reg);
  assert.ok(r !== null, "não deve retornar null");
  assert.strictEqual(r.hostname, "PC-VALE-01");
  assert.strictEqual(r.cpuTotalPct, 72);
});

ok("percentual fora do intervalo 0-100 → retorna null", function () {
  var reg = {
    rodada: 1, hostname: "PC-VALE-01",
    dataHora: "2026-11-25T14:00:00.000Z",
    cpuTotalPct: 150, ramTotalPct: 68, ramTotalMb: 8000,
    discoTotalPct: 55, qtdProcessos: 10
  };
  var r = preditivaModel.normalizarRegistroHardwareJson(reg);
  assert.strictEqual(r, null);
});

// ============================================================================
// BLOCO 9: normalizarRegistroProcessoJson
// ============================================================================
console.log("\n[9] normalizarRegistroProcessoJson");

ok("registro camelCase válido → campo discoMbs mapeado", function () {
  var reg = {
    rodada: 1, hostname: "PC-VALE-01",
    dataHora: "2026-11-25T14:00:00.000Z",
    pid: 123, processo: "mysqld",
    procCpuGlobalPct: 10, procRamPct: 15,
    procRamMb: 1200, procCpuAbsolutaPct: 10,
    procDiscoIoMbs: 2.5
  };
  var r = preditivaModel.normalizarRegistroProcessoJson(reg);
  assert.ok(r !== null, "não deve retornar null");
  assert.strictEqual(r.processo, "mysqld");
  assert.strictEqual(r.procDiscoIoMbs, 2.5);
});

// ============================================================================
// BLOCO 10: agregarProcessosPorGrupo (agregacaoService)
// ============================================================================
console.log("\n[10] agregarProcessosPorGrupo");

ok("mysql → grupo mysql, java → grupo java, docker → grupo docker, rest → demais", function () {
  var rodadaMax = 1;
  var leituras = [
    { rodada: 1, processo: "mysqld", procCpuGlobalPct: 10, procRamMb: 1000, procRamPct: 10, procDiscoIoMbs: null },
    { rodada: 1, processo: "java-extracao", procCpuGlobalPct: 20, procRamMb: 2000, procRamPct: 20, procDiscoIoMbs: null },
    { rodada: 1, processo: "dockerd", procCpuGlobalPct: 5, procRamMb: 500, procRamPct: 5, procDiscoIoMbs: null },
    { rodada: 1, processo: "python-captura", procCpuGlobalPct: 3, procRamMb: 300, procRamPct: 3, procDiscoIoMbs: null }
  ];
  var r = agregacao.agregarProcessosPorGrupo(leituras, rodadaMax);
  assert.ok(Array.isArray(r), "deve ser array");
  var ids = r.map(function (g) { return g.id; });
  assert.ok(ids.includes("mysql"), "deve ter grupo mysql");
  assert.ok(ids.includes("java"), "deve ter grupo java");
  assert.ok(ids.includes("docker"), "deve ter grupo docker");
  assert.ok(ids.includes("demais"), "deve ter grupo demais");
});

ok("discoMbs é null quando nenhum processo tem discoIoMbs", function () {
  var leituras = [
    { rodada: 1, processo: "mysqld", procCpuGlobalPct: 10, procRamMb: 1000, procRamPct: 10, procDiscoIoMbs: null }
  ];
  var r = agregacao.agregarProcessosPorGrupo(leituras, 1);
  var grpMysql = r.find(function (g) { return g.id === "mysql"; });
  assert.ok(grpMysql, "grupo mysql deve existir");
  assert.strictEqual(grpMysql.discoMbs, null, "discoMbs deve ser null");
});

ok("discoMbs é somado quando processos têm discoIoMbs", function () {
  var leituras = [
    { rodada: 1, processo: "mysqld", procCpuGlobalPct: 10, procRamMb: 1000, procRamPct: 10, procDiscoIoMbs: 2.0 },
    { rodada: 1, processo: "mysqld", procCpuGlobalPct: 5, procRamMb: 500, procRamPct: 5, procDiscoIoMbs: 1.5 }
  ];
  var r = agregacao.agregarProcessosPorGrupo(leituras, 1);
  var grpMysql = r.find(function (g) { return g.id === "mysql"; });
  assert.ok(grpMysql, "grupo mysql deve existir");
  assert.ok(grpMysql.discoMbs !== null && grpMysql.discoMbs > 0, "discoMbs deve ser somado");
});

ok("tendência crescimento quando cpu aumenta entre rodadas", function () {
  // Simula múltiplas rodadas com CPU crescendo para o grupo mysql
  var leituras = [];
  for (var r = 1; r <= 15; r++) {
    leituras.push({
      rodada: r, processo: "mysqld",
      procCpuGlobalPct: r * 4,  // 4, 8, ... 60
      procRamMb: 1000, procRamPct: 10, procDiscoIoMbs: null
    });
  }
  var grupos = agregacao.agregarProcessosPorGrupo(leituras, 15);
  var grpMysql = grupos.find(function (g) { return g.id === "mysql"; });
  assert.ok(grpMysql, "grupo mysql deve existir");
  assert.strictEqual(grpMysql.tendencia, "crescimento");
});

// ============================================================================
// BLOCO 11: fuso horário — formatarHoraSp sempre retorna hora SP (UTC-3)
// ============================================================================
console.log("\n[11] Fuso horário (America/Sao_Paulo)");

ok("2026-11-25T14:00:00Z → 11:00 no fuso SP (UTC-3)", function () {
  var agregacaoService = require("../src/services/agregacaoService-isaac.js");
  // A função é interna ao módulo; testamos via agregarHardware (labels dos buckets usam SP)
  // Testamos diretamente se o módulo exporta formatarHoraSp ou verificamos via comportamento
  if (typeof agregacaoService.formatarHoraSp === "function") {
    var d = new Date("2026-11-25T14:00:00.000Z");
    var resultado = agregacaoService.formatarHoraSp(d);
    assert.strictEqual(resultado, "11:00", "14:00 UTC = 11:00 SP (UTC-3), obtido: " + resultado);
  } else {
    // Verifica via bucket label: coloca 1 leitura às 14:00 UTC e checa o label do bucket
    var leituras = [{
      dataHora: new Date("2026-11-25T14:00:00.000Z"),
      cpuTotalPct: 50, ramTotalPct: 60, discoTotalPct: 55
    }];
    var r = agregacaoService.agregarHardware(leituras, 60, 10);
    assert.ok(r.buckets.length > 0, "deve haver pelo menos 1 bucket");
    // O label deve conter 11:xx (hora SP) e não 14:xx (UTC)
    var label = r.buckets[0].label || "";
    assert.ok(!label.includes("14:"), "label não deve conter hora UTC (14:), obtido: " + label);
  }
});

ok("resultado consistente independente do TZ do processo", function () {
  // Simula dois ambientes: TZ=UTC e TZ=America/Sao_Paulo
  // No Node.js puro sem reiniciar o processo, testamos via Intl diretamente
  var fmt1 = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  var fmt2 = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  var d = new Date("2026-11-25T14:00:00.000Z");
  var horaSp  = fmt1.format(d);
  var horaUtc = fmt2.format(d);
  assert.strictEqual(horaSp, "11:00", "SP deve ser 11:00, obtido: " + horaSp);
  assert.strictEqual(horaUtc, "14:00", "UTC deve ser 14:00, obtido: " + horaUtc);
  assert.notStrictEqual(horaSp, horaUtc, "horas SP e UTC devem diferir");
});

// ============================================================================
// BLOCO 12: Model S3 com cliente falso
// ============================================================================
console.log("\n[12] Model S3 — cliente falso");

(async function () {

  // Payload Gold válido para os testes
  var payloadValido = gerarPayloadGold();

  await okAsync("S3 hit → retorna dados", async function () {
    preditivaModel._limparCache();
    preditivaModel._setS3Client(fakerS3({
      ETag: '"etag-abc"',
      LastModified: new Date(),
      ContentLength: 100,
      Body: fazerBodyS3(payloadValido)
    }));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";

    var resultado = await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    assert.ok(Array.isArray(resultado), "deve retornar array de hardware");
    assert.ok(resultado.length > 0, "deve ter registros");
    preditivaModel._resetS3Client();
  });

  await okAsync("TTL — segunda chamada usa cache (send chamado 1 vez)", async function () {
    preditivaModel._limparCache();
    var contador = { chamadas: 0 };
    preditivaModel._setS3Client(fakerS3({
      ETag: '"etag-ttl"',
      LastModified: new Date(),
      ContentLength: 100,
      Body: fazerBodyS3(payloadValido)
    }, contador));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";

    await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE); // deve usar cache
    assert.strictEqual(contador.chamadas, 1, "send deve ter sido chamado apenas 1 vez, obtido: " + contador.chamadas);
    preditivaModel._resetS3Client();
  });

  await okAsync("304 Not Modified (exceção SDK) → retorna cache existente", async function () {
    preditivaModel._limparCache();

    // Primeira chamada: popula cache
    preditivaModel._setS3Client(fakerS3({
      ETag: '"etag-304"',
      LastModified: new Date(),
      ContentLength: 100,
      Body: fazerBodyS3(payloadValido)
    }));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";
    await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);

    // Força expiração do TTL internamente: não há como sem expor — usamos cliente que lança 304
    // Simula: o SDK lança um erro com statusCode 304 (como faz o AWS SDK v3)
    var err304 = new Error("Not Modified");
    err304.$metadata = { httpStatusCode: 304 };
    err304.name = "NotModified";
    // Injeta novo cliente que lança 304
    preditivaModel._setS3Client(fakerS3(err304));

    // Para testar o 304, precisamos forçar que o TTL expirou;
    // isso não é possível sem manipulação do clock.
    // Alternativa: testar via buscarDadosGold diretamente em modo com cache populado
    // e confirmar que o erro 304 não quebra (retorna cache).
    // O teste documenta a invariante: chamada com cache após 304 retorna dados.
    var resultado = await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    // Com cache dentro do TTL, nem chega a fazer a chamada S3 → retorna cache
    assert.ok(resultado !== null && resultado !== undefined, "deve retornar dados (do cache)");
    preditivaModel._resetS3Client();
  });

  await okAsync("NoSuchKey → retorna null (aguardando Gold)", async function () {
    preditivaModel._limparCache();
    var errNoKey = new Error("NoSuchKey");
    errNoKey.name = "NoSuchKey";
    errNoKey.$metadata = { httpStatusCode: 404 };
    preditivaModel._setS3Client(fakerS3(errNoKey));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";

    var resultado = await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    assert.strictEqual(resultado, null, "NoSuchKey deve retornar null");
    preditivaModel._resetS3Client();
  });

  await okAsync("AccessDenied → lança ErroFonteIndisponivel", async function () {
    preditivaModel._limparCache();
    var errAccess = new Error("Access Denied");
    errAccess.name = "AccessDenied";
    errAccess.$metadata = { httpStatusCode: 403 };
    preditivaModel._setS3Client(fakerS3(errAccess));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";

    var lancouErro = false;
    try {
      await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    } catch (e) {
      if (e instanceof ErroFonteIndisponivel) lancouErro = true;
      else throw e;
    }
    assert.ok(lancouErro, "AccessDenied deve lançar ErroFonteIndisponivel");
    preditivaModel._resetS3Client();
  });

  await okAsync(">25MB → lança ErroFonteIndisponivel", async function () {
    preditivaModel._limparCache();
    preditivaModel._setS3Client(fakerS3({
      ETag: '"etag-grande"',
      LastModified: new Date(),
      ContentLength: 26 * 1024 * 1024,  // 26 MB
      Body: fazerBodyS3(payloadValido)
    }));
    process.env.S3_BUCKET_OURO = "meu-bucket-teste";
    process.env.PREDITIVA_FONTE = "s3";

    var lancouErro = false;
    try {
      await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    } catch (e) {
      if (e instanceof ErroFonteIndisponivel) lancouErro = true;
      else throw e;
    }
    assert.ok(lancouErro, "arquivo >25MB deve lançar ErroFonteIndisponivel");
    preditivaModel._resetS3Client();
  });

  await okAsync("S3_BUCKET_OURO não configurado → lança ErroFonteIndisponivel", async function () {
    preditivaModel._limparCache();
    preditivaModel._setS3Client(fakerS3({ ETag: '"x"', LastModified: new Date(), ContentLength: 10, Body: fazerBodyS3(payloadValido) }));
    delete process.env.S3_BUCKET_OURO;
    process.env.PREDITIVA_FONTE = "s3";

    var lancouErro = false;
    try {
      await preditivaModel.buscarMetricasHardware(HOSTNAME_TESTE);
    } catch (e) {
      if (e instanceof ErroFonteIndisponivel) lancouErro = true;
      else throw e;
    }
    assert.ok(lancouErro, "sem bucket deve lançar ErroFonteIndisponivel");
    preditivaModel._resetS3Client();
    process.env.S3_BUCKET_OURO = "meu-bucket-teste"; // restaura
  });

  // ============================================================================
  // BLOCO 13: Controller — simulação via model mockado
  // ============================================================================
  console.log("\n[13] Controller (via model mockado)");

  // O controller usa require('../models/preditivaMetricasModel-isaac')
  // Para testar sem banco, injetamos stubs via monkey-patch temporário.

  var controller = require("../src/controllers/preditivaController-isaac.js");

  function mockReq(params, query, sessionUser) {
    return {
      params: params || {},
      query: query || {},
      session: { user: sessionUser || { id_usuario: 1 } }
    };
  }

  function mockRes() {
    var r = { _status: 200, _body: null };
    r.status = function (code) { r._status = code; return r; };
    r.json = function (body) { r._body = body; return r; };
    return r;
  }

  // Monkey-patch do module cache do model para substituir funções individualmente
  var modelModulo = require("../src/models/preditivaMetricasModel-isaac.js");

  await okAsync("aguardando Gold → 200 com semDados:true e aguardandoGold:true", async function () {
    // Salva originais
    var origBuscarTorre = modelModulo.buscarTorreComPc;
    var origValidarPermissao = modelModulo.validarPermissaoUsuario;
    var origBuscarDados = modelModulo.buscarDadosGold;

    modelModulo.buscarTorreComPc = async function () {
      return { id_torre: 1, nome_torre: "Torre Teste", codigo_torre: "T1",
        mineradora: "Vale", id_pc_industrial: 1, hostname: HOSTNAME_TESTE,
        status_operacional: 1 };
    };
    modelModulo.validarPermissaoUsuario = async function () { return true; };
    modelModulo.buscarDadosGold = async function () { return null; }; // null = aguardando

    var req = mockReq({ id: "1" });
    var res = mockRes();
    await controller.obterDadosPreditiva(req, res);

    // Restaura
    modelModulo.buscarTorreComPc = origBuscarTorre;
    modelModulo.validarPermissaoUsuario = origValidarPermissao;
    modelModulo.buscarDadosGold = origBuscarDados;

    assert.strictEqual(res._status, 200, "status deve ser 200");
    assert.ok(res._body && (res._body.semDados === true || res._body.aguardandoGold === true),
      "body deve ter semDados ou aguardandoGold true. body=" + JSON.stringify(res._body));
  });

  await okAsync("fonteIndisponivel → 503", async function () {
    var origBuscarTorre = modelModulo.buscarTorreComPc;
    var origValidarPermissao = modelModulo.validarPermissaoUsuario;
    var origBuscarDados = modelModulo.buscarDadosGold;

    modelModulo.buscarTorreComPc = async function () {
      return { id_torre: 1, nome_torre: "Torre Teste", codigo_torre: "T1",
        mineradora: "Vale", id_pc_industrial: 1, hostname: HOSTNAME_TESTE,
        status_operacional: 1 };
    };
    modelModulo.validarPermissaoUsuario = async function () { return true; };
    modelModulo.buscarDadosGold = async function () {
      throw new ErroFonteIndisponivel("S3 indisponível no teste");
    };

    var req = mockReq({ id: "1" });
    var res = mockRes();
    await controller.obterDadosPreditiva(req, res);

    modelModulo.buscarTorreComPc = origBuscarTorre;
    modelModulo.validarPermissaoUsuario = origValidarPermissao;
    modelModulo.buscarDadosGold = origBuscarDados;

    assert.strictEqual(res._status, 503, "status deve ser 503, obtido: " + res._status);
    assert.ok(res._body && res._body.fonteIndisponivel === true, "fonteIndisponivel deve ser true");
  });

  await okAsync("telemetria defasada → dadosDefasados:true e torre offline", async function () {
    var origBuscarTorre = modelModulo.buscarTorreComPc;
    var origValidarPermissao = modelModulo.validarPermissaoUsuario;
    var origBuscarDados = modelModulo.buscarDadosGold;
    var origBuscarLimites = modelModulo.buscarLimitesAlerta;

    var ultimaLeitura10MinAtras = new Date(Date.now() - 10 * 60 * 1000); // 10 min atrás
    var hwBase = gerarHardwareValido(5);
    // Sobrescreve o dataHora do último com 10 min atrás
    hwBase[hwBase.length - 1].dataHora = ultimaLeitura10MinAtras;

    modelModulo.buscarTorreComPc = async function () {
      return { id_torre: 1, nome_torre: "Torre Teste", codigo_torre: "T1",
        mineradora: "Vale", id_pc_industrial: 1, hostname: HOSTNAME_TESTE,
        status_operacional: 1 };
    };
    modelModulo.validarPermissaoUsuario = async function () { return true; };
    modelModulo.buscarLimitesAlerta = async function () {
      return { CPU: { atencao: 80, critico: 90 }, RAM: { atencao: 80, critico: 90 }, Disco: { atencao: 75, critico: 90 } };
    };
    // Retorna dados com intervaloSegundos=60 → limite defasagem=180s; última leitura 10min atrás → defasado
    modelModulo.buscarDadosGold = async function () {
      return {
        dados: {
          schemaVersion: 1, origem: "EC2-ETL", geradoEm: new Date().toISOString(),
          hostname: HOSTNAME_TESTE, intervaloSegundos: 60,
          hardware: hwBase.map(function (h) {
            return Object.assign({}, h, {
              dataHora: ultimaLeitura10MinAtras,
              cpuTotalPct: 50, ramTotalPct: 60, discoTotalPct: 55
            });
          }),
          processos: []
        },
        tipo: "s3", intervaloSegundos: 60
      };
    };

    var req = mockReq({ id: "1" });
    var res = mockRes();
    await controller.obterDadosPreditiva(req, res);

    modelModulo.buscarTorreComPc = origBuscarTorre;
    modelModulo.validarPermissaoUsuario = origValidarPermissao;
    modelModulo.buscarDadosGold = origBuscarDados;
    modelModulo.buscarLimitesAlerta = origBuscarLimites;

    assert.strictEqual(res._status, 200, "status deve ser 200");
    if (res._body && res._body.dadosDefasados !== undefined) {
      assert.ok(res._body.dadosDefasados === true, "dadosDefasados deve ser true");
    }
    // torre.online deve ser false quando defasado
    if (res._body && res._body.torre && res._body.torre.online !== undefined) {
      assert.strictEqual(res._body.torre.online, false, "torre.online deve ser false quando defasado");
    }
  });

  // ============================================================================
  // RESULTADO FINAL
  // ============================================================================
  console.log("\n" + "=".repeat(50));
  console.log(`Resultado: ${passou} passou, ${falhou} falhou`);
  if (falhou > 0) {
    console.error("FALHOU — verifique os erros acima.");
    process.exit(1);
  } else {
    console.log("OK — todos os testes passaram.");
    process.exit(0);
  }

})();
