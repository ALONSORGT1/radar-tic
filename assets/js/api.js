class RadarTICApi {
    constructor(config = RadarTICConfig, fetchImpl = globalThis.fetch.bind(globalThis)) {
        this.config = config;
        this.fetch = fetchImpl;
        this.codigoAcceso = "";
    }

    async salud() {
        return this.pedirJSON("/api/salud");
    }

    async pedir(ruta, opciones) {
        try {
            const headers = { ...(opciones?.headers || {}) };
            if (this.codigoAcceso) headers.Authorization = "Bearer " + this.codigoAcceso;
            return await this.fetch(this.config.endpoint(ruta), { ...opciones, headers });
        } catch (error) {
            if (error.name === "AbortError") throw error;
            throw new Error("No se pudo conectar con FastAPI. Comprueba la disponibilidad del servidor y la conexión a Internet.");
        }
    }

    async comprobarHTTP(respuesta) {
        if (respuesta.ok) return;
        let mensaje = "El servidor respondió con error HTTP " + respuesta.status + ".";
        try {
            const cuerpo = await respuesta.json();
            if (typeof cuerpo.detail === "string") mensaje = cuerpo.detail;
        } catch {}
        throw new Error(mensaje);
    }

    async pedirJSON(ruta, opciones) {
        const respuesta = await this.pedir(ruta, opciones);
        await this.comprobarHTTP(respuesta);
        try { return await respuesta.json(); }
        catch { throw new Error("El servidor devolvió un JSON inválido."); }
    }

    async exportar(reporte) {
        const archivo = await this.pedirJSON("/api/reportes/exportar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reporte)
        });
        if (!archivo || typeof archivo.nombre !== "string" || typeof archivo.url !== "string" ||
            !/^\/api\/reportes\/[a-zA-Z0-9_-]+\/descargar$/.test(archivo.url)) {
            throw new Error("El servidor no devolvió un archivo de descarga válido.");
        }
        return { ...archivo, url: this.config.endpoint(archivo.url) };
    }

    async descargar(reporte) {
        const host = new URL(this.config.baseUrl).hostname;
        if (["localhost", "127.0.0.1", "[::1]"].includes(host) && !this.codigoAcceso) {
            return this.exportar(reporte);
        }
        const respuesta = await this.pedir("/api/reportes/descargar", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reporte)
        });
        await this.comprobarHTTP(respuesta);
        if (!respuesta.headers.get("content-type")?.includes("text/markdown")) {
            throw new Error("El servidor no devolvió un reporte Markdown.");
        }
        const cabecera = respuesta.headers.get("content-disposition") || "";
        const nombre = /filename="(radar-tic-[a-zA-Z0-9_-]+\.md)"/.exec(cabecera)?.[1] || "radar-tic-reporte.md";
        return { nombre, blob: await respuesta.blob() };
    }

    comprobarCancelacion(signal) {
        if (!signal?.aborted) return;
        const error = new Error("Investigación cancelada.");
        error.name = "AbortError";
        throw error;
    }

    async investigar(solicitud, { signal, onEvento }) {
        this.comprobarCancelacion(signal);
        const respuesta = await this.pedir("/api/investigar", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify(solicitud),
            signal
        });
        await this.comprobarHTTP(respuesta);
        if (!respuesta.headers.get("content-type")?.includes("text/event-stream")) {
            throw new Error("El servidor devolvió una respuesta inesperada.");
        }
        if (!respuesta.body) throw new Error("El navegador no pudo abrir el flujo de datos.");

        const reader = respuesta.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let terminado = false;
        const procesar = bloque => {
            this.comprobarCancelacion(signal);
            const evento = this.parsearEvento(bloque);
            if (!evento) return;
            if (evento.tipo === "completado") this.validarResultado(evento.contenido);
            if (evento.tipo === "texto" && typeof evento.contenido.delta !== "string") {
                throw new Error("El servidor devolvió un fragmento de texto inválido.");
            }
            onEvento(evento.tipo, evento.contenido);
            if (evento.tipo === "error") {
                throw new Error(evento.contenido.mensaje || "La investigación se interrumpió.");
            }
            if (evento.tipo === "completado") terminado = true;
        };

        try {
            while (!terminado) {
                const { value, done } = await reader.read();
                this.comprobarCancelacion(signal);
                if (done) {
                    buffer += decoder.decode();
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const bloques = buffer.split(/\r?\n\r?\n/);
                buffer = bloques.pop();
                for (const bloque of bloques) {
                    procesar(bloque);
                    if (terminado) break;
                }
            }
            if (!terminado && buffer.trim()) procesar(buffer);
            if (!terminado) {
                throw new Error("La conexión terminó antes de completar la investigación. Inténtalo de nuevo.");
            }
        } finally {
            try { await reader.cancel(); } catch {}
            reader.releaseLock();
        }
    }

    parsearEvento(bloque) {
        let tipo = "message";
        const datos = [];
        for (const linea of bloque.split(/\r?\n/)) {
            if (linea.startsWith("event:")) tipo = linea.slice(6).trim();
            if (linea.startsWith("data:")) datos.push(linea.slice(5).trimStart());
        }
        if (!datos.length) return null;
        try {
            const contenido = JSON.parse(datos.join("\n"));
            if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) throw new Error();
            return { tipo, contenido };
        } catch {
            throw new Error("Se recibió un evento inválido del servidor.");
        }
    }

    validarResultado(contenido) {
        if (typeof contenido.reporte !== "string" || !contenido.reporte.trim()) {
            throw new Error("El servidor terminó sin contenido de investigación. Inténtalo de nuevo.");
        }
        for (const campo of ["pregunta", "resumen", "comparacion", "conclusion"]) {
            if (contenido[campo] !== undefined && typeof contenido[campo] !== "string") {
                throw new Error("El reporte recibido no cumple el contrato de FastAPI.");
            }
        }
        for (const campo of ["plan", "coincidencias", "diferencias", "tendencias"]) {
            if (contenido[campo] !== undefined && (!Array.isArray(contenido[campo]) ||
                !contenido[campo].every(item => typeof item === "string"))) {
                throw new Error("El reporte recibido no cumple el contrato de FastAPI.");
            }
        }
        for (const campo of ["fuentes", "hallazgos"]) {
            if (contenido[campo] !== undefined && (!Array.isArray(contenido[campo]) ||
                !contenido[campo].every(item => item && typeof item === "object" && !Array.isArray(item) &&
                    (campo === "fuentes"
                        ? typeof item.url === "string" && typeof item.titulo === "string"
                        : typeof item.nombre === "string" && typeof item.descripcion === "string")))) {
                throw new Error("El reporte recibido no cumple el contrato de FastAPI.");
            }
        }
    }
}
