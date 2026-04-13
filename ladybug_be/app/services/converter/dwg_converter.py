"""
Konverze DWG → DXF pomocí externích nástrojů.

Podporované nástroje (v pořadí priority):
  1. ODA File Converter — nejlepší kvalita
  2. ezdxf odafc addon — vyžaduje ODA v pozadí
  3. LibreDWG dwg2dxf  — poslední možnost, může ztratit data

Soubor: ladybug_be/app/services/converter/dwg_converter.py
"""

import os
import sys
import shutil
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Běžná umístění ODA na různých platformách
_ODA_SEARCH_PATHS = [
    r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"C:\Program Files\ODA\ODAFileConverter 27.1.0\ODAFileConverter.exe",
    r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe",
    "/usr/local/bin/ODAFileConverter",
    "/usr/bin/ODAFileConverter",
]

_DWG2DXF_SEARCH_PATHS = [
    "/usr/local/bin/dwg2dxf",
    "/usr/bin/dwg2dxf",
]


class DwgConverter:
    """Převede DWG soubor na DXF s nejlepším dostupným nástrojem."""

    TIMEOUT_S = 120

    def __init__(self):
        self.oda_path = self._find_tool(
            "ODAFileConverter", _ODA_SEARCH_PATHS,
        )
        self.dwg2dxf_path = self._find_tool(
            "dwg2dxf", _DWG2DXF_SEARCH_PATHS,
        )

    # ── veřejné API ──────────────────────────────────────

    def convert(self, dwg_path: str, dxf_path: str) -> str:
        """
        Převede DWG na DXF. Vrací cestu k DXF.
        Raises RuntimeError pokud všechny metody selžou.
        """
        dwg_path = os.path.abspath(dwg_path)
        dxf_path = os.path.abspath(dxf_path)

        if not os.path.isfile(dwg_path):
            raise FileNotFoundError(f"DWG nenalezen: {dwg_path}")

        os.makedirs(os.path.dirname(dxf_path), exist_ok=True)

        # 1. ODA (nejlepší)
        if self.oda_path and self._try_oda(dwg_path, dxf_path):
            return dxf_path

        # 2. ezdxf odafc addon
        if self._try_ezdxf_odafc(dwg_path, dxf_path):
            return dxf_path

        # 3. LibreDWG (fallback)
        if self.dwg2dxf_path and self._try_libredwg(dwg_path, dxf_path):
            return dxf_path

        raise RuntimeError(
            "Konverze DWG → DXF selhala. "
            "Nainstalujte ODA File Converter nebo LibreDWG."
        )

    @property
    def available_tools(self) -> dict:
        """Vrátí info o dostupných konverzních nástrojích."""
        return {
            "oda": self.oda_path or None,
            "ezdxf_odafc": self._has_ezdxf_odafc(),
            "libredwg": self.dwg2dxf_path or None,
        }

    # ── interní metody ───────────────────────────────────

    @staticmethod
    def _find_tool(name: str, extra: list[str]) -> str | None:
        path = shutil.which(name)
        if path:
            return path
        for p in extra:
            if os.path.isfile(p) and os.access(p, os.X_OK):
                return p
        return None

    @staticmethod
    def _has_ezdxf_odafc() -> bool:
        try:
            from ezdxf.addons import odafc  # noqa: F401
            return True
        except ImportError:
            return False

    def _try_oda(self, dwg: str, dxf: str) -> bool:
        in_dir = os.path.dirname(dwg)
        out_dir = os.path.dirname(dxf)
        in_file = os.path.basename(dwg)
        try:
            subprocess.run(
                [self.oda_path, in_dir, out_dir,
                 "ACAD2018", "DXF", "0", "1", in_file],
                capture_output=True, text=True,
                timeout=self.TIMEOUT_S,
            )
            oda_out = os.path.join(out_dir, Path(in_file).stem + ".dxf")
            if os.path.isfile(oda_out):
                if oda_out != dxf:
                    shutil.move(oda_out, dxf)
                logger.info("ODA konverze OK: %s", dxf)
                return True
        except (subprocess.TimeoutExpired, Exception) as exc:
            logger.warning("ODA selhala: %s", exc)
        return False

    @staticmethod
    def _try_ezdxf_odafc(dwg: str, dxf: str) -> bool:
        try:
            from ezdxf.addons import odafc
            doc = odafc.readfile(dwg)
            doc.saveas(dxf)
            logger.info("ezdxf odafc konverze OK: %s", dxf)
            return True
        except Exception as exc:
            logger.warning("ezdxf odafc selhala: %s", exc)
            return False

    def _try_libredwg(self, dwg: str, dxf: str) -> bool:
        try:
            subprocess.run(
                [self.dwg2dxf_path,
                 "--as", "r14", "-y", "-o", dxf, dwg],
                capture_output=True, text=True,
                timeout=self.TIMEOUT_S,
            )
            if os.path.isfile(dxf) and os.path.getsize(dxf) > 100:
                logger.info("LibreDWG konverze OK: %s", dxf)
                return True
        except Exception as exc:
            logger.warning("LibreDWG selhala: %s", exc)
        return False