import json
from contextlib import aclosing, asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import ROOT_DIR, settings
from app.core.seguridad import comprobar_acceso
from app.models.investigacion import InvestigacionRespuesta, InvestigacionSolicitud
from app.services.investigador_service import InvestigadorService
from app.services.exportador_service import ExportadorReportes


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.investigador = InvestigadorService(settings)
    application.state.exportador = ExportadorReportes()
    try:
        yield
    finally:
        await application.state.investigador.cerrar()


app = FastAPI(title="Radar TIC", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Disposition"],
)
app.mount("/assets", StaticFiles(directory=ROOT_DIR / "assets"), name="assets")


@app.exception_handler(RequestValidationError)
async def entrada_invalida(request: Request, error: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": "Revisa la solicitud: pregunta de 1 a 4000 caracteres, modo válido y usar_web verdadero o falso."},
    )


@app.get("/", include_in_schema=False)
async def inicio():
    return FileResponse(ROOT_DIR / "index.html")


@app.get("/api/salud")
async def salud():
    return {"estado": "ok", "agente": "Radar TIC", "configurado": settings.configured, "modelo": settings.model, "requiere_acceso": settings.require_access}


def autorizar(request: Request):
    comprobar_acceso(request, settings)


def servicio(request: Request) -> InvestigadorService:
    if not settings.configured:
        raise HTTPException(503, "Configura OPENAI_API_KEY en .env y reinicia el servidor.")
    return request.app.state.investigador


@app.post("/api/investigar", response_class=StreamingResponse, dependencies=[Depends(autorizar)])
async def investigar(solicitud: InvestigacionSolicitud, request: Request):
    investigador = servicio(request)

    async def generar():
        async with aclosing(investigador.investigar(solicitud)) as eventos:
            async for tipo, contenido in eventos:
                yield f"event: {tipo}\ndata: {json.dumps(contenido, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generar(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/investigar/reporte", response_model=InvestigacionRespuesta, dependencies=[Depends(autorizar)])
async def investigar_reporte(solicitud: InvestigacionSolicitud, request: Request):
    investigador = servicio(request)
    async with aclosing(investigador.investigar(solicitud)) as eventos:
        async for tipo, contenido in eventos:
            if tipo == "error":
                if contenido.get("codigo") in {"fuera_de_especialidad", "especialidad_ambigua"}:
                    raise HTTPException(422, contenido["mensaje"])
                if contenido.get("codigo") == "especialidad_no_verificada":
                    raise HTTPException(503, contenido["mensaje"])
                raise HTTPException(502, contenido["mensaje"])
            if tipo == "completado":
                return InvestigacionRespuesta.model_validate(contenido)
    raise HTTPException(502, "La investigación terminó sin respuesta.")


@app.post("/api/reportes/exportar", dependencies=[Depends(autorizar)])
async def exportar_reporte(reporte: InvestigacionRespuesta, request: Request):
    identificador = request.app.state.exportador.crear(reporte)
    nombre, _ = request.app.state.exportador.obtener(identificador)
    return {"url": f"/api/reportes/{identificador}/descargar", "nombre": nombre}


@app.get("/api/reportes/{identificador}/descargar", include_in_schema=False, dependencies=[Depends(autorizar)])
async def descargar_reporte(identificador: str, request: Request):
    archivo = request.app.state.exportador.obtener(identificador)
    if archivo is None:
        raise HTTPException(404, "El reporte no está disponible. Prepara nuevamente su descarga.")
    nombre, contenido = archivo
    return Response(contenido, media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{nombre}"'})


@app.post("/api/reportes/descargar", dependencies=[Depends(autorizar)])
async def descargar_directamente(reporte: InvestigacionRespuesta):
    nombre, contenido = ExportadorReportes.generar(reporte)
    return Response(contenido, media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{nombre}"'})
