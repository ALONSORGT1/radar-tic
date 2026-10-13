# Publicación de Radar TIC

Arquitectura: navegador en GitHub Pages → FastAPI en Vercel → OpenAI Responses API.
El código conserva la ejecución en localhost y el filtro que admite únicamente TIC.

Direcciones publicadas:

- Interfaz: https://alonsorgt1.github.io/radar-tic/
- Backend: https://radar-tic.vercel.app
- Repositorio: https://github.com/ALONSORGT1/radar-tic
- Proyecto Vercel: https://vercel.com/acme-2f81/radar-tic

El proyecto `investigador` y su conexión Git se conservaron sin cambios. Radar TIC
dispone de su propio proyecto en Vercel y usa el repositorio `radar-tic`.

## Backend en Vercel

Importa el repositorio `ALONSORGT1/radar-tic`, rama `main`, raíz del proyecto.
Vercel reconoce FastAPI; `pyproject.toml` selecciona `app.main:app` como entrada y
`.python-version` fija Python 3.12. La entrada explícita evita que `app.py` oculte
el paquete `app/` al importarlo el servidor. `app.py` conserva su uso en localhost.
`vercel.json` permite hasta 300 segundos por función, sin cambiar el plan contratado.

Variables del backend:

| Variable | Valor o función |
|---|---|
| `OPENAI_API_KEY` | Credencial privada existente; nunca debe copiarse al repositorio |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `OPENAI_TIMEOUT` | `180` |
| `RADAR_ACCESS_CODE` | Código privado distinto de la clave de OpenAI |
| `ALLOWED_ORIGINS` | `https://alonsorgt1.github.io` |

Configura las credenciales como variables sensibles de producción cuando Vercel permita
esa opción. Los cambios de variables requieren un nuevo despliegue. `VERCEL=1`, que
la plataforma proporciona, activa obligatoriamente el control de acceso. CORS admite
el origen de Pages y el encabezado `Authorization`; no usa un comodín.

`.vercelignore` excluye `.env`, el entorno virtual, archivos temporales, documentación
y pruebas del paquete enviado a Vercel. `.gitignore` impide versionar esos secretos.

## Interfaz en GitHub Pages

En Settings → Pages, selecciona GitHub Actions como origen. En Settings → Secrets
and variables → Actions → Variables, crea `RADAR_BACKEND_URL` con el origen HTTPS
real del backend de producción, sin ruta ni credenciales. Es una dirección pública.

El flujo `.github/workflows/pages.yml` ejecuta `scripts/build_pages.py`. Publica
solamente `index.html`, `assets/` y `.nojekyll`, y genera `runtime-config.js` con esa
dirección. El flujo se omite mientras la dirección no esté configurada. Puede ejecutarse
manualmente o mediante un nuevo commit en `main`.

La API Key no pertenece a las variables de GitHub ni al código de JavaScript. El código
de acceso se introduce manualmente en la interfaz y permanece solamente en memoria.
Las descargas remotas usan un POST autenticado y generan el archivo en esa misma
solicitud; no dependen de un reporte guardado en otra instancia del servidor.

## Comprobaciones

Las pruebas sin consumo de OpenAI verifican el contrato, los tres modos, el filtro TIC,
renderizado seguro, cancelación, control de acceso, descarga directa y paquete de Pages.
Una validación pública debe comprobar `/api/salud`, CORS desde Pages, rechazo sin código
y una investigación TIC con un código válido antes de considerar terminado el despliegue.

Validación realizada el 13 de octubre de 2026:

- 48 pruebas automatizadas aprobadas: 24 de Python y 24 del frontend.
- GitHub Actions publicó la interfaz y Vercel desplegó FastAPI desde `main`.
- `/api/salud`: HTTP 200, modelo `gpt-6-luna`, configuración disponible y acceso obligatorio.
- CORS desde `https://alonsorgt1.github.io`: HTTP 200; origen ajeno: HTTP 400.
- Investigación sin código: HTTP 401, sin consultar OpenAI.
- Investigación real desde Pages sobre SSE y WebSocket: reporte completo, 16 fuentes
  y 15 730 tokens reportados, incluyendo la comprobación previa de especialidad.
- Las 16 URLs de las fuentes respondieron HTTP 200 y los enlaces usan una pestaña
  nueva con `noopener noreferrer`.
- Consulta de medicina en modo profundo con Web Search activado: rechazo de ámbito,
  sin borrador, fuentes ni reporte final. La comprobación de ámbito consume tokens.
- Descarga directa autenticada: HTTP 200, contenido `text/markdown`, nombre de archivo
  y reporte completo. El navegador de comprobación de Codex no capturó el archivo Blob
  generado por el botón; la entrega del archivo se verificó mediante HTTP.
- Los archivos públicos de la interfaz no contienen credenciales y `.env` devuelve
  HTTP 404 tanto en Pages como en Vercel.

Las capturas, reportes y registros de estas comprobaciones se conservan en esta
computadora en `docs/evidencias/`; no forman parte del repositorio público. La clave
de OpenAI sigue disponible en `.env` para localhost y se guarda como variable sensible
de producción en Vercel. El código privado de acceso está en `.local/codigo_acceso.txt`.

Referencias: [FastAPI en Vercel](https://vercel.com/docs/frameworks/backend/fastapi) y
[flujos de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
