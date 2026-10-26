const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function entorno({
  location = { origin: "http://127.0.0.1:8000", protocol: "http:" },
  tema,
  almacenamientoBloqueado = false,
  sistemaOscuro = false,
  reducirMovimiento = false,
  ejemplos = [],
  etapas = [],
} = {}) {
  const elementos = new Map();
  const creados = [];
  const almacenamiento = new Map(tema ? [["radar-tic-theme", tema]] : []);
  let activo;
  function elemento() {
    const clases = new Set(["d-none"]);
    const eventos = new Map();
    let texto = "",
      html = "";
    return {
      value: "rapido",
      checked: true,
      disabled: false,
      dataset: {},
      scrollTop: 0,
      scrollHeight: 0,
      children: [],
      addEventListener(tipo, callback) {
        if (!eventos.has(tipo)) eventos.set(tipo, []);
        eventos.get(tipo).push(callback);
      },
      emit(tipo, evento = {}) {
        return Promise.all(
          (eventos.get(tipo) || []).map((callback) => callback(evento)),
        );
      },
      appendChild(child) {
        this.children.push(child);
      },
      setAttribute(nombre, valor) {
        this[nombre] = valor;
      },
      getAttribute(nombre) {
        return this[nombre] ?? null;
      },
      remove() {},
      click() {
        return this.emit("click");
      },
      focus() {
        activo = this;
      },
      getClientRects() {
        return [{}];
      },
      scrollIntoView(opciones) {
        this.ultimoScroll = opciones;
      },
      querySelector() {
        return this.children[0];
      },
      querySelectorAll() {
        return this.children;
      },
      classList: {
        add(...items) {
          items.forEach((i) => clases.add(i));
        },
        remove(...items) {
          items.forEach((i) => clases.delete(i));
        },
        contains(i) {
          return clases.has(i);
        },
        toggle(i, on) {
          if (on) clases.add(i);
          else clases.delete(i);
        },
      },
      get textContent() {
        return texto;
      },
      set textContent(value) {
        texto = String(value ?? "");
        html = texto
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      },
      get innerHTML() {
        return html;
      },
      set innerHTML(value) {
        html = value;
      },
    };
  }
  const documento = elemento();
  documento.documentElement = elemento();
  documento.body = elemento();
  Object.defineProperty(documento, "activeElement", { get: () => activo });
  documento.getElementById = (id) => {
    if (!elementos.has(id)) elementos.set(id, elemento());
    return elementos.get(id);
  };
  const botonesEjemplo = ejemplos.map((texto) => {
    const boton = elemento();
    boton.dataset.pregunta = texto;
    return boton;
  });
  const pasos = etapas.map((etapa) => {
    const paso = elemento();
    paso.dataset.etapa = etapa;
    return paso;
  });
  documento.querySelectorAll = (selector) => {
    if (selector === "[data-pregunta]") return botonesEjemplo;
    if (selector === ".process-step") return pasos;
    return [];
  };
  documento.querySelector = () => null;
  documento.createElement = (tag) => {
    const nuevo = elemento();
    nuevo.tagName = tag.toUpperCase();
    creados.push(nuevo);
    return nuevo;
  };
  const context = vm.createContext({
    TextDecoder,
    URL,
    Blob,
    AbortController,
    console,
    setTimeout(callback, delay) {
      if (delay === 60000) {
        callback();
        return 0;
      }
      return setTimeout(callback, delay);
    },
    location,
    document: documento,
    matchMedia(consulta) {
      return {
        matches: consulta.includes("prefers-color-scheme")
          ? sistemaOscuro
          : consulta.includes("prefers-reduced-motion")
            ? reducirMovimiento
            : false,
        addEventListener() {},
      };
    },
    localStorage: {
      getItem(clave) {
        if (almacenamientoBloqueado) throw new Error("Bloqueado");
        return almacenamiento.get(clave) ?? null;
      },
      setItem(clave, valor) {
        if (almacenamientoBloqueado) throw new Error("Bloqueado");
        almacenamiento.set(clave, valor);
      },
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ configurado: true, modelo: "test-model" }),
    }),
  });
  for (const archivo of ["runtime-config", "config", "api", "app"]) {
    vm.runInContext(
      fs.readFileSync("assets/js/" + archivo + ".js", "utf8"),
      context,
    );
  }
  return {
    context,
    elementos,
    creados,
    almacenamiento,
    documento,
    botonesEjemplo,
    pasos,
    api(fetchImpl) {
      context.fetchPrueba = fetchImpl;
      return vm.runInContext(
        "new RadarTICApi(RadarTICConfig, fetchPrueba)",
        context,
      );
    },
  };
}

