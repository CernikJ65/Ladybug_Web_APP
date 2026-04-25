"""Kompletní PV simulace pro TOP panely vybrané z Radiance.

Důvod TOP-only: EnergyPlus simulace je výpočetně drahá, takže ji pouštíme
pouze pro nejslibnější kandidáty. Postup: načtení panelů → simulace
solárního potenciálu → výpočet roční výroby.
"""
from __future__ import annotations

import os
import shutil
import tempfile
from typing import List, Dict, Any, Callable, Optional

from honeybee.model import Model
from honeybee_energy.generator.pv import PVProperties

from .panel_placer import PanelPosition
from .pv_idf_builder import (
    build_simulation_model,
    write_idf,
)
from .pv_ep_runner import (
    run_ep_simple,
    run_ep_with_progress,
    read_err_file,
)
from .pv_results_parser import parse_panel_results

"Tato funkce rozhodne, jestli panel patří do kategorie Standard nebo Premium, a to podle jeho účinnosti. Typy jez vyzaduje energyplus simulace"
def infer_module_type(rated_efficiency: float) -> str:
    if rated_efficiency < 0.18:
        return "Standard"
    return "Premium"


class PVSimulator:
    """Příprava simulace"""

    def __init__(
        self,
        epw_path: str,
        rated_efficiency: float = 0.20,
        mounting_type: str = "FixedOpenRack",
        active_area_fraction: float = 1.0,
    ):
        "ulozi si cestu k ewp souboru jez vyouziva pro vypocet"
        self.epw_path = epw_path
        "z fe si ulozi ucinnost panelu jez se pouziva pro vypocet"
        self.rated_efficiency = rated_efficiency
        "z ucinnosti odvodi typ panelu jez se pouziva pro simulaci v energyplus"
        self.module_type = infer_module_type(rated_efficiency)
        "nastavi se typ montaze podle toho co uzivatel zada na fe"
        self.mounting_type = mounting_type
        "podil plochy panelu jez skutecne vyrabi energii"
        self.active_area_fraction = active_area_fraction
        "simuulace probiha pro novy system takze ztraty kvuli stari jsou 0"
        self._system_loss = PVProperties.loss_fraction_from_components(
            age=0.0,
        )

    def assign_pv_properties(self, panels: List[PanelPosition]) -> None:
        """tyto vlasnosti se nasledne nastavi kazdemu panelu """
        for panel in panels:
            pv = PVProperties(
                identifier=f"PV_{panel.shade.identifier}",
                rated_efficiency=self.rated_efficiency,
                active_area_fraction=self.active_area_fraction,
                module_type=self.module_type,
                mounting_type=self.mounting_type,
                system_loss_fraction=self._system_loss,
            )
            panel.shade.properties.energy.pv_properties = pv

    def simulate(
        self,
        panels: List[PanelPosition],
        building_model: Model,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> Dict[str, Any]:

        if not building_model.rooms:
            raise RuntimeError(
                "building_model neobsahuje žádné rooms. "
                "EnergyPlus vyžaduje alespoň jednu tepelnou zónu."
            )

        simulation_model = build_simulation_model(building_model, panels)

        tmp_dir = tempfile.mkdtemp()
        try:
            # honeybee-energy Generator:PVWatts má default
            # `array geometry type = Surface` s odkazem na PV Shade. EP
            # tím zahrne **vlastní shading výpočet** (polygon clipping proti
            # ostatním shadám + budově) do POA generátoru. Není tedy potřeba
            # IDF patch — dřívější 0 kWh byla způsobená bugem v jednotkách
            # (_kwh_from_item dělil 3.6e6), ne Surface módem.
            idf_path = write_idf(simulation_model, tmp_dir)

            if on_progress is not None:
                sql_path, err_path = run_ep_with_progress(
                    idf_path, self.epw_path, on_progress
                )
            else:
                sql_path, err_path = run_ep_simple(idf_path, self.epw_path)

            if not sql_path or not os.path.isfile(sql_path):
                raise RuntimeError(
                    "EnergyPlus nedodal SQL soubor.\n"
                    f"eplusout.err:\n{read_err_file(err_path)}"
                )
            return parse_panel_results(sql_path, panels)

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def get_loss_breakdown(self) -> Dict[str, float]:
        """Rozpis celkových PVProperties ztrát pro API response."""
        return {
            "soiling": 0.02, "snow": 0.0, "wiring": 0.02,
            "electrical_connection": 0.005, "manufacturer_mismatch": 0.02,
            "age_degradation": 0.0, "light_induced_degradation": 0.015,
            "grid_availability": 0.015,
            "total": round(self._system_loss, 3),
        }