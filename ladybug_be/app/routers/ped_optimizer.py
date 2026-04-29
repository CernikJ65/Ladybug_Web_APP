"""
Router pro PED optimalizator.

POST /api/ped-optimizer/analyze
  multipart/form-data:
    hbjson_file (.hbjson|.json)
    epw_file    (.epw)
    heating_setpoint_c: float = 20
    budget_czk:         float
    ashp_cost:          float = 250 000
    gshp_cost:          float = 370 000
    pv_cost_per_panel:  float =  18 000
    pv_efficiency:      float = 0.20

Soubor: ladybug_be/app/routers/ped_optimizer.py
"""
from __future__ import annotations

import os
import tempfile
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..services.progress import progress_scope, registry

router = APIRouter()

MIN_BUDGET_CZK = 10_000
VALID_MOUNTINGS = {"FixedOpenRack", "FixedRoofMounted"}


@router.post("/analyze")
async def analyze_ped(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    budget_czk: float = Form(...),
    heating_setpoint_c: float = Form(20.0),
    ashp_cost: float = Form(250_000),
    gshp_cost: float = Form(370_000),
    pv_cost_per_panel: float = Form(18_000),
    pv_efficiency: float = Form(0.20),
    mounting_type: str = Form("FixedOpenRack"),
    job_id: Optional[str] = Form(None),
):
    """PED analyza: ASHP/GSHP/jen panely vs rozpocet (Radiance+pvlib)."""
    _validate(
        hbjson_file, epw_file,
        budget_czk, heating_setpoint_c,
        ashp_cost, gshp_cost, pv_cost_per_panel,
        pv_efficiency, mounting_type,
    )
    if job_id:
        registry.create(job_id)

    hbjson_path = _save(await hbjson_file.read(), ".hbjson")
    epw_path = _save(await epw_file.read(), ".epw")

    try:
        return await run_in_threadpool(
            _run_ped,
            hbjson_path, epw_path,
            budget_czk, heating_setpoint_c,
            ashp_cost, gshp_cost, pv_cost_per_panel,
            pv_efficiency, mounting_type, job_id,
        )

    except ImportError as e:
        raise HTTPException(500, f"Chybi knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba PED analyzy: {e}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _run_ped(
    hbjson_path: str,
    epw_path: str,
    budget_czk: float,
    heating_setpoint_c: float,
    ashp_cost: float,
    gshp_cost: float,
    pv_cost_per_panel: float,
    pv_efficiency: float,
    mounting_type: str,
    job_id: Optional[str],
) -> dict:
    from ..services.ped_optimizer import PEDOptimizer, CostConfig

    cfg = CostConfig(
        ashp_total_czk=ashp_cost,
        gshp_total_czk=gshp_cost,
        pv_cost_per_panel_czk=pv_cost_per_panel,
    )
    with progress_scope(job_id):
        optimizer = PEDOptimizer(
            hbjson_path=hbjson_path,
            epw_path=epw_path,
            budget_czk=budget_czk,
            config=cfg,
            heating_setpoint_c=heating_setpoint_c,
            pv_efficiency=pv_efficiency,
            building_type="Residential",
            mounting_type=mounting_type,
        )
        return optimizer.analyze()


# ---------------------------------------------------------------------------
# Privatni
# ---------------------------------------------------------------------------

def _validate(
    hbjson: UploadFile, epw: UploadFile,
    budget: float, heat_sp: float,
    ashp: float, gshp: float, panel: float,
    pv_eff: float, mounting: str,
):
    if not hbjson.filename or not hbjson.filename.endswith(
        (".hbjson", ".json"),
    ):
        raise HTTPException(400, "Pripona .hbjson nebo .json")
    if not epw.filename or not epw.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze .epw soubory")
    if budget < MIN_BUDGET_CZK:
        raise HTTPException(
            400, f"Min rozpocet: {MIN_BUDGET_CZK:,} CZK",
        )
    if not 16.0 <= heat_sp <= 25.0:
        raise HTTPException(400, "Setpoint vytapeni: 16-25 C")
    if ashp <= 0 or gshp <= 0 or panel <= 0:
        raise HTTPException(400, "Ceny musi byt kladne")
    if not 0.05 <= pv_eff <= 0.30:
        raise HTTPException(400, "Ucinnost FVE: 5-30 %")
    if mounting not in VALID_MOUNTINGS:
        raise HTTPException(
            400,
            "Typ montaze: FixedOpenRack nebo FixedRoofMounted",
        )


def _save(content: bytes, suffix: str) -> str:
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
