import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    """Lee la configuración sin incluir la credencial en su representación."""

    api_key: str = field(default="", repr=False)
    model: str = "gpt-6-luna"
    timeout: float = 180.0
    host: str = "127.0.0.1"
    port: int = 8000
    access_code: str = field(default="", repr=False)
    public_deployment: bool = False
    extra_origins: tuple[str, ...] = ()

    @classmethod
    def from_environment(cls) -> "Settings":
        load_dotenv(ROOT_DIR / ".env", override=False)
        return cls(
            api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            model=os.getenv("OPENAI_MODEL", "gpt-6-luna").strip() or "gpt-6-luna",
            timeout=float(os.getenv("OPENAI_TIMEOUT", "180")),
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", "8000")),
            access_code=os.getenv("RADAR_ACCESS_CODE", "").strip(),
            public_deployment=os.getenv("VERCEL", "") == "1",
            extra_origins=tuple(origen.strip().rstrip("/") for origen in os.getenv("ALLOWED_ORIGINS", "").split(",") if origen.strip()),
        )

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    @property
    def cors_origins(self) -> list[str]:
        origenes = [f"http://127.0.0.1:{self.port}", f"http://localhost:{self.port}"]
        for origen in self.extra_origins:
            url = urlsplit(origen)
            if url.scheme not in {"https", "http"} or not url.netloc or "*" in url.netloc or url.path or url.query or url.fragment or url.username or url.password:
                raise ValueError("ALLOWED_ORIGINS debe contener orígenes HTTP/HTTPS completos, sin rutas ni comodines.")
            origenes.append(origen)
        return list(dict.fromkeys(origenes))

    @property
    def require_access(self) -> bool:
        return self.public_deployment or bool(self.access_code)


settings = Settings.from_environment()
