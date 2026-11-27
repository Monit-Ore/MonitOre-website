const express = require("express");
const router = express.Router();
const suporteController = require("../controllers/suporteController");

// Endereço público mantido: GET /suporte/buscar.
router.get("/buscar", suporteController.buscarCaptura);

module.exports = router;