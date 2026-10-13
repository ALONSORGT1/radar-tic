"""Empaqueta exclusivamente la interfaz pública para GitHub Pages."""

import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


def build(backend_url: str, destination: Path):
    url = urlsplit(backend_url)
    if url.scheme != "https" or not url.netloc or url.path not in {"", "/"} or url.query or url.fragment or url.username or url.password:
        raise ValueError("RADAR_BACKEND_URL debe ser el origen HTTPS de Vercel, sin rutas ni credenciales.")
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "index.html", destination / "index.html")
    shutil.copytree(ROOT / "assets", destination / "assets", dirs_exist_ok=True)
    (destination / "assets/js/runtime-config.js").write_text(
        "globalThis.RADAR_TIC_BACKEND_URL = " + json.dumps(f"{url.scheme}://{url.netloc}") + ";\n", encoding="utf-8"
    )
    (destination / ".nojekyll").touch()
    permitidos = {"index.html", ".nojekyll"} | {
        "assets/" + archivo.relative_to(ROOT / "assets").as_posix()
        for archivo in (ROOT / "assets").rglob("*") if archivo.is_file()
    }
    for archivo in destination.rglob("*"):
        if archivo.is_file() and archivo.relative_to(destination).as_posix() not in permitidos:
            raise ValueError("La carpeta de publicación contiene archivos ajenos a la interfaz; no se publicará.")


if __name__ == "__main__":
    build(os.environ.get("RADAR_BACKEND_URL", ""), ROOT / ".site")
