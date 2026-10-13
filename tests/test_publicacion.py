import importlib.util
import tempfile
import unittest
from pathlib import Path


archivo = Path(__file__).resolve().parents[1] / "scripts/build_pages.py"
spec = importlib.util.spec_from_file_location("build_pages", archivo)
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


class PublicacionTests(unittest.TestCase):
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
