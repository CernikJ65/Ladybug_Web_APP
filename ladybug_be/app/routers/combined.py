"""
Router pro PED analýzu — obě E+ simulace.

DŮLEŽITÉ: hbjson_path se maže až PO combined analýze,
protože solární pipeline ho potřebuje pro RoofDetector.

Soubor: ladybug_be/app/routers/combined.py
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import tempfile
import os

router = APIRouter()


@router.post("/analyze")
async def analyze_combined(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    budget_czk: float = Form(500_000),
    pv_efficiency: float = Form(0.20),
    building_type: str = Form("Residential"),
    supply_temp_c: float = Form(35.0),
    heating_setpoint_c: float = Form(20.0),
    ashp_cost: float = Form(345_000),
    gshp_cost: float = Form(500_000),
    pv_cost_per_panel: float = Form(18_000),
):
    """PED analýza: TČ (E+) + FVE (E+) + rozpočet."""
    _validate(hbjson_file, epw_file, budget_czk)

    hbjson_path = _save(await hbjson_file.read(), ".hbjson")
    epw_path = _save(await epw_file.read(), ".epw")

    try:
        from ..services.heatpump_potential_analyzer import (
            HeatPumpPotentialAnalyzer,
        )
        from ..services.combined import (
            CombinedEnergyAnalyzer, CostConfig,
        )

        # 1. TČ pipeline (EnergyPlus tepelná simulace)
        hp = HeatPumpPotentialAnalyzer(
            hbjson_path=hbjson_path,
            epw_path=epw_path,
            supply_temp_c=supply_temp_c,
            building_type=building_type,
            heating_setpoint_c=heating_setpoint_c,
        )
        hp_result = hp.analyze()

        # 2. Kombinovaná analýza (spustí solární E+ pipeline)
        cfg = CostConfig(
            ashp_total_czk=ashp_cost,
            gshp_total_czk=gshp_cost,
            pv_cost_per_panel_czk=pv_cost_per_panel,
        )
        combined = CombinedEnergyAnalyzer(
            hp_result=hp_result,
            hbjson_path=hbjson_path,
            epw_path=epw_path,
            budget_czk=budget_czk,
            pv_efficiency=pv_efficiency,
            config=cfg,
        )
        result = combined.analyze()

        loc = hp_result.get("location", {})
        return {
            "location": loc.get("city", ""),
            "room_count": hp_result.get(
                "model_info", {},
            ).get("room_count", 0),
            **result,
        }

    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba analýzy: {e}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _validate(hbjson, epw, budget):
    if not hbjson.filename or not hbjson.filename.endswith(
        (".hbjson", ".json"),
    ):
        raise HTTPException(400, "Přípona .hbjson/.json")
    if not epw.filename or not epw.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW (.epw)")
    if budget < 10_000:
        raise HTTPException(400, "Min rozpočet: 10 000 CZK")


def _save(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=suffix,
    ) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths):
    for p in paths:
        try:
            os.unlink(p)
        except OSError:
            pass