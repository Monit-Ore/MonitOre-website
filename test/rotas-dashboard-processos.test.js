const test = require("node:test");
const assert = require("node:assert/strict");

const router = require("../src/routes/torres");

test("as rotas de torres usadas pelos filtros da dashboard de processos continuam registradas", () => {
  const rotas = router.stack
    .filter(function (camada) {
      return Boolean(camada.route);
    })
    .map(function (camada) {
      const metodo = Object.keys(camada.route.methods)[0].toUpperCase();
      return `${metodo} ${camada.route.path}`;
    });

  assert.ok(
    rotas.includes("GET /qtdTorresAtivas/:id"),
    "rota da KPI de torres ativas ausente",
  );
  assert.ok(
    rotas.includes("GET /disponiveis/:id"),
    "rota do filtro de torres disponíveis ausente",
  );
});
