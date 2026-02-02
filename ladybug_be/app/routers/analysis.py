"""Endpointy pro analýzu EPW dat."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import tempfile
import os

from ..models import WindAnalysisResponse
from ..services.epw_loader import EPWLoader
from ..services.wind_rose_analyzer import WindRoseAnalyzer
from ..services.wind_rose_plotter import WindRosePlotter

router = APIRouter()


@router.post("/wind-rose", response_model=WindAnalysisResponse)
async def analyze_wind_rose(file: UploadFile = File(...)):
    """
    Nahraje EPW soubor a vytvoří větrnou růžici.
    """
    # Kontrola typu souboru
    if not file.filename.endswith('.epw'):
        raise HTTPException(status_code=400, detail="Pouze EPW soubory jsou podporovány")
    
    # Dočasné uložení souboru
    with tempfile.NamedTemporaryFile(delete=False, suffix='.epw') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Načtení EPW
        loader = EPWLoader(tmp_path)
        epw_data = loader.load()
        location_info = loader.get_location_info()
        
        # Analýza větru
        analyzer = WindRoseAnalyzer(epw_data)
        analyzer.create_wind_rose(direction_count=16)
        statistics = analyzer.get_statistics()
        
        # Vytvoření grafu
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
        # Vyčištění dočasného souboru
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)