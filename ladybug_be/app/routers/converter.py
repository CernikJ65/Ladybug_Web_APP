"""
Router pro konverzi DWG/DXF → HBJSON.

Endpoint přijímá DWG nebo DXF soubor od uživatele,
provede konverzi na HBJSON a vrátí:
  - kompletní HBJSON model (jako JSON)
  - validační report DXF
  - statistiky budov a terénu
  - souhrn modelu (rooms, plocha, objem)

Uživatel nemusí vědět o mezikroku DXF — pipeline
je plně automatická.

Soubor: ladybug_be/app/routers/converter.py
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import tempfile
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=suffix,
    ) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.unlink(p)
            except OSError:
                pass


@router.post("/convert")
async def convert_to_hbjson(
    file: UploadFile = File(...),
    include_terrain: bool = Form(True),
):
    """
    Převede DWG nebo DXF soubor na HBJSON model.

    Přijímá:
      - file: DWG nebo DXF soubor
      - include_terrain: zda zahrnout terén (výchozí True)

    Vrací:
      - hbjson: kompletní Honeybee model jako dict
      - validation: report validace DXF
      - buildings: statistiky extrakce budov
      - terrain_count: počet terénních ploch
      - summary: souhrn modelu
    """
    fname = (file.filename or "").lower()
    if not fname.endswith((".dwg", ".dxf")):
        raise HTTPException(
            status_code=400,
            detail="Podporované formáty: .dwg, .dxf",
        )

    suffix = ".dwg" if fname.endswith(".dwg") else ".dxf"
    input_path = _save_temp(await file.read(), suffix)
    output_path = tempfile.mktemp(suffix=".hbjson")

    try:
        from ..services.converter.dxf_to_hbjson_pipeline import (
            DxfToHbjsonPipeline,
        )

        pipeline = DxfToHbjsonPipeline(
            input_path=input_path,
            output_path=output_path,
            include_terrain=include_terrain,
        )
        result = pipeline.run()

        return JSONResponse(content={
            "hbjson": result["hbjson_dict"],
            "validation": result["validation"],
            "buildings": result["buildings"],
            "terrain_count": result["terrain_count"],
            "summary": result["summary"],
        })

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("Konverze selhala")
        raise HTTPException(
            status_code=500,
            detail=f"Chyba při konverzi: {str(exc)}",
        )
    finally:
        _cleanup(input_path, output_path)


@router.get("/tools")
async def get_available_tools():
    """Vrátí info o dostupných konverzních nástrojích."""
    from ..services.converter.dwg_converter import DwgConverter
    converter = DwgConverter()
    return converter.available_tools