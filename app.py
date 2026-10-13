"""Punto de entrada compatible con python app.py."""

import uvicorn

from app.core.config import settings
from app.main import app


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
