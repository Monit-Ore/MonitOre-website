var id = sessionStorage.ID_USUARIO;
console.log(id);

function visualizarQtdTorreAtivas(){
    fetch(`/torres/qtdTorresAtivas/${id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    })
        .then(function (resposta){
            if (resposta.ok){
                resposta.json().then(function (banco) {
                    console.log("Dados recebidos com sucesso");

                    var qtdTotal = banco.qtdTotalTorres;
                    var qtdAtiva = banco.torres_online;
                    

                    document.getElementById("qtdAtiva").innerHTML = qtdAtiva;
                    document.getElementById("qtdTorres").innerHTML = qtdTotal;
                });
            }else{
                console.log("Erro na resposta do servidor");
                
            }
        })
        .catch(function (resposta) {
            console.log("#ERRO", resposta);
        });
}

visualizarQtdTorreAtivas()