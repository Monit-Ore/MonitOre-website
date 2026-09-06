async function CarregarEstilos() {

    await fetch('/equipe/CaptarEquipe').then(function (resposta) {
        if(resposta.ok) {
            resposta.json().then(function (resposta) {

                for (let i = 0; i < resposta.length; i++) {

                    EquipeMembrosLayout.innerHTML += `
                    <div class="card">
                        <div class="cardImg">
                            <img src="${resposta[i].caminhoFoto}" alt="">
                        </div>
                        <p class="cardNome">${resposta[i].nome}</p>
                        <p class="cardCargo">${resposta[i].cargo}</p>
                        <hr class="LinhaAmarela">
                        <p class="cardDescricao">${resposta[i].descricao}</p>
                        <div class="cardRedesSociais">
                            <a href="${resposta[i].githubUrl}"><img src="imgs/GithubLogo.svg" alt="Linkedin"></a>
                            <a href="${resposta[i].linkedinUrl}"><img src="imgs/LinkedinLogo.svg" alt="Github"></a>
                            <a href="${resposta[i].email}"><img src="imgs/EmailIcon.svg" alt="Emaii"></a>
                        </div>
                    </div>
                    `
                }

            })
        }
    })
}