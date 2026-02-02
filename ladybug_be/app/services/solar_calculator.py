"""
Solární kalkulátor - 100% Ladybug funkce.
Používá Wea a SkyMatrix pro správné výpočty.
"""
from typing import Dict, Any, List, Optional
import numpy as np

from ladybug.epw import EPW
from ladybug.location import Location
from ladybug.wea import Wea
from ladybug_geometry.geometry3d.mesh import Mesh3D
from ladybug_geometry.geometry3d.face import Face3D
from ladybug_radiance.skymatrix import SkyMatrix
from ladybug_radiance.study.radiation import RadiationStudy


class SolarRadiationCalculator:
    """
    Výpočet solární radiace pomocí Ladybug-radiance.
    100% využití Ladybug funkcí.
    """
    
    def __init__(self, epw_path: str):
        self.epw_path = epw_path
        self.epw: Optional[EPW] = None
        self.location: Optional[Location] = None
        self.sky_matrix: Optional[SkyMatrix] = None
        self.wea: Optional[Wea] = None
    
    def load_weather_data(self) -> EPW:
        """Načte EPW data pomocí Ladybug."""
        self.epw = EPW(self.epw_path)
        self.location = self.epw.location
        
        # Vytvoř Wea objekt z EPW - Ladybug funkce
        self.wea = Wea.from_epw_file(self.epw_path)
        
        return self.epw
    
    def create_sky_matrix(
        self,
        north: float = 0,
        high_density: bool = False
    ) -> SkyMatrix:
        """
        Vytvoří sky matrix pro radiační studii.
        100% Ladybug-radiance funkce.
        """
        if not self.epw:
            raise ValueError("EPW data nejsou načtena.")
        
        # SkyMatrix z EPW - Ladybug-radiance funkce
        self.sky_matrix = SkyMatrix.from_epw(
            epw_file=self.epw_path,
            hoys=None,
            north=north,
            high_density=high_density,
            ground_reflectance=0.2
        )
        
        return self.sky_matrix
    
    def calculate_radiation(
        self,
        study_mesh: Mesh3D,
        context_geometry: Optional[List] = None,
        offset_distance: float = 0.1
    ) -> Dict[str, Any]:
        """
        Vypočítá roční radiaci na meshu.
        100% Ladybug-radiance RadiationStudy.
        """
        if not self.sky_matrix:
            raise ValueError("Sky matrix není vytvořena.")
        
        # RadiationStudy - Ladybug-radiance funkce
        study = RadiationStudy(
            sky_matrix=self.sky_matrix,
            study_mesh=study_mesh,
            context_geometry=context_geometry or [],
            offset_distance=offset_distance,
            by_vertex=False
        )
        
        study.compute()
        
        radiation_values = study.radiation_values
        irradiance_values = study.irradiance_values
        
        return {
            "radiation_kwh_m2": radiation_values,
            "irradiance_w_m2": irradiance_values,
            "statistics": {
                "total_kwh_m2": round(float(np.sum(radiation_values)), 2),
                "average_kwh_m2": round(float(np.mean(radiation_values)), 2),
                "max_kwh_m2": round(float(np.max(radiation_values)), 2),
                "min_kwh_m2": round(float(np.min(radiation_values)), 2),
                "std_kwh_m2": round(float(np.std(radiation_values)), 2)
            },
            "mesh_face_count": len(radiation_values)
        }
    
    def calculate_annual_radiation_simple(
        self,
        tilt: float,
        azimuth: float,
        area: float = 1.0
    ) -> float:
        """
        Výpočet roční radiace pomocí RadiationStudy na jednoduché ploše.
        100% Ladybug-radiance funkce.
        
        Args:
            tilt: Sklon plochy 0-90 stupňů (0 = horizontální)
            azimuth: Azimut 0-360 stupňů (0 = sever)
            area: Plocha v m² 
        
        Returns:
            Celková roční radiace (kWh/rok)
        """
        if not self.sky_matrix:
            # Automaticky vytvoř sky matrix pokud neexistuje
            self.create_sky_matrix(north=0, high_density=False)
        
        # Vytvoř jednoduchou plochu s daným sklonem a azimutem
        # Použijeme Face3D a převedeme na Mesh3D
        
        # Velikost plochy (čtverec 10x10m pro stabilní výpočet)
        size = 10.0
        
        # Vytvoř Face3D orientovanou podle zadaných parametrů
        # Ladybug-geometry funkce
        from ladybug_geometry.geometry3d.pointvector import Point3D, Vector3D
        import math
        
        # Vytvoř čtverec v XY rovině
        pts = [
            Point3D(0, 0, 0),
            Point3D(size, 0, 0),
            Point3D(size, size, 0),
            Point3D(0, size, 0)
        ]
        
        face = Face3D(pts)
        
        # Rotace podle sklonu a azimutu - Ladybug-geometry funkce
        # 1. Rotuj kolem X osy pro sklon
        if tilt > 0:
            axis = Vector3D(1, 0, 0)
            origin = Point3D(0, 0, 0)
            face = face.rotate(axis, math.radians(tilt), origin)
        
        # 2. Rotuj kolem Z osy pro azimut
        if azimuth != 0:
            axis = Vector3D(0, 0, 1)
            origin = Point3D(0, 0, 0)
            face = face.rotate(axis, math.radians(azimuth), origin)
        
        # Převeď Face3D na Mesh3D - Ladybug-geometry funkce
        mesh = Mesh3D.from_face_vertices([face])
        
        # Spusť RadiationStudy - Ladybug-radiance funkce
        study = RadiationStudy(
            sky_matrix=self.sky_matrix,
            study_mesh=mesh,
            context_geometry=[],
            offset_distance=0.1,
            by_vertex=False
        )
        
        study.compute()
        
        # Získej průměrnou radiaci na m² - Ladybug výsledek
        avg_radiation_kwh_m2 = float(np.mean(study.radiation_values))
        
        # Vynásob požadovanou plochou
        total_radiation_kwh = avg_radiation_kwh_m2 * area
        
        return round(total_radiation_kwh, 2)
    
    def get_location_info(self) -> Dict[str, Any]:
        """Informace o lokaci z EPW."""
        if not self.location:
            return {}
        
        return {
            "city": self.location.city,
            "country": self.location.country,
            "latitude": round(self.location.latitude, 3),
            "longitude": round(self.location.longitude, 3),
            "elevation": round(self.location.elevation, 1),
            "timezone": self.location.time_zone
        }


