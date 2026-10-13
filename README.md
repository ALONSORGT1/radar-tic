# Radar TIC · Práctica 2.2

Agente investigador con FastAPI, OpenAI Responses API y Web Search, compatible con localhost y publicación separada de interfaz y backend.
Se adaptó el proyecto Flask existente conservando su interfaz, estilos y prompt académico.

## Ejecutar en esta computadora

El entorno virtual y las dependencias ya están preparados. Desde la raíz:

```powershell
.\.venv\Scripts\python.exe app.py
```

Abre **http://127.0.0.1:8000** y deja la terminal ejecutándose.
También puedes usar `iniciar.ps1` cuando PowerShell permita ejecutar scripts.
Para la instancia que Codex dejó activa puedes ejecutar `detener.ps1`.
Cuando inicies el servidor en una terminal, detén esa instancia con Ctrl+C.

La credencial existente fue trasladada a `.env` sin mostrarla. Se eliminó el antiguo
`config.py` que la contenía. No copies credenciales en capturas, reportes o código.

## Preparar otra instalación

Requiere Python 3.12. Desde la carpeta del proyecto:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Configura `OPENAI_API_KEY` localmente en `.env` y mantén `OPENAI_MODEL=gpt-6-luna`,
el modelo indicado por la guía. `.env.example` documenta timeout, host y puerto.
Reinicia completamente el servidor después de cambiar `.env`.

`preparar.ps1` automatiza la preparación y puede utilizar el runtime de Python de Codex
si Python no está en PATH. Los comandos usan el intérprete del entorno virtual directamente.

El comando equivalente al enunciado para localhost es:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Cómo investigar

1. Escribe una pregunta de hasta 4000 caracteres.
2. Selecciona Rápido, Comparativo o Profundo.
3. Activa Usar búsqueda web para consultar información externa.
4. Inicia la investigación y observa el texto, la actividad y las fuentes.
5. Revisa el reporte y registra la fecha, modelo y tokens mostrados.
6. Descarga el reporte como Markdown. Esa descarga no vuelve a consultar OpenAI.

Cada investigación consume la API de OpenAI. Web Search también puede generar cargos.
Antes de investigar, una llamada breve comprueba la especialidad de la consulta, sin
herramientas ni búsquedas. Esa comprobación consume tokens incluso si la consulta se
rechaza. El total mostrado en un reporte suma la comprobación y la investigación;
representa tokens reportados por OpenAI, no el costo monetario.
Cancelar interrumpe el flujo local; OpenAI puede haber realizado consumo previamente.
Las solicitudes al proveedor no tienen reintentos automáticos.

| Modo | Alcance | Máximo de tokens de salida, incluido razonamiento | Máximo de llamadas a herramientas |
|---|---|---:|---:|
| Rápido | Síntesis breve y 3 hallazgos | 5000 | 2 |
| Comparativo | Alternativas, ventajas y perspectivas | 7500 | 4 |
| Profundo | Más evidencia, fechas y al menos 5 hallazgos | 11000 | 6 |

Las URLs provienen de la herramienta y las citas. Evalúa su autoridad, actualidad y
confiabilidad; su aparición no significa que todas tengan igual calidad.

## Especialidad: únicamente TIC

El backend comprueba cada consulta en los tres modos, con y sin Web Search, antes de
generar texto de investigación o habilitar búsquedas. La decisión utiliza una salida
estructurada con tres ámbitos: TIC, fuera de TIC y ambiguo. Si la comprobación falla,
queda incompleta o no devuelve una decisión válida, la investigación no se inicia.
El prompt investigador también exige respetar esta especialidad.

- **Permitidas:** software, APIs, IA, datos, redes, telecomunicaciones, nube, IoT y ciberseguridad.
- **Rechazadas:** medicina clínica, síntomas, diagnósticos, tratamientos y otros temas ajenos a TIC.
- **Salud y TIC:** proteger una base de datos de historias clínicas o diseñar su API sí pertenece a TIC; recomendar medicamentos o dosis no pertenece.
- **Consultas mixtas:** si una pregunta combina TIC con contenido ajeno, se rechaza completa y debe reformularse.
- **Consultas ambiguas:** se solicita una pregunta tecnológica más concreta.

Mencionar IA, Internet o Python no basta para autorizar una consulta ajena. Tampoco
se aceptan instrucciones del usuario para cambiar la especialidad. La interfaz
muestra el motivo del rechazo, sin un reporte ni un borrador de respuesta.

## Experimentos A y B

Usa exactamente la misma pregunta y modo. Desactiva Web Search en A y actívalo en B.
Compara actualidad, fuentes, evidencia verificable, fechas, profundidad y posibilidad
de comprobar afirmaciones. La validación está en `docs/validacion_local.md`, con textos
y capturas en `docs/evidencias/`.

## Organización

