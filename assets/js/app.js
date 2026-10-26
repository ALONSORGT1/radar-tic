const btnInvestigar = document.getElementById("btnInvestigar");
const pregunta = document.getElementById("pregunta");

const actividad = document.getElementById("actividad");
const estadoActual = document.getElementById("estadoActual");
const previewContent = document.getElementById("previewContent");

const fuentesEnVivo = document.getElementById("fuentesEnVivo");
const fuentesFinales = document.getElementById("fuentesFinales");
const contadorFuentes = document.getElementById("contadorFuentes");
const contadorFuentesFinal = document.getElementById("contadorFuentesFinal");

const resultado = document.getElementById("resultado");
const reporte = document.getElementById("reporte");
const error = document.getElementById("error");

let fuentesConsultadas = [];
let reporteCompleto = "";
let etapasRecibidas = new Set();

const modo = document.getElementById("modo");
const usarWeb = document.getElementById("usarWeb");
const btnCancelar = document.getElementById("btnCancelar");
const btnDescargar = document.getElementById("btnDescargar");
const servidorEstado = document.getElementById("servidorEstado");
const metadatosResultado = document.getElementById("metadatosResultado");
const contenedorAcceso = document.getElementById("contenedorAcceso");
const codigoAcceso = document.getElementById("codigoAcceso");
const btnNuevaInvestigacion = document.getElementById("btnNuevaInvestigacion");
const contadorPregunta = document.getElementById("contadorPregunta");

class RadarTICApp {
  constructor(api = new RadarTICApi()) {
    this.api = api;
    this.controlador = null;
    this.ultimoResultado = null;
    this.descargando = false;
    this.requiereAcceso = false;
    this.etiquetaInvestigar = btnInvestigar.innerHTML;
    btnInvestigar.addEventListener("click", () => this.investigar());
    btnCancelar.addEventListener("click", () => this.controlador?.abort());
    btnDescargar.addEventListener("click", () => this.descargar());
    this.inicializarWorkspace();
    this.comprobarServidor();
  }

