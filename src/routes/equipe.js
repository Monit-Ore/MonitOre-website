var express = require("express");
var router = express.Router();

var equipeController = require("../controllers/equipeController");

router.get("/CaptarEquipe" , function(req, res) {
    equipeController.CaptarEquipe(req, res);
})

module.exports = router;