# Rediseño de Radar TIC

Fecha: 26 de octubre de 2026.

## Transformación visual

Radar TIC conserva su nombre y sus capacidades de investigación, con una interfaz nueva concebida como un espacio de trabajo profesional. La pantalla prioriza la pregunta, la profundidad del análisis y las fuentes. El diseño sustituye la portada académica, los degradados y las superficies translúcidas por una composición editorial sobria, superficies claras, tipografía legible y controles agrupados por función.

La identidad combina un símbolo original de radar y nodos de conocimiento con estas referencias cromáticas:

| Uso | Tema claro | Tema oscuro |
| --- | --- | --- |
| Fondo principal | `#f8f9f5` | `#151b18` |
| Superficie | `#ffffff` | `#1c241f` |
| Texto | `#242d27` | `#e7eee4` |
| Texto secundario | `#626c62` | `#aab6a9` |
| Acento | `#24634b` | `#b5d59d` |
| Barra lateral | `#202923` | `#111813` |
| Bordes | `#dce2d8` | `#364239` |

Los tokens de color, espaciado, radios, sombras y fuentes se centralizan en `assets/css/styles.css`. Manrope se utiliza en controles y lectura; Newsreader aporta el contraste editorial de los títulos. Las fuentes incluyen alternativas del sistema. El tema respeta la preferencia inicial del sistema y permite guardar la elección en `localStorage`, bajo `radar-tic-theme`. El tema puede cambiar aunque el navegador impida ese almacenamiento.

## Arquitectura de la interfaz

- **Navegación:** barra lateral compacta con nueva investigación, acceso a la consulta y guía. En pantallas pequeñas se convierte en un panel desplegable con cierre mediante Escape y controles etiquetados.
- **Consulta:** campo principal amplio, contador de caracteres, profundidad, búsqueda web, acceso privado cuando el backend lo exige y atajo Ctrl/⌘ + Enter. Las ideas sugeridas rellenan la consulta para poder revisarla antes de enviarla.
- **Guía:** instrucciones sobre cómo formular una pregunta, seguir la investigación y consultar el reporte. No incorpora secciones de datos ficticios.
- **Actividad:** estado comunicado por el servidor, borrador recibido por streaming y fuentes detectadas. Los indicadores dependen de los eventos reales del backend.
- **Reporte:** presentación de resumen, plan, hallazgos, comparación, coincidencias, diferencias, tendencias, conclusión y referencias, con descarga Markdown y metadatos reales.
- **Estados:** espera, procesamiento, finalización, cancelación, fallo y problemas de acceso conservan mensajes visibles y controles coherentes.

El mismo sistema visual cubre formularios, tablas, citas, código, fuentes y errores. El diseño responde al ancho disponible, limita los desbordamientos de contenido largo, conserva indicadores de foco y respeta `prefers-reduced-motion`.

## Identidad gráfica y favicon

El símbolo combina un arco de radar, una línea de descubrimiento y dos nodos. Su construcción sencilla mantiene el contraste en tamaños pequeños.

Archivos integrados mediante rutas relativas en `index.html`:

- `assets/img/favicon.svg`: versión vectorial principal.
- `assets/img/favicon-16.png`: versión de 16 × 16 píxeles.
- `assets/img/favicon-32.png`: versión de 32 × 32 píxeles.
- `assets/img/apple-touch-icon.png`: icono de 180 × 180 píxeles.

También se actualizan el título del navegador, la descripción y el color del tema.

## Archivos de la entrega

| Archivo | Cambio |
| --- | --- |
| `index.html` | Nueva estructura semántica, navegación, consulta, guía, actividad y reportes; metadatos e iconos. |
| `assets/css/styles.css` | Sistema de tokens, temas, componentes, estados, responsive y movimiento reducido. |
| `assets/js/app.js` | Comportamientos de presentación: tema, navegación móvil, contador, sugerencias, atajos y nueva investigación. |
| `assets/img/favicon.svg` | Símbolo vectorial original. |
| `assets/img/favicon-16.png` | Favicon pequeño. |
| `assets/img/favicon-32.png` | Favicon de navegador. |
| `assets/img/apple-touch-icon.png` | Icono táctil. |
| `tests/frontend.test.cjs` | Verificación de los nuevos controles y de la conservación de los flujos existentes. |
| `docs/rediseno-ui.md` | Descripción de la entrega y su validación. |

