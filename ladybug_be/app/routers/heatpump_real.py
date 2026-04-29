"""
Router pro celorocni simulaci TC.

Prijima HBJSON + EPW + typ budovy + (volitelne) setpointy.
Vraci celorocni srovnani:
  - ASHP (vzduch-voda): VRF (heatcool, bez DOAS)
  - GSHP (zeme-voda): WSHP + WSHP_GSHP (heatcool, bez DOAS)

Setpointy: pokud neposlany, pouzije Ladybug default z programu.

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
    heating_only: bool = Form(False),
):
    """Celorocni simulace TC s realnym HVAC.

    CZ kalibrace (CSN 73 0331-1 BD profil + LED + EU spotrebice)
    se aplikuje AUTOMATICKY pri building_type='Residential'.
    Pro ostatni typy zustanou ASHRAE 90.1 defaulty.
    """
    _validate(
        hbjson_file, epw_file, building_type,
        heating_setpoint_c, cooling_setpoint_c, heat_recovery,
        heating_only,
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
            heating_setpoint_c=heating_setpoint_c,
            cooling_setpoint_c=cooling_setpoint_c,
            heat_recovery=heat_recovery,
            heating_only=heating_only,
        )
        return analyzer.analyze()
    except ImportError as e:
        raise HTTPException(500, f"Chybi knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba simulace: {e}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _validate(
    hbjson_file, epw_file, building_type,
    heat_sp, cool_sp, heat_recovery, heating_only,
):
    if not hbjson_file.filename or not hbjson_file.filename.endswith(
        (".hbjson", ".json")
    ):
        raise HTTPException(400, "Pripona .hbjson nebo .json")
    if not epw_file.filename or not epw_file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze .epw soubory")
    if building_type not in VALID_BUILDING_TYPES:
        raise HTTPException(
            400,
            f"Neznamy typ budovy. Vyber z: "
            f"{', '.join(VALID_BUILDING_TYPES)}",
        )
    if not 16.0 <= heat_sp <= 25.0:
        raise HTTPException(400, "Setpoint vytapeni: 16-25 C")
    if not heating_only:
        if not 22.0 <= cool_sp <= 30.0:
            raise HTTPException(400, "Setpoint chlazeni: 22-30 C")
        if heat_sp >= cool_sp:
            raise HTTPException(
                400, "Setpoint vytapeni musi byt < chlazeni",
            )
    if not 0.0 <= heat_recovery <= 0.95:
        raise HTTPException(400, "Rekuperace: 0.0-0.95")


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
