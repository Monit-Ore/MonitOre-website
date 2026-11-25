const express = require("express");
const router = express.Router();
const empresaController = require("../controllers/empresaController");

router.post("/cadastrar", function (req, res) {
    empresaController.cadastrar(req, res);
});

router.get("/mineradoras/:id", function(req,res) {
    empresaController.listarMineradoras(req,res)
})

module.exports = router;