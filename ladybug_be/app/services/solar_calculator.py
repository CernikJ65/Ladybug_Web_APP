"Kolik slunenecni energie za rok dopadne na jednotlivé fotovoltaiícé panely"
from __future__ import annotations

from typing import List, Dict, Any, Optional

from ladybug.epw import EPW
from ladybug.location import Location
from ladybug_geometry.geometry3d.face import Face3D
from ladybug_radiance.skymatrix import SkyMatrix
from ladybug_radiance.study.radiation import RadiationStudy
from honeybee_radiance.sensorgrid import SensorGrid

from .panel_placer import PanelPosition

"spocita kolik slunecniho zareni dopadne za rok na kazdy panel"
class SolarRadiationCalculator:
    
    "priprava objektu"
    def __init__(self, epw_path: str):
        self.epw_path = epw_path
        self.epw: Optional[EPW] = None
        self.location: Optional[Location] = None
        self.sky_matrix: Optional[SkyMatrix] = None
    "pomoci epw souboru vytvori pripravi klimaticka data pro vypocet solarniho zareni"
    "pripravi model"
    def load_and_prepare(self, high_density: bool = True) -> None:
        "skymatrix v tomto priapde rozdeli oblohu na 577 malych plosek"
        "pro kazdou dopada kolik slunecniho zareni dopadne"
        "vysledke je mapa oblohy a u kazd plosky je napsany jeji potencial" 
        self.epw = EPW(self.epw_path)
        self.location = self.epw.location
        self.sky_matrix = SkyMatrix.from_epw(
            epw_file=self.epw_path,
            north=0,
            high_density=high_density,
            ground_reflectance=0.2,
        )
        "priprava vypoctup potencialu"
    def calculate_panel_radiation(
        self,
        panels: List[PanelPosition],
        building_context: Optional[List[Face3D]] = None,
    ) -> List[float]:
        
        if not self.sky_matrix:
            raise ValueError("Nejdříve zavolejte load_and_prepare().")
        if not panels:
            return []
        "stineni "
        panel_faces = [p.shade.geometry for p in panels]
        "uprostred panelu vytvorci merici bod nebol senzor"
        grid = SensorGrid.from_face3d(
            identifier="pv_panels",
            faces=panel_faces,
            x_dim=max(f.max.x - f.min.x for f in panel_faces) + 0.1,
        )

        "kontext stineni"
        context: List = list(building_context or [])

        study = RadiationStudy(
            sky_matrix=self.sky_matrix,
            study_mesh=grid.mesh,
            context_geometry=context,
            offset_distance=0.1,
            by_vertex=False,
        )
        "vezme mapu nebe neboli skymatri, senzory pro panely, steny budovy, a posun "
        "pro kazdy senzor vysvtreli 577 paprsku ke kazde plose oblohy"
        "aby radiance zjistila jestli plosku vidi"
        "vystreli paprek od senoru ke stredu ploskya podiva s e jeslji ji paprske protne"
        "pro kazdy senzor vznikne seznam odpovedi ano/ne"
        "nasledne se sectou hodnoty tech co ano a mame potnecialni radianci senzoru"
        study.compute()

        raw = [float(v) for v in study.radiation_values]
        return self._map_results_to_panels(raw, len(panels))

    def get_location_info(self) -> Dict[str, Any]:
        if not self.location:
            return {}
        loc = self.location
        return {
            "city": loc.city,
            "country": getattr(loc, "country", ""),
            "latitude": round(float(loc.latitude), 3),
            "longitude": round(float(loc.longitude), 3),
            "elevation": round(float(loc.elevation), 1),
            "timezone": loc.time_zone,
        }

    @staticmethod
    def _map_results_to_panels(
        raw_values: list, panel_count: int
    ) -> List[float]:
        total = len(raw_values)
        if total == panel_count:
            return [round(float(v), 2) for v in raw_values]
        faces_per_panel = total / panel_count
        result = []
        for i in range(panel_count):
            start = int(i * faces_per_panel)
            end = min(int((i + 1) * faces_per_panel), total)
            avg = sum(float(v) for v in raw_values[start:end]) / (end - start) if end > start else 0.0
            result.append(round(avg, 2))
        return result