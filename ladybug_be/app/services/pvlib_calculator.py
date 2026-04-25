"""Třída pro výpočet roční výroby panelů dle potenciálu.

Jedná se o externí řešení (ne ladybug) — používá knihovnu pvlib.
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
import pvlib

from honeybee_energy.generator.pv import PVProperties

from .panel_placer import PanelPosition
from .pv_simulator import infer_module_type
from .pvlib_weather import load_epw_weather, poa_hourly_shape

"uprava vyroby podle toho jak je pnale zahraty typ se pocita dle učinnosti panelu"
_PVWATTS_GAMMA_BY_MODULE = {

    "Standard": -0.0047,
    "Premium": -0.0035,
    "ThinFilm": -0.0020,
}

#odhad teploty podle typu montaze obecne open rack se zahrivm men
_SAPM_PARAMS_BY_MOUNTING = {
    "FixedOpenRack":    {"a": -3.56, "b": -0.0750, "deltaT": 3.0},
    "FixedRoofMounted": {"a": -2.98, "b": -0.0471, "deltaT": 1.0},
}

"prevody pontecialu vyroby paneu na odhad roční výroby "
class PVLibCalculator:
    "nastaveni parametru pro vypocet"
    def __init__(
        self,
        epw_path: str,
        rated_efficiency: float = 0.20,
        system_loss_fraction: Optional[float] = None,
        mounting_type: str = "FixedOpenRack",
        active_area_fraction: float = 1.0,
    ):
        self.epw_path = epw_path
        self.rated_efficiency = rated_efficiency
        if system_loss_fraction is None:
            # Konzistentní s PVSimulator — age_degradation 0 %
            # pro simulaci nového systému v roce 0.
            system_loss_fraction = PVProperties.loss_fraction_from_components(
                age=0.0,
            )
        self.system_loss_fraction = system_loss_fraction
        self.module_type = infer_module_type(rated_efficiency)
        self.mounting_type = mounting_type
        self.active_area_fraction = active_area_fraction
        self._weather: Optional[pd.DataFrame] = None
        self._latitude: float = 0.0
        self._longitude: float = 0.0
    "co se deje pri vypoctu, kontroalrxistence panelu"
    "potom se nacte pocasi, nasledne se nacte ponteical a dle pocasi rozdeli do hodin"
    "a nasledne probiha vypocet vyroby"
    def simulate(self, panels: List[PanelPosition]) -> Dict[str, Any]:
        """Hlavní vstup — vrátí stejný tvar dictu jako PVSimulator.simulate()."""
        if not panels:
            return self._empty_result()

        weather = self._ensure_weather()
        shape = poa_hourly_shape(
            weather, self._latitude, self._longitude, panels[0],
        )

        panel_results: List[Dict[str, Any]] = []
        total_kwh = 0.0
        for panel in panels:
            annual_poa = float(panel.radiation_kwh_m2)
            kwh = self._simulate_panel(panel, annual_poa, weather, shape)
            total_kwh += kwh
            panel_results.append({
                "panel_id": panel.id,
                "shade_id": panel.shade.identifier,
                "annual_production_kwh": round(kwh, 2),
            })

        return {
            "annual_production_kwh": round(total_kwh, 2),
            "panel_results": panel_results,
            "simulation_engine": "pvlib_PVWatts",
            "hourly_available": False,
        }
    "ztratty paneli stejne jako v PVSimulatoru"
    def get_loss_breakdown(self) -> Dict[str, float]:
        """Stejný rozpis ztrát jako PVSimulator, aby byl response jednotný."""
        return {
            "soiling": 0.02, "snow": 0.0, "wiring": 0.02,
            "electrical_connection": 0.005, "manufacturer_mismatch": 0.02,
            "age_degradation": 0.0, "light_induced_degradation": 0.015,
            "grid_availability": 0.015,
            "total": round(self.system_loss_fraction, 3),
        }


    def _ensure_weather(self) -> pd.DataFrame:
        if self._weather is None:
            self._weather, self._latitude, self._longitude = \
                load_epw_weather(self.epw_path)
        return self._weather
    "zde jiz probiha samozne simualce"
    def _simulate_panel(
        self,
        panel: PanelPosition,
        annual_poa_kwh_m2: float,
        weather: pd.DataFrame,
        poa_shape: np.ndarray,
    ) -> float:
        """Jeden panel → roční kWh přes PVWatts (pvlib)."""
        if annual_poa_kwh_m2 <= 0 or poa_shape.sum() <= 0:
            return 0.0

        "vezme rocni cislo z radiance a rozloziho ho na rok"
        poa_hourly_w = annual_poa_kwh_m2 * 1000.0 * poa_shape


        sapm = _SAPM_PARAMS_BY_MOUNTING.get(
            self.mounting_type,
            _SAPM_PARAMS_BY_MOUNTING["FixedOpenRack"],
        )
        cell_temp = pvlib.temperature.sapm_cell(
            poa_global=poa_hourly_w,
            temp_air=weather["temp_air"].to_numpy(),
            wind_speed=weather["wind_speed"].to_numpy(),
            a=sapm["a"],
            b=sapm["b"],
            deltaT=sapm["deltaT"],
        )

        panel_area_m2 = float(panel.area) * self.active_area_fraction
        pdc0_w = panel_area_m2 * self.rated_efficiency * 1000.0

        gamma_pdc = _PVWATTS_GAMMA_BY_MODULE.get(self.module_type, -0.0047)
        dc_power_w = pvlib.pvsystem.pvwatts_dc(
            g_poa_effective=poa_hourly_w,
            temp_cell=cell_temp,
            pdc0=pdc0_w,
            gamma_pdc=gamma_pdc,
        )

        dc_energy_wh = np.asarray(dc_power_w).sum() * (1.0 - self.system_loss_fraction)
        return dc_energy_wh / 1000.0

    @staticmethod
    def _empty_result() -> Dict[str, Any]:
        return {
            "annual_production_kwh": 0.0,
            "panel_results": [],
            "simulation_engine": "pvlib_PVWatts",
            "hourly_available": False,
        }
