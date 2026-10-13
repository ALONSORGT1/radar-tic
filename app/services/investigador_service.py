import logging
from collections.abc import AsyncIterator

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    RateLimitError,
)
from pydantic import ValidationError

from app.core.config import ROOT_DIR, Settings
from app.models.investigacion import Fuente, InvestigacionSolicitud, UsoTokens
from app.services.especialidad_service import ErrorEspecialidad, EspecialidadService
from app.services.reporte_parser import ReporteParser


logger = logging.getLogger(__name__)

PERFILES = {
    "rapido": {"esfuerzo": "low", "contexto": "low", "tokens": 5000, "busquedas": 2,
               "instruccion": "Responde de forma breve. Incluye 3 hallazgos y un plan de 3 pasos."},
    "comparativo": {"esfuerzo": "low", "contexto": "medium", "tokens": 7500, "busquedas": 4,
                    "instruccion": "Compara al menos 3 alternativas o perspectivas. Explica ventajas, límites y escenarios."},
    "profundo": {"esfuerzo": "medium", "contexto": "high", "tokens": 11000, "busquedas": 6,
                 "instruccion": "Profundiza en evidencia, fechas, perspectivas y limitaciones. Incluye al menos 5 hallazgos y busca varias fuentes independientes."},
}


def valor(objeto, atributo, default=None):
    return objeto.get(atributo, default) if isinstance(objeto, dict) else getattr(objeto, atributo, default)


class ErrorInvestigacion(Exception):
    """Mensaje público controlado: nunca contiene el error crudo del proveedor."""