```text
app/
├── main.py                         # FastAPI, CORS, endpoints y recursos
├── core/config.py                  # Settings y variables de entorno
├── models/investigacion.py          # Solicitud, modos, fuentes y respuesta
└── services/
    ├── investigador_service.py     # Responses API, Web Search y SSE
    ├── especialidad_service.py      # Comprobación previa del ámbito TIC
    ├── reporte_parser.py           # Secciones del reporte
    ├── instrucciones.md            # Prompt original adaptado
    └── exportador_service.py       # Archivos Markdown temporales
assets/
├── css/styles.css                  # Diseño original y controles
└── js/
    ├── runtime-config.js           # Dirección pública del backend en Pages
    ├── config.js                   # RadarTICConfig: dirección del backend
    ├── api.js                      # RadarTICApi: HTTP y lectura SSE
    └── app.js                      # RadarTICApp: interfaz y presentación
index.html                          # Interfaz servida por FastAPI
app.py                              # Entrada para python app.py
.env                                # Configuración privada
.env.example                        # Ejemplo sin credenciales
.python-version                     # Python 3.12
requirements.txt                    # Versiones fijadas mediante pip freeze
tests/                              # Pruebas sin consumo de API
```

Se conservaron las funciones de presentación como utilidades del controlador.
`api.js` concentra todas las peticiones HTTP, incluida la exportación. `app.js`
valida la entrada, impide solicitudes simultáneas, permite cancelar y presenta los
campos estructurados de FastAPI. El Markdown se conserva para descarga y como
alternativa de presentación; los textos y enlaces externos se renderizan de forma segura.
El servicio hace una llamada a Responses API para comprobar el ámbito y, solo si es
TIC, otra para investigar. El modelo puede efectuar varias búsquedas dentro de esta
segunda llamada. Se solicitan las fuentes completas y se exige la herramienta cuando
Web Search está activado.

## Endpoints

| Ruta | Función |
|---|---|
| GET / | Interfaz |
| GET /assets/... | Recursos estáticos |
| GET /api/salud | Estado local y modelo; no consulta OpenAI |
| POST /api/investigar | Investigación progresiva mediante SSE |
| POST /api/investigar/reporte | Investigación completa como JSON estructurado |
| POST /api/reportes/exportar | Prepara un archivo sin consultar OpenAI |
| GET /api/reportes/{id}/descargar | Entrega el Markdown preparado |
| POST /api/reportes/descargar | Descarga directa, sin depender de memoria compartida |
| GET /docs | Documentación interactiva de FastAPI |

```json
{"pregunta":"¿Qué tecnologías convienen para conectar dispositivos IoT?","modo":"comparativo","usar_web":true}
```

Eventos SSE: `estado`, `fuente`, `texto`, `completado` y `error`.
La respuesta final incluye resumen, plan, hallazgos, comparación, coincidencias,
diferencias, tendencias, conclusión, fuentes, Markdown, fecha, modelo y tokens.
Una entrada con formato inválido recibe HTTP 422 antes de consultar OpenAI.
Un rechazo de ámbito termina el SSE con un evento `error` y el código
`fuera_de_especialidad` o `especialidad_ambigua`, sin eventos de texto ni reporte final.
En el endpoint JSON estos rechazos reciben HTTP 422. Una clasificación incompleta o
sin decisión válida recibe HTTP 503 en JSON; no continúa la investigación.
La credencial nunca se entrega al frontend.

En localhost se conservan hasta 20 descargas en memoria mientras el servidor está activo.
La interfaz publicada descarga mediante un POST directo para funcionar entre distintas
instancias de Vercel. Ninguna descarga consulta OpenAI.

## Publicación: GitHub Pages y Vercel

El repositorio es [ALONSORGT1/radar-tic](https://github.com/ALONSORGT1/radar-tic).
GitHub Pages publica únicamente `index.html` y `assets/`; FastAPI se ejecuta en Vercel.
La preparación y las variables necesarias se describen en [Despliegue](docs/despliegue.md).

`OPENAI_API_KEY` se configura como variable privada del backend en Vercel. Nunca se
incluye en el repositorio, en el paquete de Pages ni en solicitudes del navegador.
El backend público exige además `RADAR_ACCESS_CODE`, un código de acceso diferente
de la clave de OpenAI. El usuario lo introduce en la interfaz y se envía únicamente
al backend mediante HTTPS. No se guarda en archivos públicos ni en almacenamiento
del navegador. Sin un código configurado, Vercel rechaza las investigaciones.

## Pruebas sin consumo de API

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node --test tests/frontend.test.cjs
```

Node se usa solamente para las pruebas del frontend. La aplicación no necesita paquetes
JavaScript adicionales. Las pruebas utilizan un cliente de OpenAI simulado.

La comprobación detallada del frontend está en [Integración frontend/backend](docs/integracion_frontend_backend.md).
La validación inicial incluyó 38 pruebas automatizadas, una investigación real en el navegador, verificación
HTTP de sus 29 fuentes y reproducciones locales para comprobar errores, cancelación y HTML malicioso.

## Alcance y referencias

Se conserva la ejecución local. La configuración de publicación se prueba sin consumo
de API junto con el contrato del frontend, el control de acceso y la descarga directa.

- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Web Search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Salidas estructuradas con Responses API](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [FastAPI](https://fastapi.tiangolo.com/advanced/custom-response/)
