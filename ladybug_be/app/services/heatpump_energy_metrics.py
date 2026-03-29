"""
Výpočet energetických metrik pro analýzu TČ.

Odvozené metriky z výsledků E+ simulace a COP výpočtu:
  - Spotřeba elektřiny TČ = tepelná_zátěž / COP
  - Úspora vs přímotop = tepelná_zátěž - spotřeba_TČ
  - Úspora CZK = úspora_kWh × cena_elektřiny
  - Úspora CO₂ = úspora_kWh × grid_co2_faktor
  - Měrná tepelná potřeba = tepelná_zátěž / podlahová_plocha
  - Špičkový výkon = max(hodinové_zátěže)

Soubor: ladybug_be/app/services/heatpump_energy_metrics.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.datacollection import HourlyContinuousCollection

HOURS_PER_MONTH = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744]


class HeatPumpEnergyMetrics:
    """Odvozené energetické metriky z TČ analýzy."""

    def __init__(
        self,
        electricity_price: float = 6.0,
        grid_co2_kg_per_mwh: float = 450.0,
    ):
        self._price = electricity_price
        self._co2_factor = grid_co2_kg_per_mwh / 1000.0  # → kg/kWh

    def compute_metrics(
        self,
        room_loads: Dict[str, List[float]],
        cop_collection: HourlyContinuousCollection,
        total_floor_area: float,
    ) -> Dict[str, Any]:
        """Kompletní metriky pro jeden typ TČ."""
        cop_values = list(cop_collection.values)
        all_hourly = self._aggregate_hourly(room_loads)

        # Spotřeba elektřiny TČ (kWh) = Σ(zátěž_h / COP_h)
        elec_hourly = [
            load / cop if cop > 0 else 0.0
            for load, cop in zip(all_hourly, cop_values)
        ]
        elec_total = sum(elec_hourly)
        heating_total = sum(all_hourly)

        # Úspora vs přímotop (COP=1)
        savings_kwh = heating_total - elec_total

        # Špičkový tepelný výkon (kW) — max hodinová zátěž
        peak_kw = max(all_hourly) if all_hourly else 0.0

        # Měrná tepelná potřeba (kWh/m²/rok)
        specific = heating_total / total_floor_area if total_floor_area > 0 else 0

        # Měsíční spotřeba elektřiny
        monthly_elec = self._monthly_sum(elec_hourly)

        return {
            "electricity_kwh": round(elec_total, 1),
            "savings_vs_direct_kwh": round(savings_kwh, 1),
            "savings_czk": round(savings_kwh * self._price, 0),
            "co2_savings_kg": round(savings_kwh * self._co2_factor, 1),
            "co2_savings_tons": round(savings_kwh * self._co2_factor / 1000, 2),
            "specific_heat_demand_kwh_m2": round(specific, 1),
            "peak_heating_kw": round(peak_kw, 2),
            "monthly_electricity_kwh": monthly_elec,
            "annual_cost_hp_czk": round(elec_total * self._price, 0),
            "annual_cost_direct_czk": round(heating_total * self._price, 0),
        }

    # ------------------------------------------------------------------

    @staticmethod
    def _aggregate_hourly(room_loads: Dict[str, List[float]]) -> List[float]:
        """Sečte hodinové zátěže všech místností."""
        result = [0.0] * 8760
        for hourly in room_loads.values():
            for i, v in enumerate(hourly):
                result[i] += v
        return result

    @staticmethod
    def _monthly_sum(hourly: List[float]) -> List[float]:
        monthly, idx = [], 0
        for hours in HOURS_PER_MONTH:
            s = sum(hourly[idx:idx + hours])
            monthly.append(round(s, 1))
            idx += hours
        return monthly