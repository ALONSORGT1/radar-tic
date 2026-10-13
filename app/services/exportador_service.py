from collections import OrderedDict
from uuid import uuid4

from app.models.investigacion import InvestigacionRespuesta


class ExportadorReportes:
    """Mantiene hasta 20 archivos de texto en memoria durante la sesión del servidor."""

    def __init__(self):
        self.archivos = OrderedDict()

    @staticmethod
    def generar(reporte: InvestigacionRespuesta) -> tuple[str, bytes]:
        referencias = "\n".join(f"- [{fuente.titulo}]({fuente.url})" for fuente in reporte.fuentes)
        texto = reporte.reporte + "\n\n## Fuentes consultadas\n"
        texto += referencias or "Sin fuentes consultadas mediante búsqueda web."
        texto += f"\n\nFecha: {reporte.fecha.isoformat()}\nModo: {reporte.modo.value}\nModelo: {reporte.modelo}\n"
        nombre = f"radar-tic-{reporte.fecha.date().isoformat()}-{reporte.modo.value}.md"
        return nombre, texto.encode("utf-8")

    def crear(self, reporte: InvestigacionRespuesta) -> str:
        identificador = uuid4().hex
        self.archivos[identificador] = self.generar(reporte)
        while len(self.archivos) > 20:
            self.archivos.popitem(last=False)
        return identificador

    def obtener(self, identificador: str):
        return self.archivos.get(identificador)