  inicializarWorkspace() {
    inicializarTema();
    inicializarNavegacion();
    actualizarContadorPregunta();
    pregunta.addEventListener("input", actualizarContadorPregunta);
    pregunta.addEventListener("keydown", (evento) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key === "Enter") {
        evento.preventDefault();
        return this.investigar();
      }
    });
    document.querySelectorAll("[data-pregunta]").forEach((boton) => {
      boton.addEventListener("click", () => {
        if (this.controlador) return;
        pregunta.value = boton.dataset.pregunta;
        actualizarContadorPregunta();
        pregunta.focus();
      });
    });
    btnNuevaInvestigacion?.addEventListener("click", () =>
      this.nuevaInvestigacion(),
    );
  }

  nuevaInvestigacion() {
    if (this.controlador || this.descargando) return;
    this.ultimoResultado = null;
    fuentesConsultadas = [];
    reporteCompleto = "";
    pregunta.value = "";
    reporte.innerHTML = "";
    fuentesEnVivo.innerHTML = "";
    fuentesFinales.innerHTML = "";
    metadatosResultado.textContent = "";
    [actividad, resultado, error].forEach((elemento) =>
      elemento.classList.add("d-none"),
    );
    btnDescargar.disabled = true;
    actualizarContadores();
    actualizarContadorPregunta();
    cambiarEstadoWorkspace("idle");
    document
      .getElementById("consulta")
      ?.scrollIntoView({ behavior: comportamientoScroll(), block: "start" });
    pregunta.focus({ preventScroll: true });
  }

  async comprobarServidor() {
    servidorEstado.dataset.estado = "pending";
    try {
      const salud = await this.api.salud();
      this.requiereAcceso = !!salud.requiere_acceso;
      contenedorAcceso.classList.toggle("d-none", !this.requiereAcceso);
      servidorEstado.textContent = salud.configurado
        ? "Servidor listo · Modelo: " + salud.modelo
        : "Falta configurar la credencial en el servidor.";
      servidorEstado.dataset.estado = salud.configurado ? "ready" : "error";
    } catch {
      servidorEstado.textContent =
        "No se pudo contactar con el servidor de Radar TIC.";
      servidorEstado.dataset.estado = "error";
    }
  }

  async investigar() {
    if (this.controlador) return;
    const texto = pregunta.value.trim();
    if (!texto) {
      pregunta.focus();
      return mostrarError("Escribe una pregunta de investigación.");
    }
    if (Array.from(texto).length > RadarTICConfig.maxPregunta) {
      pregunta.focus();
      return mostrarError(
        "La pregunta debe tener como máximo 4000 caracteres.",
      );
    }
    if (!RadarTICConfig.modos.includes(modo.value)) {
      modo.focus();
      return mostrarError("Selecciona un modo de investigación válido.");
    }
    if (this.requiereAcceso && !codigoAcceso.value.trim()) {
      codigoAcceso.focus();
      return mostrarError("Introduce el código privado de acceso a Radar TIC.");
    }
    this.api.codigoAcceso = this.requiereAcceso
      ? codigoAcceso.value.trim()
      : "";
    prepararInterfaz();
    this.ultimoResultado = null;
    this.controlador = new AbortController();
    this.bloquear(true);
    try {
      await this.api.investigar(
        {
          pregunta: texto,
          modo: modo.value,
          usar_web: usarWeb.checked,
        },
        {
          signal: this.controlador.signal,
          onEvento: (tipo, contenido) => {
            if (tipo === "completado") {
              fuentesConsultadas = normalizarFuentes(
                contenido.fuentes || fuentesConsultadas,
              );
              actualizarContadores();
              const fecha = contenido.fecha
                ? new Date(contenido.fecha).toLocaleString("es-MX")
                : "";
              metadatosResultado.textContent = [
                fecha,
                "Modo: " + contenido.modo,
                contenido.usar_web ? "Con búsqueda web" : "Sin búsqueda web",
                "Modelo: " + contenido.modelo,
                "Tokens: " + (contenido.uso?.total || 0),
              ]
                .filter(Boolean)
                .join(" · ");
            }
            procesarEvento(tipo, contenido);
            if (tipo === "completado") {
              this.ultimoResultado = contenido;
              btnDescargar.disabled = this.descargando;
            }
          },
        },
      );
    } catch (err) {
      this.ultimoResultado = null;
      btnDescargar.disabled = true;
      resultado.classList.add("d-none");
      mostrarError(
        err.name === "AbortError" ? "Investigación cancelada." : err.message,
        true,
      );
      cambiarEstadoWorkspace("error");
    } finally {
      this.controlador = null;
      this.bloquear(false);
    }
  }

  bloquear(bloqueado) {
    btnInvestigar.disabled = bloqueado;
    btnInvestigar.innerHTML = bloqueado
      ? '<i class="bi bi-hourglass-split" aria-hidden="true"></i><span>Investigando…</span>'
      : this.etiquetaInvestigar;
    pregunta.disabled = bloqueado;
    modo.disabled = bloqueado;
    usarWeb.disabled = bloqueado;
    codigoAcceso.disabled = bloqueado;
    if (btnNuevaInvestigacion)
      btnNuevaInvestigacion.disabled = bloqueado || this.descargando;
    document.querySelectorAll("[data-pregunta]").forEach((boton) => {
      boton.disabled = bloqueado;
    });
    btnCancelar.classList.toggle("d-none", !bloqueado);
    actividad.setAttribute("aria-busy", String(bloqueado));
  }

  async descargar() {
    if (!this.ultimoResultado || this.descargando || this.controlador) return;
    this.descargando = true;
    btnDescargar.disabled = true;
    if (btnNuevaInvestigacion) btnNuevaInvestigacion.disabled = true;
    try {
      const archivo = await this.api.descargar(this.ultimoResultado);
      const url = archivo.url || URL.createObjectURL(archivo.blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = archivo.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      if (!archivo.url) setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      mostrarError(err.message);
    } finally {
      this.descargando = false;
      btnDescargar.disabled = !!this.controlador || !this.ultimoResultado;
      if (btnNuevaInvestigacion)
        btnNuevaInvestigacion.disabled = !!this.controlador;
    }
  }
}

function procesarEvento(tipo, contenido) {
  if (
    tipo === "error" &&
    [
      "fuera_de_especialidad",
      "especialidad_ambigua",
      "especialidad_no_verificada",
    ].includes(contenido.codigo)
  ) {
    actividad.classList.add("d-none");
  }
  if (tipo === "estado") actualizarEstado(contenido.etapa, contenido.mensaje);
  if (tipo === "fuente") agregarFuente(contenido);
  if (tipo === "texto") {
    reporteCompleto += contenido.delta;
    actualizarPreview(reporteCompleto);
  }
  if (tipo === "completado") {
    reporteCompleto = contenido.reporte || reporteCompleto;
    finalizarFlujo(contenido);
  }
}

function prepararInterfaz() {
  cambiarEstadoWorkspace("processing");
  fuentesConsultadas = [];
  reporteCompleto = "";
  etapasRecibidas.clear();

  error.classList.add("d-none");
  btnDescargar.disabled = true;
  metadatosResultado.textContent = "";
  resultado.classList.add("d-none");
  actividad.classList.remove("d-none");

  fuentesEnVivo.innerHTML = `
        <div id="sinFuentes" class="empty-sources">
            Las fuentes aparecerán aquí conforme el agente vaya consultándolas.
        </div>
    `;

  fuentesFinales.innerHTML = "";
  reporte.innerHTML = "";

  contadorFuentes.textContent = "0";
  contadorFuentesFinal.textContent = "0";

  previewContent.textContent =
    "El borrador aparecerá aquí mientras el agente redacta.";

  actualizarEstado(
    "validando",
    "Comprobando que la pregunta pertenece a TIC...",
  );

  btnInvestigar.disabled = true;
}

