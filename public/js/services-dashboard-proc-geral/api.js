var apiService = {
    async getJson(url) {
        const resposta = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (!resposta.ok) {
            throw new Error(`Falha ao consultar ${url} (HTTP ${resposta.status})`);
        }

        return resposta.json();
    },
};
