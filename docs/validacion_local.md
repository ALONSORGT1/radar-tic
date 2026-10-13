# Validación local de Radar TIC

Las investigaciones iniciales se realizaron el **12 de octubre de 2026**.
El filtro de especialidad se verificó el **13 de octubre de 2026 (UTC)**.
Modelo: **gpt-6-luna**. Dirección local: **http://127.0.0.1:8000**.

## Cambios realizados

- Migración de Flask a FastAPI conservando la interfaz, estilos y prompt originales.
- Separación de configuración, contratos Pydantic y servicios mediante clases.
- Credencial trasladada automáticamente a `.env`, excluido de Git y de recursos públicos.
- Modos rápido, comparativo y profundo; control para activar o desactivar Web Search.
- Manejo de entradas inválidas, errores HTTP, respuestas incompletas y cierres prematuros.
- Fuentes completas, deduplicación y conservación de nombres de instituciones.
- Corrección de las celdas vacías de la tabla y de encabezados Markdown.
- Descarga Markdown mediante FastAPI, sin otra llamada a OpenAI.
- Entorno virtual y dependencias fijadas; instrucciones de preparación e inicio.
- Filtro previo de especialidad TIC mediante salida estructurada, con bloqueo si la comprobación no autoriza la consulta.

## Pruebas automatizadas

**38 pruebas aprobadas:** 17 del backend y 21 del frontend.
No realizaron llamadas reales a OpenAI.

Se verificaron los tres modos con y sin herramienta, validación de solicitudes, fuentes
deduplicadas, actualización de títulos, reporte estructurado, recursos estáticos y CORS.
También se comprobaron errores HTTP 500, UTF-8 fragmentado, fin prematuro del flujo,
celdas vacías, contenido HTML escapado y exportación sin consumo de API.
El filtro se verificó en los tres modos, con y sin Web Search, en ambos endpoints.
Se comprobó que un rechazo, una consulta ambigua, una clasificación incompleta o un
fallo del clasificador no inicia la llamada de investigación. También se verificó
que la interfaz oculta los resultados y permite reformular la pregunta.
La validación ampliada de la interfaz, comunicación HTTP y enlaces está en
[Integración frontend/backend](integracion_frontend_backend.md).

El modo profundo se verificó con un cliente simulado. Las investigaciones reales
registradas a continuación utilizaron los modos rápido y comparativo.

## Llamadas reales a OpenAI

| Prueba | Modo | Web Search | Tokens reportados | URLs devueltas | Resultado |
|---|---|---|---:|---:|---|
| Conexión mínima | Respuesta breve | No | 24 | 0 | Completada |
| Experimento A | Rápido | No | 2077 | 0 | Reporte completo en navegador |
| Experimento B | Rápido | Sí | 25792 | 45 | Reporte completo con fuentes y enlaces |
| Perspectivas de programación | Comparativo | No | 2685 | 0 | Reporte, tabla y descarga comprobados |

**Total de las cuatro llamadas: 30,578 tokens.** Los cargos de herramientas son adicionales
al conteo de tokens; este documento no estima el costo monetario.

Pregunta idéntica para A y B:

> ¿Qué tendencias de los agentes de inteligencia artificial se observan en 2026 y qué implicaciones tienen para estudiantes de TIC? Resume tres tendencias y distingue evidencia de incertidumbre.

Pregunta del modo comparativo:

> ¿Qué ventajas y limitaciones tiene la IA generativa para el trabajo de los programadores? Compara al menos tres perspectivas y distingue hechos de expectativas.

## Comparación de los experimentos A y B

| Criterio | Sin Web Search | Con Web Search |
|---|---|---|
| Actualidad | Declara que no verifica el estado de 2026 | Incorporó información y documentos relativos a 2026 |
| Fuentes | No recibió fuentes de búsqueda | La API devolvió 45 URLs |
| Evidencia verificable | Presenta una síntesis conceptual | Incluye enlaces de NIST, Google Cloud y Stanford, entre otros |
| Fechas | Reconoce límites de actualidad | El reporte incorpora fechas y la fecha de consulta |
| Profundidad | Describe líneas plausibles generales | Distingue iniciativas institucionales, industria y uso educativo |
| Comprobación de afirmaciones | Requiere buscar evidencia por separado | Facilita abrir las referencias para contrastar afirmaciones |

La tabla describe diferencias observadas en las respuestas. No se auditó individualmente
el contenido de las 45 URLs ni se certificó cada afirmación generada.

## Evidencias

- [Experimento A: texto de la interfaz](evidencias/experimento_a.txt)
- [Experimento A: captura completa](evidencias/experimento_a.jpg)
- [Experimento B: texto y referencias](evidencias/experimento_b.txt)
- [Modo comparativo: archivo descargado desde FastAPI](evidencias/comparativo.md)
- [Captura de la versión final](evidencias/radar_tic_funcionando.jpg)
- [Casos reales de clasificación de especialidad](evidencias/especialidad.json)
- [Rechazo de medicina en la interfaz](evidencias/rechazo_medicina.jpg)
- [Rechazo de medicina: página completa](evidencias/rechazo_medicina_completo.jpg)
- [Reporte real de TIC después de incorporar el filtro](evidencias/tic_con_filtro.json)

Se comprobó que el navegador descargó el Markdown y se conservó una copia en este proyecto.
La interfaz se revisó en un viewport de 625 píxeles; el documento no presentó desbordamiento
horizontal general. La tabla mantiene su desplazamiento dentro de su contenedor.

## Validación del filtro de especialidad

Las **12 consultas de clasificación reales** obtuvieron la decisión esperada:

| Casos | Resultado |
|---|---|
| Tratamiento de gripe; dosis mencionando IA; medicina en inglés | Rechazados por estar fuera de TIC |
| Mezcla de FastAPI con antibióticos; medicamentos dentro de código Python | Rechazados por estar fuera de TIC |
| Intento de ignorar las reglas y atribuir permiso al docente | Rechazado por estar fuera de TIC |
| Receta de cocina | Rechazada por estar fuera de TIC |
| Saludo y pregunta sin objeto identificable | Solicitud de aclaración del ámbito |
| Comparación FastAPI/Flask | Permitida como TIC |
| Ciberseguridad hospitalaria y arquitectura de una API FHIR | Permitidas como TIC, limitadas al aspecto tecnológico |

Estas 12 comprobaciones consumieron **6,893 tokens**; no habilitaron herramientas,
no hicieron búsquedas ni generaron reportes. El JSON conserva preguntas, decisiones
y uso reportado por la API. Se comprobó además el rechazo de una pregunta médica
en el navegador; las verificaciones de interfaz también consumieron clasificación.
El conteo anterior corresponde únicamente a los 12 casos registrados en el JSON.

Después del filtro, una investigación rápida sin Web Search sobre las ventajas y
limitaciones de FastAPI devolvió HTTP 200, un reporte completo y tres hallazgos.
Consumió **2,806 tokens**, sumando la clasificación y la investigación, con cero
búsquedas. La respuesta está guardada en `evidencias/tic_con_filtro.json`.

La restricción se aplica en el backend, incluso si se llama directamente a la API.
Los rechazos no generan texto de reporte ni habilitan descargas; las decisiones
incompletas o fallidas tampoco autorizan una investigación. Los resultados reales
documentan estos casos concretos; la clasificación semántica depende del modelo.

## Alcance

No se inicializó Git ni se publicó en GitHub o Vercel. Se completó la implementación local.
No se registraron valores de credenciales en los reportes o capturas.