function actualizarEstado(etapa, mensaje) {
  estadoActual.textContent = mensaje;
  etapasRecibidas.add(etapa);

  const pasos = Array.from(document.querySelectorAll(".process-step"));

  pasos.forEach((paso) => {
    paso.classList.remove("active", "complete");
    const actual = paso.dataset.etapa === etapa;
    const recibida = etapasRecibidas.has(paso.dataset.etapa);
    paso.classList.toggle("active", actual);
    paso.classList.toggle("complete", recibida && !actual);
    paso.setAttribute("aria-current", actual ? "step" : "false");
    paso.setAttribute(
      "title",
      recibida
        ? "Etapa reportada por el servidor."
        : "Esta etapa aún no ha sido reportada por el servidor.",
    );
  });
}

function actualizarPreview(texto) {
  const preview = limpiarMarkdownBasico(texto).trim();

  if (!preview) {
    return;
  }

  const resumen =
    preview.length > 1800 ? preview.slice(0, 1800) + "…" : preview;

  previewContent.textContent = resumen;
  previewContent.scrollTop = previewContent.scrollHeight;
}

function agregarFuente(fuente) {
  const normalizada = normalizarFuentes([fuente])[0];
  if (!normalizada) return;
  fuente = normalizada;

  const existe = fuentesConsultadas.some((item) => item.url === fuente.url);

  if (existe) {
    return;
  }

  fuentesConsultadas.push(fuente);

  const placeholder = document.getElementById("sinFuentes");

  if (placeholder) {
    placeholder.remove();
  }

  const dominio = obtenerDominio(fuente.url);
  const titulo =
    fuente.titulo && fuente.titulo !== fuente.url ? fuente.titulo : dominio;

  const elemento = document.createElement("article");
  elemento.className = "live-source-card";

  elemento.innerHTML = `
        <div class="source-icon">
            <i class="bi bi-link-45deg" aria-hidden="true"></i>
        </div>

        <div>
            <a
                class="source-title"
                href="${escaparAtributo(fuente.url)}"
                target="_blank"
                rel="noopener noreferrer"
            >
                ${escaparHTML(titulo)}
            </a>

            <div class="source-domain">
                ${escaparHTML(dominio)}
            </div>
        </div>
    `;

  fuentesEnVivo.appendChild(elemento);
  fuentesEnVivo.scrollTop = fuentesEnVivo.scrollHeight;
  actualizarContadores();
}

function actualizarContadores() {
  const total = fuentesConsultadas.length;
  contadorFuentes.textContent = String(total);
  contadorFuentesFinal.textContent = String(total);
}

function finalizarFlujo(datos) {
  cambiarEstadoWorkspace("complete");
  const pasos = document.querySelectorAll(".process-step");

  pasos.forEach((paso) => {
    paso.classList.remove("active");
    const recibida = etapasRecibidas.has(paso.dataset.etapa);
    paso.classList.toggle("complete", recibida);
    paso.setAttribute("aria-current", "false");
    paso.setAttribute(
      "title",
      recibida
        ? "Etapa reportada por el servidor."
        : "El servidor no reportó esta etapa.",
    );
  });

  const sinFuentes = document.getElementById("sinFuentes");
  if (sinFuentes && !fuentesConsultadas.length) {
    sinFuentes.textContent =
      datos?.usar_web === false
        ? "No se utilizó búsqueda web en esta investigación."
        : "No se recibieron URLs de fuentes.";
  }

  estadoActual.innerHTML = `
        <i class="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></i>
        Investigación completada.
    `;

  renderizarReporteFinal(reporteCompleto, datos);
  renderizarFuentesFinales(datos?.usar_web);

  resultado.classList.remove("d-none");
  resultado.scrollIntoView({
    behavior: comportamientoScroll(),
    block: "start",
  });
}

