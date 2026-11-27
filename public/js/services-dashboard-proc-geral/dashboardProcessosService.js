var dashboardProcessosService = {
    async carregarProcessos() {
        return apiService.getJson("/dashboard-processos/processos");
    },

    async listarMineradoras(idUsuario) {
        return apiService.getJson(
            `/empresas/mineradoras/${encodeURIComponent(idUsuario || "")}`
        );
    },

    async qtdTorresAtivas(idUsuario, mineradora) {
        const filtroMineradora = mineradora && mineradora !== "-"
            ? `?mineradora=${encodeURIComponent(mineradora)}`
            : "";

        return apiService.getJson(
            `/torres/qtdTorresAtivas/${encodeURIComponent(idUsuario || "")}${filtroMineradora}`
        );
    },

    async listarTorresDisponiveis(idUsuario, mineradora) {
        const filtroMineradora = mineradora && mineradora !== "-"
            ? `?mineradora=${encodeURIComponent(mineradora)}`
            : "";

        return apiService.getJson(
            `/torres/disponiveis/${encodeURIComponent(idUsuario || "")}${filtroMineradora}`
        );
    },
};