class SolarPotentialEstimator:
    """Odhad solárního potenciálu pro PV panely."""
    
    PV_EFFICIENCY = 0.18
    SYSTEM_LOSSES = 0.14
    
    def __init__(
        self,
        pv_efficiency: float = PV_EFFICIENCY,
        system_losses: float = SYSTEM_LOSSES
    ):
        self.pv_efficiency = pv_efficiency
        self.system_losses = system_losses
        self.performance_ratio = 1.0 - system_losses
    
    def estimate_annual_energy_production(
        self,
        annual_radiation_kwh_m2: float,
        area_m2: float
    ) -> Dict[str, float]:
        """Odhad roční výroby energie z PV panelů."""
        total_radiation_kwh = annual_radiation_kwh_m2 * area_m2
        dc_production_kwh = total_radiation_kwh * self.pv_efficiency
        ac_production_kwh = dc_production_kwh * self.performance_ratio
        installed_capacity_kwp = area_m2 * self.pv_efficiency
        specific_yield = ac_production_kwh / installed_capacity_kwp if installed_capacity_kwp > 0 else 0
        
        return {
            "annual_production_kwh": round(ac_production_kwh, 2),
            "monthly_avg_kwh": round(ac_production_kwh / 12, 2),
            "daily_avg_kwh": round(ac_production_kwh / 365, 2),
            "installed_capacity_kwp": round(installed_capacity_kwp, 2),
            "specific_yield_kwh_per_kwp": round(specific_yield, 1),
            "performance_ratio": round(self.performance_ratio, 2)
        }
    
    def estimate_environmental_impact(
        self,
        annual_production_kwh: float
    ) -> Dict[str, float]:
        """Odhad environmentálního dopadu."""
        CO2_PER_KWH = 0.468
        COAL_PER_KWH = 0.4
        
        annual_co2_savings_kg = annual_production_kwh * CO2_PER_KWH
        annual_co2_savings_tons = annual_co2_savings_kg / 1000
        
        return {
            "co2_savings_kg_per_year": round(annual_co2_savings_kg, 2),
            "co2_savings_tons_per_year": round(annual_co2_savings_tons, 2),
            "coal_savings_kg_per_year": round(annual_production_kwh * COAL_PER_KWH, 2),
            "trees_equivalent": round(annual_co2_savings_tons * 50, 1)
        }