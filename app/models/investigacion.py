from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StrictBool, StringConstraints


class ModoInvestigacion(str, Enum):
    RAPIDO = "rapido"
    COMPARATIVO = "comparativo"
    PROFUNDO = "profundo"


class InvestigacionSolicitud(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pregunta: Annotated[
        str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=4000)
    ]
    modo: ModoInvestigacion = ModoInvestigacion.RAPIDO
    usar_web: StrictBool = True


class Fuente(BaseModel):
    titulo: str
    url: HttpUrl
    origen: str = "cita"


class Hallazgo(BaseModel):
    nombre: str
    descripcion: str
    fuente: str = ""
    url: HttpUrl | None = None


class UsoTokens(BaseModel):
    entrada: int = Field(default=0, ge=0)
    salida: int = Field(default=0, ge=0)
    total: int = Field(default=0, ge=0)


class InvestigacionRespuesta(BaseModel):
    pregunta: str
    modo: ModoInvestigacion
    usar_web: bool
    modelo: str
    fecha: datetime
    resumen: str = ""
    plan: list[str] = Field(default_factory=list)
    hallazgos: list[Hallazgo] = Field(default_factory=list)
    comparacion: str = ""
    coincidencias: list[str] = Field(default_factory=list)
    diferencias: list[str] = Field(default_factory=list)
    tendencias: list[str] = Field(default_factory=list)
    conclusion: str = ""
    fuentes: list[Fuente] = Field(default_factory=list)
    reporte: Annotated[str, StringConstraints(min_length=1)]
    total_fuentes: int = Field(ge=0)
    busquedas: int = Field(default=0, ge=0)
    uso: UsoTokens = Field(default_factory=UsoTokens)
