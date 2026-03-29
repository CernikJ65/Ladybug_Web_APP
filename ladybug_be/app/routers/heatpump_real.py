"""
Router pro celoroční simulaci TČ s reálným HVAC.

Endpoint přijímá HBJSON + EPW a vrací celoroční výsledky
dvou reálných HVAC systémů:
  - VRFwithDOAS (vzduch-voda TČ)
  - WSHPwithDOAS GSHP (země-voda TČ)

Na rozdíl od /api/heatpump tento endpoint nepočítá COP
z Carnotova cyklu — EnergyPlus simuluje reálné výkonové
křivky HVAC zařízení včetně chlazení v létě.

Soubor: ladybug_be/app/routers/heatpump_real.py
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import tempfile
import os

router = APIRouter()

VALID_BUILDING_TYPES = [
    "Residential", "Office", "Retail",
    "School", "Hotel", "Hospital",
]


@router.post("/analyze")
async def analyze_real_heatpump(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    building_type: str = Form("Office"),
    heating_setpoint_c: float = Form(20.0),
    cooling_setpoint_c: float = Form(26.0),
    heat_recovery: float = Form(0.0),
    electricity_price: float = Form(6.0),
    grid_co2_kg_per_mwh: float = Form(450.0),
):
    """Celoroční simulace TČ s reálným HVAC."""
    _validate(
        hbjson_file, epw_file, heating_setpoint_c,
        cooling_setpoint_c, heat_recovery,
        electricity_price, grid_co2_kg_per_mwh,
    )
    hbjson_path = _save(await hbjson_file.read(), ".hbjson")
    epw_path = _save(await epw_file.read(), ".epw")

    try:
        from ..services.heatpump_real.real_hp_analyzer import (
            RealHPAnalyzer,
        )
        analyzer = RealHPAnalyzer(
            hbjson_path=hbjson_path,
            epw_path=epw_path,
            building_type=building_type,
            heating_sp=heating_setpoint_c,
            cooling_sp=cooling_setpoint_c,
            heat_recovery=heat_recovery,
            electricity_price=electricity_price,
            grid_co2=grid_co2_kg_per_mwh,
        )
        return analyzer.analyze()
    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba simulace: {e}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _validate(
    hbjson_file, epw_file, heat_sp, cool_sp,
    heat_recovery, price, co2,
):
    if not hbjson_file.filename or not hbjson_file.filename.endswith(
        (".hbjson", ".json")
    ):
        raise HTTPException(400, "Přípona .hbjson nebo .json")
    if not epw_file.filename or not epw_file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze .epw soubory")
    if not 16.0 <= heat_sp <= 25.0:
        raise HTTPException(400, "Setpoint vytápění: 16–25 °C")
    if not 22.0 <= cool_sp <= 30.0:
        raise HTTPException(400, "Setpoint chlazení: 22–30 °C")
    if heat_sp >= cool_sp:
        raise HTTPException(
            400, "Setpoint vytápění musí být < chlazení",
        )
    if not 0.0 <= heat_recovery <= 0.95:
        raise HTTPException(400, "Rekuperace: 0.0–0.95")
    if price < 0:
        raise HTTPException(400, "Cena elektřiny ≥ 0")
    if co2 < 0:
        raise HTTPException(400, "CO₂ intenzita ≥ 0")


def _save(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=suffix,
    ) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)