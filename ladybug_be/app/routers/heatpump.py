"""
Router pro analýzu potenciálu tepelných čerpadel.

Endpoint přijímá HBJSON + EPW a vrací potenciál obnovitelné
energie z TČ vzduch-voda a země-voda pro každou místnost,
včetně ekonomických a environmentálních metrik.

Nový parametr heat_recovery (0.0–0.95) umožňuje simulovat
rekuperaci tepla z odvodního vzduchu. Výchozí 0.0 = vypnuto.

Soubor: ladybug_be/app/routers/heatpump.py
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
async def analyze_heatpump_potential(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    supply_temp_c: float = Form(35.0),
    collector_depth_m: float = Form(1.5),
    building_type: str = Form("Office"),
    heating_setpoint_c: float = Form(20.0),
    electricity_price: float = Form(6.0),
    grid_co2_kg_per_mwh: float = Form(450.0),
    heat_recovery: float = Form(0.0),
):
    """Analyzuje potenciál obnovitelné energie z TČ.

    Pipeline:
      1. HBJSON → honeybee Model → PED konstrukce
      2. EPW → EnergyPlus → tepelné zátěže per room
      3. EPW → Ladybug SCOP (Carnot) → obnovitelná frakce
      4. Spotřeba elektřiny, úspory, CO₂
    """
    _validate_inputs(
        hbjson_file, epw_file, supply_temp_c,
        collector_depth_m, heating_setpoint_c,
        electricity_price, grid_co2_kg_per_mwh,
        heat_recovery,
    )

    hbjson_path = _save_temp(await hbjson_file.read(), ".hbjson")
    epw_path = _save_temp(await epw_file.read(), ".epw")

    try:
        from ..services.heatpump_potential_analyzer import (
            HeatPumpPotentialAnalyzer,
        )
        analyzer = HeatPumpPotentialAnalyzer(
            hbjson_path=hbjson_path,
            epw_path=epw_path,
            supply_temp_c=supply_temp_c,
            collector_depth_m=collector_depth_m,
            building_type=building_type,
            heating_setpoint_c=heating_setpoint_c,
            electricity_price=electricity_price,
            grid_co2_kg_per_mwh=grid_co2_kg_per_mwh,
            heat_recovery=heat_recovery,
        )
        return analyzer.analyze()
    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba při analýze TČ: {e}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _validate_inputs(
    hbjson_file, epw_file, supply_temp_c,
    collector_depth_m, heating_setpoint_c,
    electricity_price, grid_co2_kg_per_mwh,
    heat_recovery,
):
    if not hbjson_file.filename or not hbjson_file.filename.endswith(
        (".hbjson", ".json")
    ):
        raise HTTPException(400, "HBJSON: přípona .hbjson nebo .json")
    if not epw_file.filename or not epw_file.filename.endswith(
        ".epw"
    ):
        raise HTTPException(400, "Pouze EPW soubory (.epw)")
    if not 25.0 <= supply_temp_c <= 65.0:
        raise HTTPException(400, "Teplota topné vody: 25–65 °C")
    if not 0.5 <= collector_depth_m <= 4.0:
        raise HTTPException(400, "Hloubka kolektoru: 0.5–4.0 m")
    if not 16.0 <= heating_setpoint_c <= 25.0:
        raise HTTPException(400, "Setpoint vytápění: 16–25 °C")
    if electricity_price < 0:
        raise HTTPException(400, "Cena elektřiny musí být ≥ 0")
    if grid_co2_kg_per_mwh < 0:
        raise HTTPException(400, "CO₂ intenzita musí být ≥ 0")
    if not 0.0 <= heat_recovery <= 0.95:
        raise HTTPException(
            400, "Rekuperace: 0.0–0.95 (0=vypnuto)",
        )


def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=suffix,
    ) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)