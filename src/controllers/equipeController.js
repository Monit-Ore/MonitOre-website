var equipeModel = require("../models/equipeModel");

function CaptarEquipe(req, res) {
    equipeModel.CaptarEquipe().then((resultado) => {
        res.status(200).json(resultado);
    });
}

module.exports = {
    CaptarEquipe
}