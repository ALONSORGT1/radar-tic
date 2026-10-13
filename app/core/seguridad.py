from hmac import compare_digest

from fastapi import HTTPException, Request

from app.core.config import Settings


def comprobar_acceso(request: Request, config: Settings) -> None:
    if not config.require_access:
        return
    if not config.access_code:
        raise HTTPException(503, "El acceso privado del servidor aún no está configurado.")
    tipo, _, codigo = request.headers.get("Authorization", "").partition(" ")
    if tipo.lower() != "bearer" or not compare_digest(codigo.encode("utf-8"), config.access_code.encode("utf-8")):
        raise HTTPException(401, "Introduce un código de acceso válido para Radar TIC.", headers={"WWW-Authenticate": "Bearer"})