El README y las evidencias locales ya tenían cambios previos ajenos al rediseño y no forman parte de esta lista.

## Funcionalidad preservada

Se mantiene la separación entre frontend estático, FastAPI y OpenAI. No se cambian los endpoints ni el contrato de solicitudes: `pregunta` de 1 a 4000 caracteres, `modo` (`rapido`, `comparativo` o `profundo`) y `usar_web` booleano.

Se conservan la comprobación de especialidad TIC, los eventos SSE `estado`, `fuente`, `texto`, `completado` y `error`, la deduplicación de fuentes, el renderizado seguro del contenido, la cancelación y la prevención de solicitudes duplicadas. Los estados de investigación reflejan lo comunicado por el servidor; no se simulan pasos internos.

El código de acceso permanece únicamente en memoria durante el uso de la página y se transmite al backend como autorización Bearer. No se guarda junto con el tema ni se incorpora a los archivos públicos. La descarga remota mantiene el POST autenticado que genera el reporte en la misma solicitud, sin depender de memoria compartida entre instancias de Vercel.

## GitHub Pages

Se conserva el despliegue existente desde `main` mediante `.github/workflows/pages.yml`. El frontend público utiliza el prefijo `/radar-tic/`; HTML, CSS, JavaScript y favicon mantienen rutas relativas compatibles.

El flujo ejecuta `scripts/build_pages.py` con `RADAR_BACKEND_URL` configurado como el origen HTTPS público del backend. El paquete `.site` contiene exclusivamente `index.html`, `assets/` y `.nojekyll`. La configuración pública generada en `assets/js/runtime-config.js` selecciona el backend; los secretos siguen en el servidor.

Comprobación local del paquete desde PowerShell:

```powershell
$env:RADAR_BACKEND_URL = 'https://radar-tic.vercel.app'
.\.venv\Scripts\python.exe scripts/build_pages.py
```

Un push a `main` activa la publicación existente. No se necesita migrar el framework ni agregar una compilación de paquetes JavaScript.

## Validación

| Comprobación | Resultado |
| --- | --- |
| Pruebas frontend | 33 aprobadas, incluidas las 24 originales y la verificación de etapas realmente reportadas. |
| Pruebas Python, backend y publicación | 24 aprobadas. |
| Construcción del paquete de Pages | Correcta. |
| Revisión visual de escritorio, móvil y tema oscuro | Revisadas anchuras de 1440, 768, 390 y 320 píxeles sin desbordamiento horizontal. Temas claro/oscuro, contraste, navegación móvil y tablas desplazables revisados. |
| Flujos en navegador y consola | Investigación real, descarga, ejemplos, cancelación y modo sin web correctos; sin errores de aplicación ni advertencias en consola. |
| Publicación | Paquete estático preparado con rutas relativas. El push a main activa el workflow; su resultado y la URL pública se verifican en la entrega final. |
| Conexión real con IA desde la interfaz rediseñada | Investigación local comparativa con búsqueda web sobre OAuth/JWT completada: 18 fuentes, 8 secciones y una tabla. Descarga Markdown de 8161 bytes recibida en Descargas. |
| Modo sin búsqueda web | Investigación real sobre API REST completada, reporte estructurado y estado explícito de ausencia de fuentes externas. |

Comandos de las pruebas automatizadas:

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node --test tests/frontend.test.cjs
```

Las pruebas automatizadas usan un cliente de OpenAI simulado y no consumen la API. Las comprobaciones de navegador indicadas como reales utilizan el backend y el modelo configurados. Se conservan capturas locales del antes, después, temas y reporte, fuera del paquete público. Persiste un aviso de deprecación de Starlette/httpx durante las pruebas, sin fallos asociados.

La vista previa del paquete en un puerto local distinto del backend público no está autorizada por su política CORS, como corresponde a la configuración existente. Las pruebas reales locales se realizan sirviendo la interfaz con FastAPI en el mismo origen. La publicación usa el origen de Pages ya autorizado y el backend HTTPS existente.
