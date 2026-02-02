"""Solar analysis router."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import tempfile
import os
from typing import Optional

router = APIRouter()


@router.post("/analyze-roof-potential")
async def analyze_roof_potential(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    pv_efficiency: float = Form(0.18),
    system_losses: float = Form(0.14),
    max_tilt: float = Form(60.0)
):
    """
    Analyzuje solární potenciál střech z HBJSON modelu.
    """
    # Kontrola formátů
    if not hbjson_file.filename.endswith(('.hbjson', '.json')):
        raise HTTPException(status_code=400, detail="HBJSON soubor musí mít příponu .hbjson nebo .json")
    
    if not epw_file.filename.endswith('.epw'):
        raise HTTPException(status_code=400, detail="Pouze EPW soubory jsou podporovány")
    
    # Dočasné uložení souborů
    with tempfile.NamedTemporaryFile(delete=False, suffix='.hbjson') as hbjson_tmp:
        hbjson_content = await hbjson_file.read()
        hbjson_tmp.write(hbjson_content)
        hbjson_path = hbjson_tmp.name
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.epw') as epw_tmp:
        epw_content = await epw_file.read()
        epw_tmp.write(epw_content)
        epw_path = epw_tmp.name
    
    try:
        from ..services.hbjson_parser import HBJSONParser
        from ..services.solar_calculator import SolarRadiationCalculator, SolarPotentialEstimator
        
        # 1. Načtení HBJSON modelu
        parser = HBJSONParser(hbjson_path)
        parser.load_model()
        
        # 2. Detekce střech
        roof_surfaces = parser.detect_roof_surfaces(max_tilt=max_tilt)
        
        if not roof_surfaces:
            raise HTTPException(
                status_code=400,
                detail=f"V modelu nebyly nalezeny žádné střešní plochy (max sklon {max_tilt}°)"
            )
        
        # 3. Načtení klimatických dat
        calculator = SolarRadiationCalculator(epw_path)
        calculator.load_weather_data()
        location_info = calculator.get_location_info()
        
        # 4. Výpočet radiace pro každou střechu
        roof_results = []
        total_radiation = 0.0
        total_area = 0.0
        
        for roof in roof_surfaces:
            # Výpočet roční radiace
            annual_radiation = calculator.calculate_annual_radiation_simple(
                tilt=roof.tilt,
                azimuth=roof.azimuth,
                area=roof.area
            )
            
            # Radiace na m²
            radiation_per_m2 = annual_radiation / roof.area if roof.area > 0 else 0
            
            # PV odhad
            estimator = SolarPotentialEstimator(
                pv_efficiency=pv_efficiency,
                system_losses=system_losses
            )
            pv_production = estimator.estimate_annual_energy_production(
                annual_radiation_kwh_m2=radiation_per_m2,
                area_m2=roof.area
            )
            
            roof_results.append({
                "identifier": roof.identifier,
                "area_m2": round(roof.area, 2),
                "tilt_degrees": round(roof.tilt, 2),
                "azimuth_degrees": round(roof.azimuth, 2),
                "orientation": roof.get_orientation(),
                "center": [round(c, 2) for c in roof.center],
                "annual_radiation_kwh": round(annual_radiation, 2),
                "annual_radiation_kwh_m2": round(radiation_per_m2, 2),
                "pv_production": pv_production
            })
            
            total_radiation += annual_radiation
            total_area += roof.area
        
        # 5. Celkové výsledky
        total_pv_production = sum(r["pv_production"]["annual_production_kwh"] for r in roof_results)
        total_capacity = sum(r["pv_production"]["installed_capacity_kwp"] for r in roof_results)
        
        estimator = SolarPotentialEstimator(pv_efficiency, system_losses)
        env_impact = estimator.estimate_environmental_impact(total_pv_production)
        
        # Celková performance ratio
        specific_yield = total_pv_production / total_capacity if total_capacity > 0 else 0
        
        return {
            "model_info": {
                "model_name": parser.model.display_name or "Model",
                "total_roof_area_m2": round(total_area, 2),
                "roof_count": len(roof_surfaces)
            },
            "location": location_info,
            "roof_analysis": {
                "total_roof_area_m2": round(total_area, 2),
                "total_annual_radiation_kwh": round(total_radiation, 2),
                "average_radiation_kwh_m2": round(total_radiation / total_area, 2) if total_area > 0 else 0,
                "roof_surfaces": roof_results
            },
            "energy_production": {
                "annual_production_kwh": round(total_pv_production, 2),
                "monthly_avg_kwh": round(total_pv_production / 12, 2),
                "daily_avg_kwh": round(total_pv_production / 365, 2),
                "installed_capacity_kwp": round(total_capacity, 2),
                "specific_yield_kwh_per_kwp": round(specific_yield, 2),
                "performance_ratio": 1.0 - system_losses
            },
            "environmental_impact": env_impact,
            "parameters": {
                "pv_efficiency": pv_efficiency,
                "system_losses": system_losses,
                "performance_ratio": 1.0 - system_losses
            }
        }
    
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chybí Python knihovny: {str(e)}. Nainstalujte: pip install honeybee-core ladybug-core"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chyba při analýze: {str(e)}")
    
    finally:
        # Vyčištění dočasných souborů
        if os.path.exists(hbjson_path):
            os.unlink(hbjson_path)
        if os.path.exists(epw_path):
            os.unlink(epw_path)