class InvestigadorService:
    def __init__(self, config: Settings, client=None):
        self.config = config
        self.client = client
        if self.client is None and config.configured:
            self.client = AsyncOpenAI(api_key=config.api_key, timeout=config.timeout, max_retries=0)
        self.instrucciones = (ROOT_DIR / "app/services/instrucciones.md").read_text(encoding="utf-8")
        self.especialidad = EspecialidadService(self.client, config.model)

    async def cerrar(self):
        if self.client is not None:
            await self.client.close()

    def parametros(self, solicitud: InvestigacionSolicitud) -> dict:
        perfil = PERFILES[solicitud.modo.value]
        instrucciones = self.instrucciones + "\n\nMODO DE INVESTIGACIÓN: " + solicitud.modo.value
        instrucciones += "\n" + perfil["instruccion"]
        if solicitud.usar_web:
            instrucciones += "\nUtiliza la búsqueda web. Conserva citas verificables y señala la fecha de la información."
        else:
            instrucciones += (
                "\nEXPERIMENTO SIN WEB SEARCH: responde con tu conocimiento disponible. "
                "Explica los límites de actualidad. No afirmes haber consultado Internet ni inventes citas. "
                "En Fuente y URL escribe 'No consultada' cuando no dispongas de evidencia verificable."
            )
        parametros = {
            "model": self.config.model,
            "instructions": instrucciones,
            "input": solicitud.pregunta,
            "reasoning": {"effort": perfil["esfuerzo"]},
            "max_output_tokens": perfil["tokens"],
            "stream": True,
            "store": False,
        }
        if solicitud.usar_web:
            parametros.update(
                tools=[{"type": "web_search", "search_context_size": perfil["contexto"]}],
                tool_choice="required",
                include=["web_search_call.action.sources"],
                max_tool_calls=perfil["busquedas"],
            )
        return parametros

    @staticmethod
    def mensaje_error(error: Exception) -> str:
        if isinstance(error, (ErrorInvestigacion, ErrorEspecialidad)):
            return str(error)
        if isinstance(error, AuthenticationError):
            return "OpenAI rechazó la credencial. Revisa OPENAI_API_KEY en tu archivo .env."
        if isinstance(error, RateLimitError):
            if getattr(error, "code", None) == "insufficient_quota":
                return "El proyecto de OpenAI no tiene cuota disponible. Revisa su facturación y límites de uso."
            return "OpenAI alcanzó un límite de solicitudes. Espera un momento antes de volver a intentar."
        if isinstance(error, NotFoundError):
            return "El modelo configurado no está disponible para este proyecto de OpenAI. Revisa OPENAI_MODEL."
        if isinstance(error, APITimeoutError):
            return "OpenAI tardó demasiado en responder. Intenta una investigación rápida."
        if isinstance(error, APIConnectionError):
            return "No se pudo conectar con OpenAI. Revisa tu conexión a Internet."
        if isinstance(error, BadRequestError):
            return "OpenAI rechazó la configuración de la investigación. Revisa el modelo y su compatibilidad con Web Search."
        if isinstance(error, APIStatusError):
            return "OpenAI no pudo atender la investigación en este momento."
        return "No se pudo completar la investigación. Revisa el servidor local e inténtalo de nuevo."

    async def investigar(self, solicitud: InvestigacionSolicitud) -> AsyncIterator[tuple[str, dict]]:
        fuentes: dict[str, Fuente] = {}
        llamadas_web = set()
        fragmentos = []
        stream = None
        terminado = False

        def registrar(url, titulo=None, origen="cita"):
            if not url:
                return None
            try:
                fuente = Fuente(titulo=titulo or str(url), url=url, origen=origen)
            except ValidationError:
                return None
            clave = str(fuente.url)
            anterior = fuentes.get(clave)
            if anterior and (fuente.titulo == clave or anterior.titulo != clave):
                return None
            fuentes[clave] = fuente
            return fuente.model_dump(mode="json")

        def fuentes_item(item):
            nuevas = []
            if valor(item, "type") == "web_search_call":
                llamadas_web.add(valor(item, "id", str(len(llamadas_web))))
                accion = valor(item, "action")
                encontrada = registrar(valor(accion, "url"), origen=valor(accion, "type", "web_search"))
                if encontrada:
                    nuevas.append(encontrada)
                for fuente in valor(accion, "sources", []) or []:
                    encontrada = registrar(valor(fuente, "url"), valor(fuente, "title"), "search")
                    if encontrada:
                        nuevas.append(encontrada)
            elif valor(item, "type") == "message":
                for contenido in valor(item, "content", []) or []:
                    for cita in valor(contenido, "annotations", []) or []:
                        if valor(cita, "type") == "url_citation":
                            encontrada = registrar(valor(cita, "url"), valor(cita, "title"))
                            if encontrada:
                                nuevas.append(encontrada)
            return nuevas

        try:
            if self.client is None:
                raise ErrorInvestigacion("Configura OPENAI_API_KEY en .env y reinicia el servidor.")
            yield "estado", {"etapa": "validando", "mensaje": "Comprobando que la pregunta pertenece a TIC..."}
            uso_validacion = await self.especialidad.validar(solicitud.pregunta)
            yield "estado", {"etapa": "analizando", "mensaje": "Analizando la pregunta de investigación..."}
            stream = await self.client.responses.create(**self.parametros(solicitud))
            async for event in stream:
                tipo = valor(event, "type", "")
                if tipo in {"response.web_search_call.in_progress", "response.web_search_call.searching"}:
                    yield "estado", {"etapa": "busqueda", "mensaje": "Buscando y contrastando fuentes en Internet..."}
                elif tipo == "response.web_search_call.completed":
                    yield "estado", {"etapa": "revision", "mensaje": "Revisando la evidencia encontrada..."}
                elif tipo == "response.output_item.done":
                    for fuente in fuentes_item(valor(event, "item")):
                        yield "fuente", fuente
                elif tipo == "response.output_text.annotation.added":
                    cita = valor(event, "annotation")
                    if valor(cita, "type") == "url_citation":
                        fuente = registrar(valor(cita, "url"), valor(cita, "title"))
                        if fuente:
                            yield "fuente", fuente
                elif tipo == "response.output_text.delta":
                    delta = valor(event, "delta", "")
                    if delta:
                        fragmentos.append(delta)
                        yield "texto", {"delta": delta}
                elif tipo == "response.output_text.done":
                    yield "estado", {"etapa": "finalizando", "mensaje": "Organizando el reporte final..."}
                elif tipo == "response.failed":
                    raise ErrorInvestigacion("OpenAI informó que la investigación falló. Inténtalo de nuevo.")
                elif tipo == "response.incomplete":
                    raise ErrorInvestigacion("La respuesta de OpenAI quedó incompleta. Reduce el alcance de la pregunta o utiliza otro modo.")
                elif tipo == "error":
                    raise ErrorInvestigacion("OpenAI interrumpió la investigación antes de terminar.")
                elif tipo == "response.completed":
                    respuesta = valor(event, "response")
                    for item in valor(respuesta, "output", []) or []:
                        for fuente in fuentes_item(item):
                            yield "fuente", fuente
                    markdown = "".join(fragmentos).strip() or valor(respuesta, "output_text", "").strip()
                    if not markdown:
                        raise ErrorInvestigacion("OpenAI terminó sin generar un reporte de investigación.")
                    uso_api = valor(respuesta, "usage")
                    uso = UsoTokens(
                        entrada=(valor(uso_api, "input_tokens", 0) or 0) + uso_validacion.entrada,
                        salida=(valor(uso_api, "output_tokens", 0) or 0) + uso_validacion.salida,
                        total=(valor(uso_api, "total_tokens", 0) or 0) + uso_validacion.total,
                    )
                    reporte = ReporteParser.respuesta(solicitud, markdown, self.config.model, list(fuentes.values()), uso, len(llamadas_web))
                    terminado = True
                    yield "completado", {"mensaje": "Investigación completada.", **reporte.model_dump(mode="json")}
                    break
            if not terminado:
                raise ErrorInvestigacion("La conexión terminó antes de completar la investigación. Inténtalo de nuevo.")
        except Exception as error:
            logger.warning("Investigación interrumpida: %s", type(error).__name__)
            contenido = {"mensaje": self.mensaje_error(error)}
            if isinstance(error, ErrorEspecialidad):
                contenido.update(codigo=error.codigo, uso=error.uso.model_dump(mode="json"), busquedas=0)
            yield "error", contenido
        finally:
            if stream is not None:
                await stream.close()
