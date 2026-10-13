class RadarTICConfig {
    static get maxPregunta() { return 4000; }
    static get modos() { return ["rapido", "comparativo", "profundo"]; }

    static get baseUrl() {
        const configurado = globalThis.RADAR_TIC_BACKEND_URL;
        if (configurado) {
            const url = new URL(configurado);
            const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
            if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
                throw new Error("La dirección del backend de Radar TIC no es válida.");
            }
            return url.origin;
        }
        return globalThis.location.protocol === "file:"
            ? "http://127.0.0.1:8000"
            : globalThis.location.origin;
    }

    static endpoint(ruta) {
        if (typeof ruta !== "string" || !ruta.startsWith("/api/")) {
            throw new Error("La ruta solicitada no pertenece al backend local.");
        }
        const url = new URL(ruta, this.baseUrl);
        if (url.origin !== new URL(this.baseUrl).origin || !url.pathname.startsWith("/api/")) {
            throw new Error("La ruta solicitada no pertenece al backend local.");
        }
        return url.href;
    }
}
