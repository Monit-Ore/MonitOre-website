var express = require("express");
var router = express.Router();
var preditivaController = require("../controllers/preditivaController-isaac");

/**
 * Rotas da Dashboard Preditiva (Beeling) - Isaac
 * 
 * Arquitetura baseada em pull direto do JSON tratado da camada Gold (S3 / local).
 * As rotas antigas de ingestão POST foram descontinuadas.
 */

// Rota principal para obtenção de dados e projeções preditivas
router.get("/:idTorre", function (req, res) {
  preditivaController.obterDadosPreditiva(req, res);
});

module.exports = router;
