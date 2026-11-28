const express = require("express");
const router = express.Router();
const empresaController = require("../controllers/mineradoraController");

router.get("/buscar", function (req,res) {
    empresaController.buscarMineradoras(req,res);
});

module.exports = router;