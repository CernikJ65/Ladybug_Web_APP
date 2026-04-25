"""
Solar analysis router – endpoint pro optimalizaci FV panelů.

Router pouze validuje vstupy a pipeline spouští v threadpoolu.
Veškerá orchestrace žije v solar_pipeline.run_solar_pipeline.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from typing import Optional
import tempfile
import os

from ..services.progress import registry
from .solar_pipeline import run_solar_pipeline

router = APIRouter()


@router.post("/optimize-panels")
async def optimize_panels(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    num_panels: int = Form(10),
    pv_efficiency: float = Form(0.20),
    system_losses: float = Form(0.10),
    panel_width: float = Form(1.0),
    panel_height: float = Form(1.7),
    panel_spacing: float = Form(0.3),
    max_tilt: float = Form(60.0),
    mounting_type: str = Form("FixedOpenRack"),
    pv_engine: str = Form("energyplus"),
    job_id: Optional[str] = Form(None),
):
    """Optimalizuje rozmístění FV panelů na střechách."""
    if not hbjson_file.filename.endswith((".hbjson", ".json")):
        raise HTTPException(400, "HBJSON: přípona .hbjson nebo .json")
    if not epw_file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory")
    if num_panels < 1:
        raise HTTPException(400, "Počet panelů musí být alespoň 1")
    if not 0.19 <= pv_efficiency <= 0.24:
        raise HTTPException(
            400,
            "pv_efficiency musí být v rozsahu 0.19–0.24 (19–24 %).",
        )
    pv_engine = (pv_engine or "energyplus").lower()
    if pv_engine not in ("energyplus", "pvlib", "both"):
        raise HTTPException(
            400, "pv_engine musí být 'energyplus', 'pvlib' nebo 'both'"
        )

    # Registruj job hned, ať první polling z FE nedostane 404 (FE
    # začíná pollovat ihned po odeslání POST, ale progress_scope se
    # vytváří až uvnitř threadpoolu po načtení souborů).
    if job_id:
        registry.create(job_id)

    hbjson_path = _save_temp(await hbjson_file.read(), ".hbjson")
    epw_path = _save_temp(await epw_file.read(), ".epw")

    try:
        return await run_in_threadpool(
            run_solar_pipeline,
            hbjson_path,
            epw_path,
            num_panels,
            pv_efficiency,
            system_losses,
            panel_width,
            panel_height,
            panel_spacing,
            max_tilt,
            mounting_type,
            pv_engine,
            job_id,
        )
    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba: {str(e)}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)
