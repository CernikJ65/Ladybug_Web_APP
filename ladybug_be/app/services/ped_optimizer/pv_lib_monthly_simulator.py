"""
pvlib-based PV simulator s mesicnim breakdownem per panel.

Stavajici PVLibCalculator (services/pvlib_calculator.py) vraci jen
rocni hodnoty. Pro PED analyzu potrebujeme i mesicni profil — tady
je to udelane vlastnim simulatorem, ktery REPLIKUJE matematiku
PVLibCalculator (pvlib pvwatts_dc + sapm_cell), ale vraci 12 mesicnich
hodnot per panel + jejich rocni soucet.

Vstup:
  - rocni POA per panel (kWh/m2) z Radiance SkyMatrix (SolarRadiationCalculator)
  - EPW pocasi (hodinovy ghi/dni/dhi/temp_air/wind_speed)

Vystup:
  - panel_annual_kwh:  List[float]
  - panel_monthly_kwh: List[List[float]]  (12 mesicu per panel)

Vse v Wh -> kWh prevody nativni, zadne aproximace.

Soubor: ladybug_be/app/services/ped_optimizer/pv_lib_monthly_simulator.py
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
import pvlib

from honeybee_energy.generator.pv import PVProperties

from ..panel_placer import PanelPosition
from ..pv_simulator import infer_module_type
from ..pvlib_weather import load_epw_weather, poa_hourly_shape

# Stejne tabulky jako PVLibCalculator — vyhybame se duplicite chovani.
_PVWATTS_GAMMA_BY_MODULE = {
    "Standard": -0.0047,
    "Premium": -0.0035,
    "ThinFilm": -0.0020,
}

_SAPM_PARAMS_BY_MOUNTING = {
    "FixedOpenRack":    {"a": -3.56, "b": -0.0750, "deltaT": 3.0},
    "FixedRoofMounted": {"a": -2.98, "b": -0.0471, "deltaT": 1.0},
}


class PVLibMonthlySimulator:
    """pvlib PVWatts pipeline s mesicni agregaci per panel."""

    def __init__(
        self,
        epw_path: str,
        rated_efficiency: float = 0.20,
        mounting_type: str = "FixedOpenRack",
        active_area_fraction: float = 1.0,
        system_loss_fraction: Optional[float] = None,
    ):
        self._epw = epw_path
        self._eff = rated_efficiency
        self._mounting = mounting_type
        self._active = active_area_fraction
        self._module_type = infer_module_type(rated_efficiency)
        self._loss = (
            system_loss_fraction
            if system_loss_fraction is not None
            else self._default_loss()
        )
        self._weather: Optional[pd.DataFrame] = None
        self._lat: float = 0.0
        self._lon: float = 0.0

    def simulate(
        self, panels: List[PanelPosition],
    ) -> Dict[str, Any]:
        """Vrati per-panel rocni i mesicni vyrobu."""
        if not panels:
            return {
                "panel_annual_kwh": [],
                "panel_monthly_kwh": [],
            }
        weather = self._ensure_weather()
        shape = poa_hourly_shape(
            weather, self._lat, self._lon, panels[0],
        )
        months_idx = weather.index.month.to_numpy()

        annual: List[float] = []
        monthly: List[List[float]] = []
        for panel in panels:
            ann_kwh, mon_kwh = self._simulate_panel(
                panel, float(panel.radiation_kwh_m2),
                weather, shape, months_idx,
            )
            annual.append(round(ann_kwh, 2))
            monthly.append([round(v, 2) for v in mon_kwh])
        return {
            "panel_annual_kwh": annual,
            "panel_monthly_kwh": monthly,
        }

    # ------------------------------------------------------------------
    # Privatni — vypocet jednoho panelu
    # ------------------------------------------------------------------

    def _simulate_panel(
        self,
        panel: PanelPosition,
        annual_poa_kwh_m2: float,
        weather: pd.DataFrame,
        poa_shape: np.ndarray,
        months_idx: np.ndarray,
    ) -> tuple:
        """Jeden panel -> (annual_kwh, [12 monthly kWh])."""
        if annual_poa_kwh_m2 <= 0 or poa_shape.sum() <= 0:
            return 0.0, [0.0] * 12

        poa_hourly_w = annual_poa_kwh_m2 * 1000.0 * poa_shape

        sapm = _SAPM_PARAMS_BY_MOUNTING.get(
            self._mounting,
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

        panel_area = float(panel.area) * self._active
        pdc0_w = panel_area * self._eff * 1000.0
        gamma = _PVWATTS_GAMMA_BY_MODULE.get(self._module_type, -0.0047)
        dc_power_w = pvlib.pvsystem.pvwatts_dc(
            g_poa_effective=poa_hourly_w,
            temp_cell=cell_temp,
            pdc0=pdc0_w,
            gamma_pdc=gamma,
        )
        dc_arr = np.asarray(dc_power_w) * (1.0 - self._loss)

        monthly_wh = [0.0] * 12
        for m in range(1, 13):
            mask = months_idx == m
            monthly_wh[m - 1] = float(dc_arr[mask].sum())
        monthly_kwh = [v / 1000.0 for v in monthly_wh]
        annual_kwh = sum(monthly_kwh)
        return annual_kwh, monthly_kwh

    # ------------------------------------------------------------------
    # Priprava
    # ------------------------------------------------------------------

    def _ensure_weather(self) -> pd.DataFrame:
        if self._weather is None:
            self._weather, self._lat, self._lon = load_epw_weather(self._epw)
        return self._weather

    @staticmethod
    def _default_loss() -> float:
        """Stejny rozpis ztrat jako PVSimulator/PVLibCalculator."""
        return PVProperties.loss_fraction_from_components(
            age=0.0,
            light_induced_degradation=0.015,
            soiling=0.02,
            snow=0.01,
            manufacturer_nameplate_tolerance=0.01,
            cell_characteristic_mismatch=0.02,
            wiring=0.02,
            electrical_connection=0.005,
            grid_availability=0.015,
        )
