import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


archivo = Path(__file__).resolve().parents[1] / "scripts/build_pages.py"
spec = importlib.util.spec_from_file_location("build_pages", archivo)
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


class PublicacionTests(unittest.TestCase):
    def test_entrada_vercel_se_importa_en_un_proceso_limpio(self):
        raiz = archivo.parents[1]
        codigo = """
import importlib.util
import sys
import tomllib
from pathlib import Path
from fastapi import FastAPI

config = tomllib.loads(Path('pyproject.toml').read_text(encoding='utf-8'))
nombre, objeto = config['tool']['vercel']['entrypoint'].split(':')
ruta = Path(*nombre.split('.')).with_suffix('.py')
spec = importlib.util.spec_from_file_location(nombre, ruta)
modulo = importlib.util.module_from_spec(spec)
sys.modules[nombre] = modulo
spec.loader.exec_module(modulo)
app = getattr(modulo, objeto)
assert isinstance(app, FastAPI)
assert any(getattr(ruta, 'path', '') == '/api/salud' for ruta in app.routes)
"""
        resultado = subprocess.run([sys.executable, '-B', '-c', codigo], cwd=raiz, capture_output=True, text=True)
        self.assertEqual(resultado.returncode, 0, resultado.stderr)

    def test_solo_publica_interfaz_y_url_publica(self):
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta)
            modulo.build("https://backend-prueba.vercel.app", destino)
            archivos = [p.relative_to(destino).as_posix() for p in destino.rglob("*") if p.is_file()]
            self.assertIn("index.html", archivos)
            self.assertIn("assets/js/runtime-config.js", archivos)
            self.assertTrue(all(a in {"index.html", ".nojekyll"} or a.startswith("assets/") for a in archivos))
            self.assertFalse(any(a.startswith("app/") or ".env" in a for a in archivos))
            self.assertIn("backend-prueba.vercel.app", (destino / "assets/js/runtime-config.js").read_text())
            html = (destino / "index.html").read_text(encoding="utf-8")
            self.assertNotIn('src="/assets/', html)
            self.assertNotIn('href="/assets/', html)

    def test_rechaza_urls_con_credenciales_y_archivos_ajenos(self):
        with tempfile.TemporaryDirectory() as carpeta:
            destino = Path(carpeta)
            for url in ("", "http://example.com", "https://user:password@example.com", "https://example.com/api"):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    modulo.build(url, destino)
            (destino / ".env").write_text("ARCHIVO_DE_PRUEBA=1")
            with self.assertRaises(ValueError):
                modulo.build("https://backend-prueba.vercel.app", destino)


if __name__ == "__main__":
    unittest.main()
