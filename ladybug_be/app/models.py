"""
Datové modely pro API - rozšířené o solární analýzu.
"""
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional


# ========== STÁVAJÍCÍ MODELY (z původního kódu) ==========

class WindAnalysisResponse(BaseModel):
    """Odpověď s analýzou větru."""
    location: Dict[str, Any]
    statistics: Dict[str, Any]
    plot_base64: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "location": {
                    "city": "Ostrava",
                    "latitude": 49.820,
                    "longitude": 18.262
                },
                "statistics": {
                    "prevailing_directions": [225],
                    "wind_speed": {"average_ms": 3.5}
                },
                "plot_base64": "data:image/png;base64,..."
            }
        }


# ========== NOVÉ MODELY PRO SOLÁRNÍ ANALÝZU ==========

class RoofSurfaceInfo(BaseModel):
    """Informace o jedné střešní ploše."""
    identifier: str = Field(..., description="Jedinečný identifikátor plochy")
    area_m2: float = Field(..., description="Plocha střechy v m²")
    tilt_degrees: float = Field(..., description="Sklon střechy (0-90 stupňů)")
    azimuth_degrees: float = Field(..., description="Azimut střechy (0-360 stupňů)")
    orientation: str = Field(..., description="Textový popis orientace")
    center: List[float] = Field(..., description="[x, y, z] souřadnice středu")
    annual_radiation_kwh: Optional[float] = Field(None, description="Roční radiace v kWh")
    annual_radiation_kwh_m2: Optional[float] = Field(None, description="Roční radiace v kWh/m²")
    
    class Config:
        json_schema_extra = {
            "example": {
                "identifier": "Room_1_Roof",
                "area_m2": 45.5,
                "tilt_degrees": 25.0,
                "azimuth_degrees": 180.0,
                "orientation": "South",
                "center": [10.5, 12.3, 8.0],
                "annual_radiation_kwh": 52500,
                "annual_radiation_kwh_m2": 1154
            }
        }


class EnergyProduction(BaseModel):
    """Odhad výroby energie z PV panelů."""
    annual_production_kwh: float = Field(..., description="Roční výroba AC energie v kWh")
    monthly_avg_kwh: float = Field(..., description="Průměrná měsíční výroba v kWh")
    daily_avg_kwh: float = Field(..., description="Průměrná denní výroba v kWh")
    installed_capacity_kwp: float = Field(..., description="Instalovaný výkon v kWp")
    specific_yield_kwh_per_kwp: float = Field(..., description="Specifický výnos kWh/kWp/rok")
    performance_ratio: float = Field(..., description="Performance ratio systému")
    
    class Config:
        json_schema_extra = {
            "example": {
                "annual_production_kwh": 8190,
                "monthly_avg_kwh": 682.5,
                "daily_avg_kwh": 22.4,
                "installed_capacity_kwp": 8.19,
                "specific_yield_kwh_per_kwp": 1000,
                "performance_ratio": 0.86
            }
        }


class EnvironmentalImpact(BaseModel):
    """Environmentální dopad solární instalace."""
    co2_savings_kg_per_year: float = Field(..., description="Úspora CO2 v kg/rok")
    co2_savings_tons_per_year: float = Field(..., description="Úspora CO2 v tunách/rok")
    coal_savings_kg_per_year: float = Field(..., description="Úspora uhlí v kg/rok")
    trees_equivalent: float = Field(..., description="Ekvivalent počtu stromů")
    
    class Config:
        json_schema_extra = {
            "example": {
                "co2_savings_kg_per_year": 3832.92,
                "co2_savings_tons_per_year": 3.83,
                "coal_savings_kg_per_year": 3276.0,
                "trees_equivalent": 191.5
            }
        }


class RoofAnalysis(BaseModel):
    """Analýza střech budovy."""
    total_roof_area_m2: float = Field(..., description="Celková plocha střech v m²")
    total_annual_radiation_kwh: float = Field(..., description="Celková roční radiace v kWh")
    average_radiation_kwh_m2: float = Field(..., description="Průměrná radiace v kWh/m²")
    roof_surfaces: List[RoofSurfaceInfo] = Field(..., description="Seznam střešních ploch")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_roof_area_m2": 150.5,
                "total_annual_radiation_kwh": 173577,
                "average_radiation_kwh_m2": 1153,
                "roof_surfaces": []
            }
        }


class SolarAnalysisResponse(BaseModel):
    """Kompletní odpověď pro solární analýzu."""
    model_info: Dict[str, Any] = Field(..., description="Informace o HBJSON modelu")
    location: Dict[str, Any] = Field(..., description="Informace o lokaci z EPW")
    roof_analysis: RoofAnalysis = Field(..., description="Analýza střech")
    energy_production: EnergyProduction = Field(..., description="Odhad výroby energie")
    environmental_impact: EnvironmentalImpact = Field(..., description="Environmentální dopad")
    parameters: Dict[str, float] = Field(..., description="Použité parametry simulace")
    
    class Config:
        json_schema_extra = {
            "example": {
                "model_info": {
                    "model_name": "Office_Building",
                    "total_roof_area_m2": 150.5,
                    "roof_count": 3
                },
                "location": {
                    "city": "Ostrava",
                    "latitude": 49.82,
                    "longitude": 18.26
                },
                "roof_analysis": {
                    "total_roof_area_m2": 150.5,
                    "total_annual_radiation_kwh": 173577,
                    "average_radiation_kwh_m2": 1153,
                    "roof_surfaces": []
                },
                "energy_production": {
                    "annual_production_kwh": 26865,
                    "installed_capacity_kwp": 27.09
                },
                "environmental_impact": {
                    "co2_savings_tons_per_year": 12.57
                },
                "parameters": {
                    "pv_efficiency": 0.18,
                    "system_losses": 0.10
                }
            }
        }


class QuickEstimateResponse(BaseModel):
    """Odpověď pro rychlý odhad solárního potenciálu."""
    location: Dict[str, Any] = Field(..., description="Informace o lokaci")
    input_parameters: Dict[str, float] = Field(..., description="Vstupní parametry")
    radiation: Dict[str, float] = Field(..., description="Radiační data")
    energy_production: EnergyProduction = Field(..., description="Odhad výroby")
    environmental_impact: EnvironmentalImpact = Field(..., description="Environmentální dopad")
    
    class Config:
        json_schema_extra = {
            "example": {
                "location": {"city": "Ostrava"},
                "input_parameters": {
                    "area_m2": 50.0,
                    "tilt_degrees": 30.0,
                    "azimuth_degrees": 180.0
                },
                "radiation": {
                    "annual_radiation_kwh": 57750,
                    "annual_radiation_kwh_m2": 1155
                },
                "energy_production": {
                    "annual_production_kwh": 8937
                },
                "environmental_impact": {
                    "co2_savings_tons_per_year": 4.18
                }
            }
        }