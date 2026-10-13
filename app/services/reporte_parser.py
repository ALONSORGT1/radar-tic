import re
import unicodedata
from datetime import datetime, timezone

from pydantic import ValidationError

from app.models.investigacion import (
    Fuente,
    Hallazgo,
    InvestigacionRespuesta,
    InvestigacionSolicitud,
    UsoTokens,
)


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto.lower())
    return "".join(char for char in texto if not unicodedata.combining(char))


class ReporteParser:
    """Conserva el Markdown original y extrae el contrato de respuesta."""

    @staticmethod
    def secciones(markdown: str) -> dict[str, str]:
        resultado: dict[str, str] = {}
        actual = ""
        for linea in markdown.replace("\r", "").splitlines():
            encabezado = re.match(r"^\s*##\s+(.+?)\s*#*\s*$", linea)
            if encabezado:
                actual = normalizar(re.sub(r"^\d+[.)]?\s*", "", encabezado[1]))
                resultado.setdefault(actual, "")
            elif actual:
                resultado[actual] += linea + "\n"
        return {clave: valor.strip() for clave, valor in resultado.items()}

    @staticmethod
    def lista(texto: str) -> list[str]:
        return [
            re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", linea).strip()
            for linea in texto.splitlines()
            if re.match(r"^\s*(?:[-*•]|\d+[.)])\s+", linea)
        ]

    @staticmethod
    def hallazgos(texto: str) -> list[Hallazgo]:
        resultado = []
        for bloque in re.split(r"(?=^\s*###\s+Hallazgo\s+\d+)", texto, flags=re.M | re.I):
            encabezado = re.match(r"\s*###\s+Hallazgo\s+\d+(?:\s*:\s*(.*))?", bloque, re.I)
            if not encabezado:
                continue
            campos = {}
            for campo in ("Nombre", "Descripción", "Fuente", "URL"):
                match = re.search(
                    rf"\*\*{campo}:\*\*\s*(.*?)(?=\n\s*\*\*(?:Nombre|Descripción|Fuente|URL):\*\*|\Z)",
                    bloque,
                    re.S | re.I,
                )
                campos[normalizar(campo)] = match[1].strip() if match else ""
            enlace = re.search(r"\[([^\]]+)\]\((https?://[^)]+)\)", campos["fuente"])
            if enlace:
                campos["fuente"] = enlace[1]
            url_match = re.search(r"https?://[^\s)\]]+", campos["url"] or (enlace[2] if enlace else ""))
            datos = {
                "nombre": campos["nombre"] or encabezado[1] or "Hallazgo",
                "descripcion": campos["descripcion"],
                "fuente": campos["fuente"],
                "url": url_match[0].rstrip(".,;") if url_match else None,
            }
            try:
                resultado.append(Hallazgo(**datos))
            except ValidationError:
                datos["url"] = None
                resultado.append(Hallazgo(**datos))
        return resultado

    @classmethod
    def respuesta(
        cls,
        solicitud: InvestigacionSolicitud,
        markdown: str,
        modelo: str,
        fuentes: list[Fuente],
        uso: UsoTokens,
        busquedas: int,
    ) -> InvestigacionRespuesta:
        secciones = cls.secciones(markdown)
        coincidencias = secciones.get("coincidencias y diferencias entre fuentes", "")
        subsecciones = re.split(r"^\s*###\s+", coincidencias, flags=re.M)
        listas = {}
        for bloque in subsecciones:
            lineas = bloque.splitlines()
            if lineas:
                listas[normalizar(lineas[0].strip())] = cls.lista("\n".join(lineas[1:]))
        return InvestigacionRespuesta(
            pregunta=solicitud.pregunta,
            modo=solicitud.modo,
            usar_web=solicitud.usar_web,
            modelo=modelo,
            fecha=datetime.now(timezone.utc),
            resumen=secciones.get("resumen ejecutivo", secciones.get("resumen", "")),
            plan=cls.lista(secciones.get("plan de investigacion", "")),
            hallazgos=cls.hallazgos(secciones.get("hallazgos principales", "")),
            comparacion=secciones.get("comparacion de informacion", ""),
            coincidencias=listas.get("coincidencias", []),
            diferencias=listas.get("diferencias", []),
            tendencias=cls.lista(secciones.get("tendencias identificadas", "")),
            conclusion=secciones.get("conclusiones", secciones.get("conclusion", "")),
            fuentes=fuentes,
            reporte=markdown,
            total_fuentes=len(fuentes),
            busquedas=busquedas,
            uso=uso,
        )