function renderizarReporteFinal(markdown, datos = null) {
  const parsed = parseStructuredMarkdown(markdown);
  if (
    !Object.keys(parsed.sections).length &&
    !datos?.resumen &&
    !datos?.hallazgos?.length
  ) {
    reporte.innerHTML = renderCard(
      "bi-file-earmark-text",
      parsed.title,
      markdownToBasicHtml(markdown),
    );
    return;
  }

  let html = `
        <section class="report-hero">
            <div class="eyebrow text-white-50 mb-2">
                REPORTE FINAL
            </div>
            <h3 class="report-title">
                ${escaparHTML(parsed.title || "Reporte de investigación")}
            </h3>
            <div class="report-lead">
                ${escaparHTML(extraerResumen(datos?.resumen || parsed.sections["0. Resumen ejecutivo"] || datos?.pregunta || parsed.sections["1. Pregunta de investigación"] || ""))}
            </div>
        </section>
    `;

  const resumenBody =
    datos?.resumen || parsed.sections["0. Resumen ejecutivo"] || "";
  if (resumenBody)
    html += renderCard(
      "bi-card-text",
      "Resumen ejecutivo",
      markdownToBasicHtml(resumenBody),
    );

  const preguntaBody =
    datos?.pregunta || parsed.sections["1. Pregunta de investigación"] || "";
  html += `
        <section class="report-grid-1">
            ${renderCard("bi-question-circle", "Pregunta de investigación", markdownToBasicHtml(preguntaBody))}
        </section>
    `;

  const planBody = parsed.sections["2. Plan de investigación"] || "";
  html += `
        <section class="report-grid-1">
            ${renderPlanCard(planBody, datos?.plan)}
        </section>
    `;

  const hallazgosBody = parsed.sections["3. Hallazgos principales"] || "";
  html += `
        <section class="report-grid-1">
            ${renderFindingsCard(hallazgosBody, datos?.hallazgos)}
        </section>
    `;

  const comparacionBody =
    datos?.comparacion ||
    parsed.sections["4. Comparación de información"] ||
    "";
  html += `
        <section class="report-grid-1">
            ${renderComparisonCard(comparacionBody)}
        </section>
    `;

  const coincidenciasBody =
    parsed.sections["5. Coincidencias y diferencias entre fuentes"] || "";
  const tendenciasBody = parsed.sections["6. Tendencias identificadas"] || "";
  html += `
        <section class="report-grid-2">
            ${renderCoincidenciasCard(coincidenciasBody, datos?.coincidencias, datos?.diferencias)}
            ${renderTrendsCard(tendenciasBody, datos?.tendencias)}
        </section>
    `;

  const conclusionesBody =
    datos?.conclusion || parsed.sections["7. Conclusiones"] || "";
  html += `
        <section class="report-grid-1">
            ${renderCard("bi-patch-check", "Conclusiones", markdownToBasicHtml(conclusionesBody))}
        </section>
    `;

  reporte.innerHTML = html;
}

function renderCard(icono, titulo, bodyHtml) {
  return `
        <article class="report-card">
            <div class="report-card-header">
                <div class="report-card-icon">
                    <i class="bi ${icono}" aria-hidden="true"></i>
                </div>

                <h3>${escaparHTML(titulo)}</h3>
            </div>

            <div class="report-card-body">
                ${bodyHtml || '<p class="mb-0 text-secondary">Sin contenido.</p>'}
            </div>
        </article>
    `;
}

function renderPlanCard(body, elementos) {
  const bullets = elementos ?? extractBullets(body);

  let contenido = "";

  if (bullets.length) {
    contenido = `
            <div class="plan-grid">
                ${bullets
                  .map(
                    (item, index) => `
                    <div class="plan-step">
                        <div class="plan-number">${index + 1}</div>
                        <p>${formatInlineMarkdown(item)}</p>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
  } else {
    contenido = markdownToBasicHtml(body);
  }

  return renderCard("bi-diagram-3", "Plan de investigación", contenido);
}

function renderFindingsCard(body, elementos) {
  const hallazgos = elementos ?? parseHallazgos(body);

  let contenido = "";

  if (hallazgos.length) {
    contenido = `
            <div class="findings-showcase">
                ${hallazgos
                  .map((hallazgo, index) => {
                    const url = normalizarUrl(hallazgo.url);
                    const dominio = url ? obtenerDominio(url) : "";
                    const nombreFuente =
                      hallazgo.fuente || dominio || "Fuente consultada";

                    return `
                        <article class="finding-item">

                            <div class="finding-index">
                                ${String(index + 1).padStart(2, "0")}
                            </div>

                            <div class="finding-main">

                                <div class="finding-top">

                                    <div class="finding-heading">
                                        <span class="finding-eyebrow">
                                            HALLAZGO
                                        </span>

                                        <h4 class="finding-name">
                                            ${escaparHTML(hallazgo.nombre || `Hallazgo ${index + 1}`)}
                                        </h4>
                                    </div>

                                    <div class="finding-status">
                                        <i class="bi bi-check2-circle" aria-hidden="true"></i>
                                        ${url ? "Fuente citada" : "Sin fuente verificable"}
                                    </div>

                                </div>

                                <div class="finding-description-box">
                                    <div class="finding-section-label">
                                        <i class="bi bi-card-text me-2" aria-hidden="true"></i>
                                        Descripción
                                    </div>

                                    <p class="finding-description-text">
                                        ${formatInlineMarkdown(hallazgo.descripcion || "Sin descripción disponible.")}
                                    </p>
                                </div>

                                <div class="finding-source-panel">

                                    <div class="finding-source-icon">
                                        <i class="bi bi-globe2" aria-hidden="true"></i>
                                    </div>

                                    <div class="finding-source-info">
                                        <div class="finding-section-label">
                                            Fuente consultada
                                        </div>

                                        <div class="finding-source-name">
                                            ${escaparHTML(nombreFuente)}
                                        </div>

                                        ${
                                          dominio
                                            ? `
                                            <div class="finding-source-domain">
                                                ${escaparHTML(dominio)}
                                            </div>
                                        `
                                            : ""
                                        }
                                    </div>

                                    ${
                                      url
                                        ? `
                                        <a
                                            class="finding-source-button"
                                            href="${escaparAtributo(url)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Abrir fuente
                                            <i class="bi bi-box-arrow-up-right ms-2" aria-hidden="true"></i>
                                        </a>
                                    `
                                        : `
                                        <span class="finding-source-button disabled">
                                            URL no disponible
                                        </span>
                                    `
                                    }

                                </div>

                            </div>

                        </article>
                    `;
                  })
                  .join("")}
            </div>
        `;
  } else {
    contenido = `
            <div class="finding-fallback">
                ${markdownToBasicHtml(body)}
            </div>
        `;
  }

  return renderCard("bi-stars", "Hallazgos principales", contenido);
}

