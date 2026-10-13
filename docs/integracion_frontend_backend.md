# Integración frontend/backend de Radar TIC

Validación local del 13 de octubre de 2026. Aplicación: http://127.0.0.1:8000.
Se mantuvieron la identidad visual del docente, FastAPI y la separación existente de módulos.
No se añadieron dependencias ni se modificó el backend en esta etapa.

## Archivos modificados

| Archivo | Cambio y propósito |
|---|---|
| `assets/js/config.js` | Conserva el origen del servidor que entrega la interfaz, incluso con otro puerto local. Centraliza modos y longitud máxima; impide construir endpoints externos o salir de `/api/`. |
| `assets/js/api.js` | Concentra salud, investigación SSE y exportación HTTP. Maneja errores de conexión/HTTP/JSON, cancelación y fin prematuro. Rechaza resultados vacíos o campos incompatibles y valida la ruta de descarga. |
| `assets/js/app.js` | Valida la pregunta y modo; bloquea investigaciones y descargas simultáneas; restaura controles tras éxito, error o cancelación. Presenta los campos estructurados, conserva el Markdown y escapa contenido externo. Normaliza y deduplica fuentes; permite únicamente enlaces HTTP/HTTPS sin credenciales. |
| `index.html` | Conserva el diseño y controles. Añade asociación del campo con su ayuda, estado accesible y `aria-busy`. Versiona recursos para cargar las correcciones. |
| `assets/css/styles.css` | Añade margen de desplazamiento para que la barra fija no tape el encabezado principal del reporte o el aviso. |
| `tests/frontend.test.cjs` | Amplía las pruebas de contrato, modos, estados, cancelación, solicitudes duplicadas, descarga, enlaces y contenido malicioso. |
| `README.md`, `docs/validacion_local.md` | Actualiza instrucciones y resultados; este documento registra la integración y sus evidencias. |

## Flujo de comunicación

1. FastAPI entrega `index.html` y los recursos de `/assets/`. Se debe abrir la aplicación desde este servidor local.
2. `app.js` comprueba una pregunta no vacía de hasta 4000 caracteres y un modo válido. Si ya hay una investigación activa, no envía otra.
3. `config.js` construye el endpoint del mismo origen. `api.js` envía `POST /api/investigar` con `pregunta`, `modo` y `usar_web`; no incluye credenciales de OpenAI.
4. FastAPI valida el contrato Pydantic. El servicio comprueba el ámbito TIC y, si lo autoriza, llama a OpenAI Responses API con Web Search cuando corresponde.
5. FastAPI transmite eventos SSE: `estado`, `fuente`, `texto`, `completado` o `error`. `api.js` decodifica UTF-8 y reconstruye eventos aunque lleguen fragmentados.
6. `app.js` muestra actividad, borrador y fuentes. El resultado final usa resumen, plan, hallazgos, comparación, coincidencias, diferencias, tendencias y conclusión del contrato estructurado. El Markdown queda disponible para descargar.
7. Para descargar, `api.js` envía `POST /api/reportes/exportar` y devuelve un enlace local validado. FastAPI entrega el Markdown mediante `GET /api/reportes/{id}/descargar`, sin otra llamada a OpenAI.

La configuración privada se utiliza solamente en el backend. `.env` y el código Python
no son recursos públicos. El análisis de HTML/CSS/JS no encontró credenciales incrustadas,
cabeceras Bearer ni comunicación directa con `api.openai.com`.

## Funcionalidades comprobadas

| Comprobación | Resultado |
|---|---|
| Campo de pregunta y modos rápido/comparativo/profundo | Controles presentes; las seis combinaciones de modo y Web Search cumplen el contrato. |
| Entrada vacía, longitud excesiva o modo inválido | No se envían solicitudes de investigación. La entrada vacía también se comprobó en el navegador real. |
| Investigación activa | Pregunta, modo, Web Search e inicio quedan bloqueados; Cancelar está disponible. Una segunda llamada del controlador no envía otra petición. |
| Cancelación | Interrumpe la lectura y restaura controles; no habilita un reporte ni su descarga. |
| Errores | Se muestran mensajes de conexión, HTTP, SSE o respuesta inválida. Un error de descarga conserva el resultado ya completado para volver a intentar. |
| Respuesta vacía | Se rechaza antes de mostrar éxito o habilitar la descarga. |
| Resultados estructurados | Se presentaron las ocho secciones, cinco hallazgos, una tabla de tres alternativas, fecha, modo, modelo y tokens. |
| Fuentes y citas | URLs normalizadas, enlaces en pestaña nueva con `noopener noreferrer`; citas de descripciones y listas se presentan como enlaces. |
| Sin Web Search | El panel final indica que no hay fuentes externas consultadas cuando la lista está vacía. |
| Seguridad de contenido | HTML, scripts y atributos de eventos permanecen como texto escapado; los protocolos `javascript:`/`data:` y URLs con credenciales se rechazan. |
| Presentación | En el viewport de prueba de 1265 píxeles no hubo desbordamiento horizontal general y el encabezado principal quedó debajo de la barra fija. La tabla conserva su contenedor de desplazamiento. |

## Pruebas automatizadas y navegador

**38 pruebas aprobadas: 17 del backend y 21 del frontend.** No consumen OpenAI.

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node --test tests/frontend.test.cjs
```

Además se reprodujo por HTTP un reporte real previamente guardado, usando una instancia
temporal de FastAPI en el puerto 8011. Hubo nueve solicitudes de prueba y cero llamadas
a OpenAI. En un navegador real se comprobaron los tres modos, citas, ausencia de fuentes
con Web Search desactivado, errores, respuesta vacía, bloqueo de controles, cancelación
y una carga maliciosa de HTML/JavaScript. Esta última produjo cero elementos ejecutables
y cero enlaces con protocolos peligrosos. La instancia temporal se cerró al terminar.

## Investigación real a través de la interfaz

Pregunta:

> Compara FastAPI, Flask y Django REST Framework para crear APIs en Python. Usa sus documentos oficiales como fuentes y explica diferencias, coincidencias y una tendencia del desarrollo web.

- Modelo: `gpt-6-luna`; modo comparativo; Web Search activado.
- Resultado completo: ocho secciones, cinco hallazgos, tabla con tres alternativas y 29 enlaces de fuentes.
- Consumo reportado: **24,555 tokens**, incluyendo comprobación de especialidad e investigación. Este conteo no representa el costo monetario de las herramientas.
- Las **29 URLs respondieron HTTP 200**, siguiendo redirecciones cuando correspondía. La comprobación acredita disponibilidad en ese momento, no una auditoría de todas las afirmaciones del reporte.
- La descarga de Markdown se completó desde el navegador mediante FastAPI.

## Evidencias

- [Resultado real: texto, metadatos, secciones y enlaces visibles](evidencias/integracion_frontend.json)
- [Reporte real descargado](evidencias/integracion_frontend.md)
- [Captura del resultado real](evidencias/integracion_frontend.jpg)
- [Verificación HTTP de las 29 fuentes](evidencias/enlaces_frontend.json)
- [Casos de interfaz con reproducción local](evidencias/pruebas_interfaz_local.json)
- [Solicitudes de la reproducción y contador de llamadas a OpenAI](evidencias/solicitudes_frontend_local.json)
- [Captura de la comprobación visual final](evidencias/integracion_frontend_prueba.jpg)
