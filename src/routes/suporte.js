const express = require("express");
const router = express.Router();
const suporteController = require("../controllers/suporteController");

// Endereço público mantido: GET /suporte/buscar.
router.get("/buscar", suporteController.buscarCaptura);
router.get("/status-jira", suporteController.buscarStatusJira);

module.exports = router;
