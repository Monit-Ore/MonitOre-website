const express = require("express");
const router = express.Router();
const empresaController = require("../controllers/empresaController");

router.post("/cadastrar", function (req, res) {
    empresaController.cadastrar(req, res);
});

module.exports = router;