function renderComparisonCard(body) {
  const table = parseMarkdownTable(body);

  let contenido = "";

  if (table && table.headers.length && table.rows.length) {
    contenido = renderMarkdownTable(table);
  } else {
    contenido = markdownToBasicHtml(body);
  }

  return renderCard("bi-table", "Comparación de información", contenido);
}

function renderMarkdownTable(table) {
  return `<div class="compare-table-wrap" tabindex="0" role="region" aria-label="Tabla del reporte">
        <table class="compare-table">
            <thead><tr>${table.headers.map((h) => `<th scope="col">${formatInlineMarkdown(h)}</th>`).join("")}</tr></thead>
            <tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${formatInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
    </div>`;
}

function renderCoincidenciasCard(body, coincidenciasDatos, diferenciasDatos) {
  const bloques = parseSubsections(body);
  const coincidencias =
    coincidenciasDatos ?? extractBullets(bloques["Coincidencias"] || "");
  const diferencias =
    diferenciasDatos ?? extractBullets(bloques["Diferencias"] || "");

  const contenido = `
        <div class="dual-lists">
            <div class="list-panel">
                <h4>
                    <i class="bi bi-check2-circle me-2 text-success" aria-hidden="true"></i>
                    Coincidencias
                </h4>

                ${
                  coincidencias.length
                    ? `<ul>${coincidencias.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`
                    : "<p class='mb-0 text-secondary'>Sin datos disponibles.</p>"
                }
            </div>

            <div class="list-panel differences">
                <h4>
                    <i class="bi bi-arrow-left-right me-2 text-primary" aria-hidden="true"></i>
                    Diferencias
                </h4>

                ${
                  diferencias.length
                    ? `<ul>${diferencias.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`
                    : "<p class='mb-0 text-secondary'>Sin datos disponibles.</p>"
                }
            </div>
        </div>
    `;

  return renderCard(
    "bi-shuffle",
    "Coincidencias y diferencias entre fuentes",
    contenido,
  );
}

function renderTrendsCard(body, elementos) {
  const bullets = elementos ?? extractBullets(body);

  const contenido = bullets.length
    ? `<ul class="trend-list">${bullets.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`
    : markdownToBasicHtml(body);

  return renderCard("bi-graph-up-arrow", "Tendencias identificadas", contenido);
}

function renderizarFuentesFinales(usar_web) {
  fuentesFinales.innerHTML = "";

  if (fuentesConsultadas.length === 0) {
    fuentesFinales.innerHTML = `
            <div class="col-12">
                <div class="alert alert-light mb-0">
                    ${usar_web === false ? "No se utilizó búsqueda web. No hay fuentes externas consultadas para mostrar." : "No se recibieron URLs de fuentes para mostrar."}
                </div>
            </div>
        `;
    return;
  }

  fuentesConsultadas.forEach((fuente, indice) => {
    const dominio = obtenerDominio(fuente.url);
    const titulo =
      fuente.titulo && fuente.titulo !== fuente.url ? fuente.titulo : dominio;

    const columna = document.createElement("div");
    columna.className = "col-md-6 col-xl-4";

    columna.innerHTML = `
            <div class="source-ref-card">
                <div class="d-flex align-items-start gap-3">
                    <span class="counter-pill">${indice + 1}</span>

                    <div class="min-w-0">
                        <a
                            class="source-ref-link"
                            href="${escaparAtributo(fuente.url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${escaparHTML(titulo)}
                        </a>

                        <div class="source-ref-url">
                            ${escaparHTML(fuente.url)}
                        </div>
                    </div>
                </div>
            </div>
        `;

    fuentesFinales.appendChild(columna);
  });
}

function parseStructuredMarkdown(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || "Reporte de investigación";
  const nombres = [
    "Resumen ejecutivo",
    "Pregunta de investigación",
    "Plan de investigación",
    "Hallazgos principales",
    "Comparación de información",
    "Coincidencias y diferencias entre fuentes",
    "Tendencias identificadas",
    "Conclusiones",
  ];
  const normalizar = (texto) =>
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^\d+[.)]?\s*/, "")
      .replace(/\s*#+$/, "")
      .toLowerCase()
      .trim();
  const sections = {};
  let actual = null;
  for (const linea of markdown.replace(/\r/g, "").split("\n")) {
    const match = linea.match(/^\s*##\s+(.+)$/);
    if (match) {
      let indice = nombres.findIndex(
        (nombre) => normalizar(nombre) === normalizar(match[1]),
      );
      if (normalizar(match[1]) === "resumen") indice = 0;
      if (normalizar(match[1]) === "conclusion") indice = 7;
      actual = indice >= 0 ? indice + ". " + nombres[indice] : match[1].trim();
      sections[actual] = "";
    } else if (actual) {
      sections[actual] += linea + "\n";
    }
  }
  return { title, sections };
}

function parseHallazgos(text) {
  const hallazgos = [];

  const bloques = text
    .split(/(?=^###\s+Hallazgo\s+\d+)/gim)
    .map((bloque) => bloque.trim())
    .filter(Boolean);

  for (const bloque of bloques) {
    const encabezadoMatch = bloque.match(
      /^###\s+Hallazgo\s+\d+(?:\s*:\s*(.+))?\s*$/im,
    );

    if (!encabezadoMatch) {
      continue;
    }

    const nombreDesdeEncabezado = (encabezadoMatch[1] || "").trim();

    const nombre =
      extraerCampoHallazgo(bloque, "Nombre", [
        "Descripción",
        "Fuente",
        "URL",
      ]) ||
      nombreDesdeEncabezado ||
      "Hallazgo";

    const descripcion = extraerCampoHallazgo(bloque, "Descripción", [
      "Fuente",
      "URL",
    ]);

    let fuente = extraerCampoHallazgo(bloque, "Fuente", ["URL"]);

    let url = extraerCampoHallazgo(bloque, "URL");

    const enlaceFuente = extraerEnlaceMarkdown(fuente);

    if (enlaceFuente.url && !url) {
      url = enlaceFuente.url;
    }

    if (enlaceFuente.markdown) {
      fuente = limpiarTextoFuente(
        fuente.replace(enlaceFuente.markdown, enlaceFuente.texto),
      );
    } else {
      fuente = limpiarTextoFuente(fuente);
    }

    if (!url) {
      const urlMatch = bloque.match(/https?:\/\/[^\s)\]]+/i);

      if (urlMatch) {
        url = urlMatch[0];
      }
    }

    url = normalizarUrl(url);

    hallazgos.push({
      nombre: limpiarMarkdownTexto(nombre),
      descripcion: limpiarMarkdownTexto(descripcion),
      fuente: limpiarMarkdownTexto(fuente),
      url,
    });
  }

  return hallazgos;
}

function extraerCampoHallazgo(bloque, campo, siguientes = []) {
  const inicio = new RegExp(`\\*\\*${escaparRegex(campo)}:\\*\\*\\s*`, "i");

  const matchInicio = bloque.match(inicio);

  if (!matchInicio) {
    return "";
  }

  const start = matchInicio.index + matchInicio[0].length;

  let end = bloque.length;

  for (const siguiente of siguientes) {
    const resto = bloque.slice(start);

    const matchSiguiente = resto.match(
      new RegExp(`\\n\\s*\\*\\*${escaparRegex(siguiente)}:\\*\\*`, "i"),
    );

    if (matchSiguiente && start + matchSiguiente.index < end) {
      end = start + matchSiguiente.index;
    }
  }

  return bloque.slice(start, end).trim();
}

function escaparRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extraerEnlaceMarkdown(texto) {
  if (!texto) {
    return {
      markdown: "",
      texto: "",
      url: "",
    };
  }

  const match = texto.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);

  if (!match) {
    return {
      markdown: "",
      texto: "",
      url: "",
    };
  }

  return {
    markdown: match[0],
    texto: match[1].trim(),
    url: match[2].trim(),
  };
}

function limpiarTextoFuente(texto) {
  return String(texto || "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[;,:.\s]+|[;,:.\s]+$/g, "")
    .trim();
}

function limpiarMarkdownTexto(texto) {
  return String(texto || "")
    .replace(/cite[^]*/g, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarUrl(valor) {
  if (typeof valor !== "string") return "";
  let texto = valor.trim();
  const markdown = texto.match(/^\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/i);
  if (markdown) texto = markdown[1];
  if (!/^https?:\/\//i.test(texto) || /[\s<>]/.test(texto)) return "";
  try {
    const url = new URL(texto);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizarFuentes(elementos) {
  const fuentes = new Map();
  for (const fuente of elementos || []) {
    if (!fuente || typeof fuente !== "object") continue;
    const url = normalizarUrl(fuente.url);
    if (!url) continue;
    const titulo =
      typeof fuente.titulo === "string" && fuente.titulo.trim()
        ? fuente.titulo.trim()
        : obtenerDominio(url);
    const anterior = fuentes.get(url);
    if (
      !anterior ||
      anterior.titulo === url ||
      anterior.titulo === obtenerDominio(url)
    ) {
      fuentes.set(url, { ...fuente, url, titulo });
    }
  }
  return Array.from(fuentes.values());
}

function parseMarkdownTable(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  if (lines.length < 3) {
    return null;
  }

  const headers = splitTableRow(lines[0]);
  const separator = splitTableRow(lines[1]);

  if (!headers.length || !separator.length) {
    return null;
  }

  const rows = lines
    .slice(2)
    .map(splitTableRow)
    .filter((row) => row.length);

  return { headers, rows };
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function parseSubsections(text) {
  const result = {};
  const regex = /^###\s+(.*)$/gm;

  let matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      title: match[1].trim(),
      index: match.index,
      end: regex.lastIndex,
    });
  }

  if (!matches.length) {
    return result;
  }

  matches.forEach((item, index) => {
    const start = item.end;
    const end =
      index + 1 < matches.length ? matches[index + 1].index : text.length;

    result[item.title] = text.slice(start, end).trim();
  });

  return result;
}

function extractBullets(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim());
}

function markdownToBasicHtml(text) {
  if (!text || !text.trim()) {
    return '<p class="mb-0 text-secondary">Sin contenido.</p>';
  }

  const lines = text.split("\n");
  let html = "";
  let listTag = "";
  const cerrarLista = () => {
    if (listTag) html += `</${listTag}>`;
    listTag = "";
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      cerrarLista();
      continue;
    }

    const fence = line.match(/^(`{3,}|~{3,})([^\s]*)\s*$/);
    if (fence) {
      cerrarLista();
      const code = [];
      const closing = new RegExp(
        "^" + fence[1][0] + "{" + fence[1].length + ",}\\s*$",
      );
      while (++i < lines.length && !closing.test(lines[i].trim()))
        code.push(lines[i]);
      html += `<pre><code>${escaparHTML(code.join("\n"))}</code></pre>`;
      continue;
    }

    if (
      line.startsWith("|") &&
      /^\|?\s*:?-{3,}/.test(lines[i + 1]?.trim() || "")
    ) {
      const tableLines = [line, lines[++i]];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|"))
        tableLines.push(lines[++i]);
      const table = parseMarkdownTable(tableLines.join("\n"));
      if (table) {
        cerrarLista();
        html += renderMarkdownTable(table);
        continue;
      }
    }

    const item = line.match(/^(?:[-*•]\s+|\d+[.)]\s+)(.*)$/);
    if (item) {
      const tag = /^\d/.test(line) ? "ol" : "ul";
      if (listTag !== tag) {
        cerrarLista();
        html += `<${tag}>`;
        listTag = tag;
      }
      html += `<li>${formatInlineMarkdown(item[1])}</li>`;
      continue;
    }

    cerrarLista();
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 2, 6);
      html += `<h${level}>${formatInlineMarkdown(heading[2])}</h${level}>`;
    } else if (/^>\s?/.test(line)) {
      const quote = [line.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1].trim()))
        quote.push(lines[++i].trim().replace(/^>\s?/, ""));
      html += `<blockquote><p>${quote.map(formatInlineMarkdown).join("<br>")}</p></blockquote>`;
    } else {
      html += `<p>${formatInlineMarkdown(line)}</p>`;
    }
  }
  cerrarLista();

  return html;
}

function formatInlineMarkdown(text) {
  const texto = String(text || "").replace(/cite[^]*/g, "");
  const tokens =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|`([^`]+)`/gi;
  let html = "",
    inicio = 0;
  for (const match of texto.matchAll(tokens)) {
    html += escaparHTML(texto.slice(inicio, match.index));
    if (match[1] !== undefined) {
      const url = normalizarUrl(match[2]);
      html += url
        ? `<a href="${escaparAtributo(url)}" target="_blank" rel="noopener noreferrer">${escaparHTML(match[1])}</a>`
        : escaparHTML(match[0]);
    } else if (match[3] !== undefined) {
      html += `<strong>${escaparHTML(match[3])}</strong>`;
    } else {
      html += `<code>${escaparHTML(match[4])}</code>`;
    }
    inicio = match.index + match[0].length;
  }
  return html + escaparHTML(texto.slice(inicio));
}

function limpiarMarkdownBasico(text) {
  return text
    .replace(/cite[^]*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\|/g, " | ");
}

function extraerResumen(texto) {
  const clean = limpiarMarkdownBasico(texto).replace(/\s+/g, " ").trim();

  if (!clean) {
    return "Resumen generado a partir de las fuentes consultadas.";
  }

  return clean.length > 240 ? clean.slice(0, 240) + "…" : clean;
}

function obtenerDominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function mostrarError(mensaje, interrumpida = false) {
  error.textContent = mensaje || "Ocurrió un error.";
  error.classList.remove("d-none");
  error.scrollIntoView({ behavior: comportamientoScroll(), block: "nearest" });

  if (interrumpida && !actividad.classList.contains("d-none")) {
    estadoActual.textContent = "La investigación se interrumpió.";
  }
}

function escaparHTML(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

function escaparAtributo(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cambiarEstadoWorkspace(estado) {
  if (document.body?.dataset) document.body.dataset.researchState = estado;
  const etiquetas = {
    processing: ["INVESTIGACIÓN EN CURSO", "Cada hallazgo cuenta."],
    complete: ["INVESTIGACIÓN COMPLETADA", "De la pregunta a la evidencia."],
    error: ["INVESTIGACIÓN DETENIDA", "Actividad de la investigación."],
  };
  const [kicker, titulo] = etiquetas[estado] || etiquetas.processing;
  const actividadKicker = document.getElementById("actividadKicker");
  const tituloActividad = document.getElementById("tituloActividad");
  if (actividadKicker) actividadKicker.textContent = kicker;
  if (tituloActividad) tituloActividad.textContent = titulo;
}

function comportamientoScroll() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function actualizarContadorPregunta() {
  if (contadorPregunta)
    contadorPregunta.textContent = `${Array.from(pregunta.value || "").length.toLocaleString("es-MX")} / 4,000`;
}

function inicializarTema() {
  const raiz = document.documentElement;
  if (!raiz) return;
  const boton = document.getElementById("btnTema");
  const etiqueta = document.getElementById("etiquetaTema");
  let guardado;
  try {
    guardado = globalThis.localStorage?.getItem("radar-tic-theme");
  } catch {
    /* El navegador puede bloquear el almacenamiento. */
  }
  const preferido = globalThis.matchMedia?.("(prefers-color-scheme: dark)")
    .matches
    ? "dark"
    : "light";
  const aplicar = (tema) => {
    raiz.dataset.theme = tema;
    const accion =
      tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
    boton?.setAttribute("aria-label", accion);
    boton?.setAttribute("title", accion);
    boton?.setAttribute("aria-pressed", String(tema === "dark"));
    if (etiqueta)
      etiqueta.textContent = tema === "dark" ? "Tema claro" : "Tema oscuro";
    const meta = document.querySelector?.('meta[name="theme-color"]');
    meta?.setAttribute("content", tema === "dark" ? "#151b18" : "#f8f9f5");
  };
  aplicar(["light", "dark"].includes(guardado) ? guardado : preferido);
  boton?.addEventListener("click", () => {
    const tema = raiz.dataset.theme === "dark" ? "light" : "dark";
    aplicar(tema);
    try {
      globalThis.localStorage?.setItem("radar-tic-theme", tema);
    } catch {
      /* El tema sigue funcionando sin persistencia. */
    }
  });
}

function inicializarNavegacion() {
  const boton = document.getElementById("btnMenu");
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (!boton || !sidebar || !overlay) return;
  const cerrar = (devolverFoco = false) => {
    sidebar.classList.remove("is-open");
    document.body.classList?.remove("sidebar-open");
    overlay.hidden = true;
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Abrir navegación");
    if (devolverFoco) boton.focus();
  };
  boton.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) return cerrar();
    sidebar.classList.add("is-open");
    document.body.classList?.add("sidebar-open");
    overlay.hidden = false;
    boton.setAttribute("aria-expanded", "true");
    boton.setAttribute("aria-label", "Cerrar navegación");
    sidebar.querySelector?.("a, button:not(:disabled)")?.focus();
  });
  overlay.addEventListener("click", () => cerrar(true));
  sidebar.addEventListener("click", (evento) => {
    if (evento.target.closest?.("a, #btnNuevaInvestigacion")) cerrar();
  });
  document.addEventListener?.("keydown", (evento) => {
    if (!sidebar.classList.contains("is-open")) return;
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrar(true);
    }
    if (evento.key === "Tab") {
      const controles = Array.from(
        sidebar.querySelectorAll(
          "a[href], button:not(:disabled), input:not(:disabled), [tabindex='0']",
        ),
      ).filter((control) => !control.hidden && control.getClientRects().length);
      const primero = controles[0],
        ultimo = controles.at(-1);
      if (!primero) return;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      }
      if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }
  });
  globalThis
    .matchMedia?.("(min-width: 801px)")
    .addEventListener?.("change", (evento) => {
      if (evento.matches) cerrar();
    });
  cerrar();
}

const radarTIC = new RadarTICApp();