function respuestaSSE(texto, fragmentar = false) {
  const bytes = Buffer.from(texto);
  return new Response(
    new ReadableStream({
      start(controller) {
        if (fragmentar)
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        else controller.enqueue(bytes);
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

test("SSE fragmentado preserva UTF-8 y exige finalización", async () => {
  const e = entorno(),
    eventos = [];
  const api = e.api(async () =>
    respuestaSSE(
      'event: texto\r\ndata: {"delta":"Información útil"}\r\n\r\nevent: completado\r\ndata: {"reporte":"Final"}\r\n\r\n',
      true,
    ),
  );
  await api.investigar(
    { pregunta: "Prueba" },
    { onEvento: (tipo, contenido) => eventos.push([tipo, contenido]) },
  );
  assert.equal(eventos[0][1].delta, "Información útil");
  assert.equal(eventos.at(-1)[0], "completado");
});

test("HTTP 500 con HTML produce un error visible y libera controles", async () => {
  const e = entorno();
  const app = vm.runInContext("radarTIC", e.context);
  app.api = e.api(
    async () => new Response("<html>Error</html>", { status: 500 }),
  );
  e.elementos.get("pregunta").value = "Prueba";
  await app.investigar();
  assert.equal(e.elementos.get("error").classList.contains("d-none"), false);
  assert.match(e.elementos.get("error").textContent, /500/);
  assert.equal(e.elementos.get("btnInvestigar").disabled, false);
  assert.equal(e.elementos.get("modo").disabled, false);
});

test("cierre con texto parcial no se acepta como éxito", async () => {
  const e = entorno();
  const api = e.api(async () =>
    respuestaSSE('event: texto\ndata: {"delta":"Parcial"}\n\n'),
  );
  await assert.rejects(
    api.investigar({ pregunta: "Prueba" }, { onEvento() {} }),
    /antes de completar/,
  );
});

test("errores SSE y eventos inválidos se notifican", async () => {
  for (const texto of [
    'event: error\ndata: {"mensaje":"Fallo controlado"}\n\n',
    "event: texto\ndata: {invalido}\n\n",
  ]) {
    const e = entorno();
    const api = e.api(async () => respuestaSSE(texto));
    await assert.rejects(
      api.investigar({ pregunta: "Prueba" }, { onEvento() {} }),
    );
  }
});

test("rechazo por especialidad muestra aviso y no presenta reporte", async () => {
  const e = entorno();
  const app = vm.runInContext("radarTIC", e.context);
  const mensaje =
    "Radar TIC solo responde preguntas sobre TIC. Esta consulta está fuera de su especialidad.";
  app.api = e.api(async () =>
    respuestaSSE(
      'event: estado\ndata: {"etapa":"validando","mensaje":"Comprobando especialidad"}\n\nevent: error\ndata: ' +
        JSON.stringify({ codigo: "fuera_de_especialidad", mensaje }) +
        "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "¿Cómo tratar la gripe?";
  await app.investigar();
  assert.equal(e.elementos.get("error").textContent, mensaje);
  assert.equal(e.elementos.get("error").classList.contains("d-none"), false);
  assert.equal(app.ultimoResultado, null);
  assert.equal(e.elementos.get("actividad").classList.contains("d-none"), true);
  assert.equal(e.elementos.get("resultado").classList.contains("d-none"), true);
  assert.equal(e.elementos.get("btnDescargar").disabled, true);
  assert.equal(e.elementos.get("btnInvestigar").disabled, false);
});

test("tabla preserva celdas vacías y barras escapadas", () => {
  const e = entorno();
  const fila = e.context.splitTableRow(
    "| A \\| B | Descripción | | Limitación | Uso |",
  );
  assert.equal(fila.length, 5);
  assert.equal(fila[0], "A | B");
  assert.equal(fila[2], "");
  assert.equal(fila[3], "Limitación");
});

test("los enlaces de fuentes conservan el nombre", () => {
  const e = entorno();
  const hallazgo = e.context.parseHallazgos(
    "### Hallazgo 1\n**Nombre:** Prueba\n**Descripción:** Texto\n**Fuente:** [Institución](https://example.com/spec)\n**URL:** https://example.com/spec",
  )[0];
  assert.equal(hallazgo.fuente, "Institución");
});

test("encabezados sin numeración y sin acentos conservan secciones", () => {
  const e = entorno();
  const reporte = e.context.parseStructuredMarkdown(
    "# Prueba\n## Resumen ejecutivo\nResumen\n## Comparacion de informacion\nTabla",
  );
  assert.match(reporte.sections["0. Resumen ejecutivo"], /Resumen/);
  assert.match(reporte.sections["4. Comparación de información"], /Tabla/);
});

test("contenido HTML generado se presenta escapado", () => {
  const e = entorno();
  const html = e.context.formatInlineMarkdown(
    "<img src=x onerror=alert(1)> **Texto**",
  );
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("<strong>Texto</strong>"));
});

test("descarga solicita un archivo local sin investigar nuevamente", async () => {
  const e = entorno();
  const app = vm.runInContext("radarTIC", e.context);
  app.ultimoResultado = { reporte: "# Prueba" };
  let ruta, cuerpo;
  app.api = e.api(async (url, options) => {
    ruta = url;
    cuerpo = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        url: "/api/reportes/prueba/descargar",
        nombre: "prueba.md",
      }),
    };
  });
  await app.descargar();
  assert.equal(ruta, "http://127.0.0.1:8000/api/reportes/exportar");
  assert.equal(cuerpo.reporte, "# Prueba");
  assert.equal(e.elementos.get("btnDescargar").disabled, false);
  assert.equal(
    e.creados.find((item) => item.tagName === "A").href,
    "http://127.0.0.1:8000/api/reportes/prueba/descargar",
  );
});

function resultado(datos = {}) {
  return {
    pregunta: "¿Cómo proteger una API?",
    modo: "rapido",
    usar_web: true,
    modelo: "modelo-prueba",
    fecha: "2026-10-13T12:00:00Z",
    reporte: "# Reporte\nTexto sin encabezados normalizados.",
    resumen: "Resumen estructurado",
    plan: ["Plan estructurado"],
    hallazgos: [
      {
        nombre: "Hallazgo estructurado",
        descripcion: "Descripción estructurada",
        fuente: "FastAPI",
        url: "https://fastapi.tiangolo.com/",
      },
    ],
    comparacion:
      "| Tecnología | Ventaja |\n| --- | --- |\n| FastAPI | Validación |",
    coincidencias: ["Coincidencia estructurada"],
    diferencias: ["Diferencia estructurada"],
    tendencias: ["Tendencia estructurada"],
    conclusion: "Conclusión estructurada",
    fuentes: [
      {
        titulo: "FastAPI",
        url: "https://fastapi.tiangolo.com/",
        origen: "cita",
      },
    ],
    total_fuentes: 1,
    busquedas: 1,
    uso: { entrada: 10, salida: 20, total: 30 },
    ...datos,
  };
}

test("configuración usa el origen de FastAPI y rechaza rutas externas", () => {
  for (const origin of [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://127.0.0.1:8010",
  ]) {
    const e = entorno({ location: { protocol: "http:", origin } });
    assert.equal(
      vm.runInContext('RadarTICConfig.endpoint("/api/investigar")', e.context),
      origin + "/api/investigar",
    );
    for (const ruta of [
      "https://example.com/api",
      "//example.com/api",
      "/api/../.env",
    ]) {
      e.context.ruta = ruta;
      assert.throws(
        () => vm.runInContext("RadarTICConfig.endpoint(ruta)", e.context),
        /backend local/,
      );
    }
  }
});

test("pregunta vacía, larga y modo inválido no generan solicitudes", async () => {
  for (const [pregunta, modo] of [
    ["  ", "rapido"],
    ["x".repeat(4001), "rapido"],
    ["Una pregunta", "invalido"],
  ]) {
    const e = entorno(),
      app = vm.runInContext("radarTIC", e.context);
    let llamadas = 0;
    app.api = e.api(async () => {
      llamadas++;
      throw new Error("No debe enviarse");
    });
    e.elementos.get("pregunta").value = pregunta;
    e.elementos.get("modo").value = modo;
    await app.investigar();
    assert.equal(llamadas, 0);
    assert.equal(e.elementos.get("error").classList.contains("d-none"), false);
    assert.equal(
      e.documento.activeElement,
      e.elementos.get(modo === "invalido" ? "modo" : "pregunta"),
    );
  }
});

test("los tres modos envían el contrato correcto y presentan los campos estructurados", async () => {
  for (const modo of ["rapido", "comparativo", "profundo"])
    for (const usar_web of [false, true]) {
      const e = entorno(),
        app = vm.runInContext("radarTIC", e.context);
      let peticion;
      app.api = e.api(async (url, opciones) => {
        peticion = { url, ...opciones };
        return respuestaSSE(
          "event: completado\ndata: " +
            JSON.stringify(resultado({ modo, usar_web })) +
            "\n\n",
        );
      });
      e.elementos.get("pregunta").value = "  ¿Cómo proteger una API?  ";
      e.elementos.get("modo").value = modo;
      e.elementos.get("usarWeb").checked = usar_web;
      await app.investigar();
      assert.equal(peticion.url, "http://127.0.0.1:8000/api/investigar");
      assert.deepEqual(JSON.parse(peticion.body), {
        pregunta: "¿Cómo proteger una API?",
        modo,
        usar_web,
      });
      assert.equal(peticion.headers.Authorization, undefined);
      for (const texto of [
        "Resumen estructurado",
        "Hallazgo estructurado",
        "Descripción estructurada",
        "Coincidencia estructurada",
        "Diferencia estructurada",
        "Tendencia estructurada",
        "Conclusión estructurada",
      ]) {
        assert.ok(e.elementos.get("reporte").innerHTML.includes(texto), texto);
      }
      assert.equal(
        e.elementos.get("resultado").classList.contains("d-none"),
        false,
      );
      assert.equal(e.elementos.get("btnDescargar").disabled, false);
      assert.match(
        e.elementos.get("metadatosResultado").textContent,
        /Tokens: 30/,
      );
      assert.equal(
        e.elementos.get("actividad").getAttribute("aria-busy"),
        "false",
      );
    }
});

test("investigación activa impide duplicados y cancelar libera los controles", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  let llamadas = 0;
  app.api = {
    investigar: async (solicitud, { signal }) => {
      llamadas++;
      await new Promise((resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("Cancelada");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        ),
      );
    },
  };
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  const pendiente = app.investigar();
  await app.investigar();
  assert.equal(llamadas, 1);
  assert.equal(e.elementos.get("btnInvestigar").disabled, true);
  assert.equal(e.elementos.get("modo").disabled, true);
  assert.equal(e.elementos.get("usarWeb").disabled, true);
  assert.equal(e.elementos.get("actividad").getAttribute("aria-busy"), "true");
  app.controlador.abort();
  await pendiente;
  assert.equal(e.elementos.get("btnInvestigar").disabled, false);
  assert.equal(e.elementos.get("modo").disabled, false);
  assert.equal(e.elementos.get("usarWeb").disabled, false);
  assert.equal(e.elementos.get("btnDescargar").disabled, true);
  assert.match(e.elementos.get("error").textContent, /cancelada/);
  assert.equal(app.ultimoResultado, null);
});

test("respuesta vacía o con campos inválidos no se presenta como éxito", async () => {
  for (const datos of [
    { reporte: " " },
    { reporte: null },
    { plan: "Incorrecto" },
    { resumen: {} },
    { hallazgos: [null] },
    { fuentes: [{ url: 123 }] },
  ]) {
    const e = entorno(),
      app = vm.runInContext("radarTIC", e.context);
    app.api = e.api(async () =>
      respuestaSSE(
        "event: completado\ndata: " + JSON.stringify(resultado(datos)) + "\n\n",
      ),
    );
    e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
    await app.investigar();
    assert.equal(app.ultimoResultado, null);
    assert.equal(
      e.elementos.get("resultado").classList.contains("d-none"),
      true,
    );
    assert.equal(e.elementos.get("btnDescargar").disabled, true);
    assert.equal(e.elementos.get("error").classList.contains("d-none"), false);
  }
});

test("enlaces no HTTP y URLs incrustadas en javascript se rechazan", () => {
  const e = entorno();
  for (const url of [
    "javascript:alert(1)",
    "javascript:https://fastapi.tiangolo.com/",
    "data:text/html,<script>alert(1)</script>",
    "https://",
    "https://user:password@example.com/",
  ]) {
    assert.equal(e.context.normalizarUrl(url), "");
  }
  assert.equal(
    e.context.normalizarUrl("HTTPS://FASTAPI.TIANGOLO.COM/"),
    "https://fastapi.tiangolo.com/",
  );
  const fuentes = e.context.normalizarFuentes([
    { url: "https://fastapi.tiangolo.com", titulo: "fastapi.tiangolo.com" },
    {
      url: "https://fastapi.tiangolo.com/",
      titulo: "Documentación de FastAPI",
    },
    { url: "javascript:https://fastapi.tiangolo.com/", titulo: "Trampa" },
  ]);
  assert.equal(fuentes.length, 1);
  assert.equal(fuentes[0].titulo, "Documentación de FastAPI");
});

test("contenido externo malicioso se escapa en todo el reporte y las fuentes", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  const ataque = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  app.api = e.api(async () =>
    respuestaSSE(
      "event: completado\ndata: " +
        JSON.stringify(
          resultado({
            resumen: ataque,
            pregunta: ataque,
            plan: [ataque],
            coincidencias: [ataque],
            diferencias: [ataque],
            tendencias: [ataque],
            conclusion: ataque,
            hallazgos: [
              {
                nombre: ataque,
                descripcion: ataque,
                fuente: ataque,
                url: "javascript:https://example.com/",
              },
            ],
            fuentes: [
              {
                titulo: ataque,
                url: "https://fastapi.tiangolo.com/?q=%22&v=1",
              },
              { titulo: "Trampa", url: "javascript:https://example.com/" },
            ],
          }),
        ) +
        "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "Una pregunta de TIC";
  await app.investigar();
  const html = e.elementos.get("reporte").innerHTML;
  assert.ok(!/<(?:img|script|iframe|svg)\b/i.test(html));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!/href="javascript:/i.test(html));
  const fuente = e.elementos.get("fuentesFinales").children[0].innerHTML;
  assert.ok(!/<(?:img|script)\b/i.test(fuente));
  assert.ok(fuente.includes('target="_blank"'));
  assert.ok(fuente.includes('rel="noopener noreferrer"'));
  assert.equal(e.elementos.get("contadorFuentesFinal").textContent, "1");
});

test("descarga duplicada se impide y no acepta destinos externos", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  app.ultimoResultado = resultado();
  let resolver,
    llamadas = 0;
  app.api = {
    descargar: () => {
      llamadas++;
      return new Promise((resolve) => {
        resolver = resolve;
      });
    },
  };
  const pendiente = app.descargar();
  await app.descargar();
  assert.equal(llamadas, 1);
  resolver({ blob: new Blob(["# Prueba"]), nombre: "prueba.md" });
  await pendiente;
  for (const url of [
    "https://example.com/archivo",
    "//example.com/archivo",
    "/api/reportes/../.env",
  ]) {
    const api = e.api(
      async () =>
        new Response(JSON.stringify({ url, nombre: "prueba.md" }), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    await assert.rejects(
      api.exportar(resultado()),
      /archivo de descarga válido/,
    );
  }
});

test("errores de conexión, HTTP 422 y cancelación no se confunden con éxito", async () => {
  const e = entorno();
  const fallos = e.api(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(fallos.salud(), /conectar con FastAPI/);
  const invalida = e.api(
    async () =>
      new Response(JSON.stringify({ detail: "Revisa la pregunta" }), {
        status: 422,
      }),
  );
  await assert.rejects(
    invalida.investigar({ pregunta: "Prueba" }, { onEvento() {} }),
    /Revisa la pregunta/,
  );
  let solicitudes = 0;
  const api = e.api(async () => {
    solicitudes++;
  });
  const controlador = new AbortController();
  controlador.abort();
  await assert.rejects(
    api.investigar(
      { pregunta: "Prueba" },
      { signal: controlador.signal, onEvento() {} },
    ),
    { name: "AbortError" },
  );
  assert.equal(solicitudes, 0);
});

test("error de descarga no invalida una investigación ya completada", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  app.api = e.api(async () =>
    respuestaSSE(
      "event: completado\ndata: " + JSON.stringify(resultado()) + "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  await app.investigar();
  app.api = e.api(
    async () =>
      new Response(
        JSON.stringify({ detail: "No se pudo preparar la descarga" }),
        { status: 502 },
      ),
  );
  const estado = e.elementos.get("estadoActual").innerHTML;
  await app.descargar();
  assert.equal(e.elementos.get("estadoActual").innerHTML, estado);
  assert.equal(
    e.elementos.get("resultado").classList.contains("d-none"),
    false,
  );
  assert.match(e.elementos.get("error").textContent, /preparar la descarga/);
  assert.equal(e.elementos.get("btnDescargar").disabled, false);
});

test("citas y código de los campos estructurados conservan formato seguro", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  app.api = e.api(async () =>
    respuestaSSE(
      "event: completado\ndata: " +
        JSON.stringify(
          resultado({
            hallazgos: [
              {
                nombre: "Ejemplo",
                descripcion:
                  "Código `<script>alert(1)</script>` y [FastAPI](https://fastapi.tiangolo.com/) con **tipos**.",
                fuente: "FastAPI",
                url: "https://fastapi.tiangolo.com/",
              },
            ],
            coincidencias: ["Cita [FastAPI](https://fastapi.tiangolo.com/)"],
          }),
        ) +
        "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  await app.investigar();
  const html = e.elementos.get("reporte").innerHTML;
  assert.ok(
    html.includes("<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>"),
  );
  assert.ok(html.includes("<strong>tipos</strong>"));
  assert.ok(html.includes('href="https://fastapi.tiangolo.com/"'));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("[FastAPI]("));
});

test("GitHub Pages utiliza el backend HTTPS configurado y rechaza credenciales en URLs", () => {
  const e = entorno({
    location: { origin: "https://usuario.github.io", protocol: "https:" },
  });
  e.context.RADAR_TIC_BACKEND_URL = "https://radar-prueba.vercel.app";
  assert.equal(
    vm.runInContext('RadarTICConfig.endpoint("/api/investigar")', e.context),
    "https://radar-prueba.vercel.app/api/investigar",
  );
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/api",
    "javascript:alert(1)",
  ]) {
    e.context.RADAR_TIC_BACKEND_URL = url;
    assert.throws(
      () => vm.runInContext("RadarTICConfig.baseUrl", e.context),
      /backend/,
    );
  }
});

test("acceso privado se solicita sin enviarlo como parte de la investigación", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  let solicitud;
  app.api = e.api(async (url, opciones) => {
    if (url.endsWith("/api/salud"))
      return new Response(
        JSON.stringify({
          configurado: true,
          modelo: "prueba",
          requiere_acceso: true,
        }),
      );
    solicitud = { url, ...opciones };
    return respuestaSSE(
      "event: completado\ndata: " + JSON.stringify(resultado()) + "\n\n",
    );
  });
  await app.comprobarServidor();
  e.elementos.get("codigoAcceso").value = "";
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  await app.investigar();
  assert.equal(solicitud, undefined);
  assert.equal(
    e.elementos.get("contenedorAcceso").classList.contains("d-none"),
    false,
  );
  e.elementos.get("codigoAcceso").value = "codigo-privado-de-prueba";
  await app.investigar();
  assert.equal(
    solicitud.headers.Authorization,
    "Bearer codigo-privado-de-prueba",
  );
  assert.deepEqual(JSON.parse(solicitud.body), {
    pregunta: "¿Cómo proteger una API?",
    modo: "rapido",
    usar_web: true,
  });
  assert.ok(!solicitud.body.includes("codigo-privado-de-prueba"));
});

test("descarga remota utiliza un POST autenticado sin depender de otra instancia", async () => {
  const e = entorno({
    location: { origin: "https://usuario.github.io", protocol: "https:" },
  });
  e.context.RADAR_TIC_BACKEND_URL = "https://backend-prueba.vercel.app";
  let peticion;
  const api = e.api(async (url, opciones) => {
    peticion = { url, ...opciones };
    return new Response("# Reporte remoto", {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": 'attachment; filename="radar-tic-prueba.md"',
      },
    });
  });
  api.codigoAcceso = "codigo-privado-de-prueba";
  const archivo = await api.descargar(resultado());
  assert.equal(
    peticion.url,
    "https://backend-prueba.vercel.app/api/reportes/descargar",
  );
  assert.equal(peticion.method, "POST");
  assert.equal(
    peticion.headers.Authorization,
    "Bearer codigo-privado-de-prueba",
  );
  assert.equal(archivo.nombre, "radar-tic-prueba.md");
  assert.equal(await archivo.blob.text(), "# Reporte remoto");
  assert.ok(!peticion.body.includes("codigo-privado-de-prueba"));
});

test("tema restaura la preferencia y persiste únicamente el nombre del tema", async () => {
  const e = entorno({ tema: "dark" });
  const boton = e.elementos.get("btnTema");
  assert.equal(e.documento.documentElement.dataset.theme, "dark");
  assert.equal(boton.getAttribute("aria-pressed"), "true");
  assert.match(boton.getAttribute("aria-label"), /claro/);
  await boton.click();
  assert.equal(e.documento.documentElement.dataset.theme, "light");
  assert.equal(e.almacenamiento.get("radar-tic-theme"), "light");
  assert.equal(e.elementos.get("etiquetaTema").textContent, "Tema oscuro");
  assert.deepEqual(Array.from(e.almacenamiento.keys()), ["radar-tic-theme"]);
});

test("tema funciona con almacenamiento bloqueado y descarta preferencias inválidas", async () => {
  const bloqueado = entorno({
    almacenamientoBloqueado: true,
    sistemaOscuro: true,
  });
  assert.equal(bloqueado.documento.documentElement.dataset.theme, "dark");
  await bloqueado.elementos.get("btnTema").click();
  assert.equal(bloqueado.documento.documentElement.dataset.theme, "light");
  const invalido = entorno({ tema: "javascript:alert(1)" });
  assert.equal(invalido.documento.documentElement.dataset.theme, "light");
});

test("menú móvil responde a overlay, Escape y limita el foco a la navegación abierta", async () => {
  const e = entorno();
  const boton = e.elementos.get("btnMenu"),
    sidebar = e.elementos.get("appSidebar"),
    overlay = e.elementos.get("sidebarOverlay");
  const primero = e.documento.createElement("a"),
    ultimo = e.documento.createElement("button");
  sidebar.children.push(primero, ultimo);
  await boton.click();
  assert.equal(boton.getAttribute("aria-expanded"), "true");
  assert.equal(sidebar.classList.contains("is-open"), true);
  assert.equal(overlay.hidden, false);
  assert.equal(e.documento.activeElement, primero);
  let evitado = false;
  await e.documento.emit("keydown", {
    key: "Tab",
    shiftKey: true,
    preventDefault() {
      evitado = true;
    },
  });
  assert.equal(evitado, true);
  assert.equal(e.documento.activeElement, ultimo);
  await e.documento.emit("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(boton.getAttribute("aria-expanded"), "false");
  assert.equal(overlay.hidden, true);
  assert.equal(e.documento.activeElement, boton);
  await boton.click();
  await overlay.click();
  assert.equal(e.documento.body.classList.contains("sidebar-open"), false);
});

test("ejemplos rellenan la consulta y el atajo envía una única investigación", async () => {
  const e = entorno({ ejemplos: ["¿Cómo proteger una API? 🔎"] });
  const app = vm.runInContext("radarTIC", e.context);
  let llamadas = 0;
  app.api = e.api(async () => {
    llamadas++;
    return respuestaSSE(
      "event: completado\ndata: " + JSON.stringify(resultado()) + "\n\n",
    );
  });
  await e.botonesEjemplo[0].click();
  assert.equal(llamadas, 0);
  assert.equal(e.elementos.get("pregunta").value, "¿Cómo proteger una API? 🔎");
  assert.equal(
    e.elementos.get("contadorPregunta").textContent,
    `${Array.from("¿Cómo proteger una API? 🔎").length} / 4,000`,
  );
  await e.elementos
    .get("pregunta")
    .emit("keydown", { key: "Enter", ctrlKey: true, preventDefault() {} });
  assert.equal(llamadas, 1);
  assert.equal(e.documento.body.dataset.researchState, "complete");
});

test("nueva investigación limpia el reporte y preserva los ajustes y el acceso en memoria", async () => {
  const e = entorno(),
    app = vm.runInContext("radarTIC", e.context);
  app.api = e.api(async () =>
    respuestaSSE(
      "event: completado\ndata: " + JSON.stringify(resultado()) + "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  e.elementos.get("modo").value = "profundo";
  e.elementos.get("codigoAcceso").value = "solo-en-memoria";
  await app.investigar();
  assert.equal(e.elementos.get("btnDescargar").disabled, false);
  await e.elementos.get("btnNuevaInvestigacion").click();
  assert.equal(app.ultimoResultado, null);
  assert.equal(e.elementos.get("pregunta").value, "");
  assert.equal(e.elementos.get("modo").value, "profundo");
  assert.equal(e.elementos.get("codigoAcceso").value, "solo-en-memoria");
  assert.equal(e.elementos.get("reporte").innerHTML, "");
  assert.equal(e.elementos.get("resultado").classList.contains("d-none"), true);
  assert.equal(e.elementos.get("btnDescargar").disabled, true);
  assert.equal(e.elementos.get("contadorFuentesFinal").textContent, "0");
  assert.equal(e.documento.body.dataset.researchState, "idle");
  assert.ok(!Array.from(e.almacenamiento.values()).includes("solo-en-memoria"));
});

test("reset y ejemplos quedan bloqueados mientras se procesa la investigación", async () => {
  const e = entorno({ ejemplos: ["Otro tema"] }),
    app = vm.runInContext("radarTIC", e.context);
  app.api = {
    investigar: async (solicitud, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("Cancelada");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        ),
      ),
  };
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  const pendiente = app.investigar();
  assert.equal(e.elementos.get("btnNuevaInvestigacion").disabled, true);
  assert.match(e.elementos.get("btnInvestigar").innerHTML, /Investigando…/);
  assert.equal(
    e.elementos.get("actividadKicker").textContent,
    "INVESTIGACIÓN EN CURSO",
  );
  assert.equal(e.botonesEjemplo[0].disabled, true);
  app.nuevaInvestigacion();
  await e.botonesEjemplo[0].emit("click");
  assert.equal(e.elementos.get("pregunta").value, "¿Cómo proteger una API?");
  assert.equal(e.documento.body.dataset.researchState, "processing");
  app.controlador.abort();
  await pendiente;
  assert.equal(e.elementos.get("btnNuevaInvestigacion").disabled, false);
  assert.equal(e.botonesEjemplo[0].disabled, false);
  assert.equal(e.documento.body.dataset.researchState, "error");
  assert.equal(
    e.elementos.get("btnInvestigar").innerHTML,
    app.etiquetaInvestigar,
  );
  assert.equal(
    e.elementos.get("actividadKicker").textContent,
    "INVESTIGACIÓN DETENIDA",
  );
  assert.equal(
    e.elementos.get("tituloActividad").textContent,
    "Actividad de la investigación.",
  );
});

test("Markdown enriquecido conserva código, citas, listas y tablas sin interpretar HTML externo", () => {
  const e = entorno();
  const html = e.context.markdownToBasicHtml(
    "### Detalle\n1. Primero\n2. Segundo\n\n> Una cita **visible**\n> Otra línea\n\n```html\n<img src=x onerror=alert(1)>\n```\n\n| Campo | Valor |\n| --- | --- |\n| `<script>` | [Referencia](https://example.com/) |",
  );
  assert.ok(html.includes("<h5>Detalle</h5>"));
  assert.ok(html.includes("<ol><li>Primero</li><li>Segundo</li></ol>"));
  assert.ok(
    html.includes(
      "<blockquote><p>Una cita <strong>visible</strong><br>Otra línea</p></blockquote>",
    ),
  );
  assert.ok(
    html.includes("<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>"),
  );
  assert.ok(html.includes('tabindex="0" role="region"'));
  assert.ok(html.includes('<th scope="col">Campo</th>'));
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(!/<(?:script|img)\b/i.test(html));
});

test("preferencia de movimiento reducido se respeta al mostrar el resultado y los errores", async () => {
  const e = entorno({ reducirMovimiento: true }),
    app = vm.runInContext("radarTIC", e.context);
  app.api = e.api(async () =>
    respuestaSSE(
      "event: completado\ndata: " + JSON.stringify(resultado()) + "\n\n",
    ),
  );
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";
  await app.investigar();
  assert.equal(e.elementos.get("resultado").ultimoScroll.behavior, "auto");
  assert.equal(
    e.elementos.get("actividadKicker").textContent,
    "INVESTIGACIÓN COMPLETADA",
  );
  assert.equal(
    e.elementos.get("tituloActividad").textContent,
    "De la pregunta a la evidencia.",
  );
  e.context.mostrarError("Error de prueba");
  assert.equal(e.elementos.get("error").ultimoScroll.behavior, "auto");
});

test("las etapas y las fuentes reflejan únicamente los eventos recibidos en cada investigación", async () => {
  const etapas = ["analizando", "busqueda", "revision", "finalizando"];
  const e = entorno({ etapas });
  const app = vm.runInContext("radarTIC", e.context);
  e.elementos.get("pregunta").value = "¿Cómo proteger una API?";

  for (const usar_web of [true, false]) {
    const recibidas = usar_web ? etapas : ["analizando", "finalizando"];
    const eventos = recibidas
      .map(
        (etapa) =>
          "event: estado\ndata: " +
          JSON.stringify({ etapa, mensaje: "Estado real: " + etapa }) +
          "\n\n",
      )
      .join("");
    app.api = e.api(async () =>
      respuestaSSE(
        eventos +
          "event: completado\ndata: " +
          JSON.stringify(resultado({ usar_web, fuentes: [] })) +
          "\n\n",
      ),
    );
    e.elementos.get("usarWeb").checked = usar_web;
    await app.investigar();
    for (const paso of e.pasos) {
      assert.equal(
        paso.classList.contains("complete"),
        recibidas.includes(paso.dataset.etapa),
        paso.dataset.etapa,
      );
      assert.equal(paso.classList.contains("active"), false);
    }
    assert.equal(
      e.elementos.get("sinFuentes").textContent,
      usar_web
        ? "No se recibieron URLs de fuentes."
        : "No se utilizó búsqueda web en esta investigación.",
    );
  }
  assert.equal(
    e.pasos[1].getAttribute("title"),
    "El servidor no reportó esta etapa.",
  );
});
