"""Endpointy pro analýzu EPW dat."""
from fastapi import APIRouter, UploadFile, File, HTTPException
import tempfile
import os

from ..models import WindAnalysisResponse
from ..services.epw_loader import EPWLoader
from ..services.wind_rose_analyzer import WindRoseAnalyzer
from ..services.wind_rose_plotter import WindRosePlotter

router = APIRouter()


# ------------------------------------------------------------------
# Pomocné funkce
# ------------------------------------------------------------------

def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)


# ------------------------------------------------------------------
# 1. Větrná růžice (existující)
# ------------------------------------------------------------------

@router.post("/wind-rose", response_model=WindAnalysisResponse)
async def analyze_wind_rose(file: UploadFile = File(...)):
    """Nahraje EPW soubor a vytvoří větrnou růžici."""
    if not file.filename.endswith('.epw'):
        raise HTTPException(status_code=400, detail="Pouze EPW soubory jsou podporovány")

    tmp_path = _save_temp(await file.read(), ".epw")

    try:
        loader = EPWLoader(tmp_path)
        epw_data = loader.load()
        location_info = loader.get_location_info()

        analyzer = WindRoseAnalyzer(epw_data)
        analyzer.create_wind_rose(direction_count=16)
        statistics = analyzer.get_statistics()

        plotter = WindRosePlotter(analyzer.wind_rose, epw_data)
        plot_base64 = plotter.create_plot()

        return WindAnalysisResponse(
            location=location_info,
            statistics=statistics,
            plot_base64=plot_base64
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při analýze: {str(e)}")
    finally:
        _cleanup(tmp_path)


# ------------------------------------------------------------------
# 2. Teplotní analýza (nové)
# ------------------------------------------------------------------

@router.post("/temperature")
async def analyze_temperature(file: UploadFile = File(...)):
    """Teplotní profil, denostupně, heatmapa, ASHRAE zóna."""
    if not file.filename or not file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory (.epw)")

    tmp_path = _save_temp(await file.read(), ".epw")

    try:
        from ladybug.epw import EPW
        from ..services.temperature_analyzer import TemperatureAnalyzer

        epw = EPW(tmp_path)
        loc = epw.location
        analyzer = TemperatureAnalyzer(epw)

        return {
            "location": {
                "city": loc.city,
                "latitude": round(loc.latitude, 3),
                "longitude": round(loc.longitude, 3),
                "elevation": round(loc.elevation, 1),
            },
            "temperature": analyzer.analyze(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba při analýze: {str(e)}")
    finally:
        _cleanup(tmp_path)


# ------------------------------------------------------------------
# 3. Sluneční dráha (nové)
# ------------------------------------------------------------------

@router.post("/sunpath")
async def analyze_sunpath(file: UploadFile = File(...)):
    """Sluneční dráha: oblouky, východ/západ, analemmy."""
    if not file.filename or not file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory (.epw)")

    tmp_path = _save_temp(await file.read(), ".epw")

    try:
        from ladybug.epw import EPW
        from ..services.sunpath_calculator import SunpathCalculator

        epw = EPW(tmp_path)
        loc = epw.location
        analyzer = SunpathCalculator(epw)

        return {
            "location": {
                "city": loc.city,
                "latitude": round(loc.latitude, 3),
                "longitude": round(loc.longitude, 3),
                "elevation": round(loc.elevation, 1),
            },
            "sunpath": analyzer.analyze(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba při analýze: {str(e)}")
    finally:
        _cleanup(tmp_path)


# ------------------------------------------------------------------
# 4. Rozšířená větrná analýza (nové)
# ------------------------------------------------------------------

@router.post("/wind-advanced")
async def analyze_wind_advanced(file: UploadFile = File(...)):
    """SVG wind rose data, měsíční rychlosti, Beaufort distribuce."""
    if not file.filename or not file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory (.epw)")

    tmp_path = _save_temp(await file.read(), ".epw")

    try:
        from ladybug.epw import EPW
        from ..services.wind_analyzer import WindAnalyzerAdvanced

        epw = EPW(tmp_path)
        loc = epw.location
        analyzer = WindAnalyzerAdvanced(epw)

        return {
            "location": {
                "city": loc.city,
                "latitude": round(loc.latitude, 3),
                "longitude": round(loc.longitude, 3),
                "elevation": round(loc.elevation, 1),
            },
            "wind": analyzer.analyze(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba při analýze: {str(e)}")
    finally:
        _cleanup(tmp_path)