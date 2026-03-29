"""
Výpočet COP tepelných čerpadel na bázi Carnotova cyklu.

Fyzika:
  COP_Carnot = T_hot / (T_hot - T_cold)  [Kelvin]
  COP_real = η × COP_Carnot
  η_ASHP ≈ 0.40, η_GSHP ≈ 0.50

Soubor: ladybug_be/app/services/heatpump_cop_calculator.py
"""
from __future__ import annotations

from typing import List

from ladybug.header import Header
from ladybug.analysisperiod import AnalysisPeriod
from ladybug.datacollection import HourlyContinuousCollection
from ladybug.datatype.generic import GenericType

MIN_COP = 1.5
KELVIN = 273.15
ASHP_CARNOT_EFF = 0.40
GSHP_CARNOT_EFF = 0.50


class HeatPumpCOPCalculator:
    """Hodinový COP a obnovitelný potenciál TČ."""

    def __init__(self, supply_temp_c: float = 35.0):
        self._t_hot_k = supply_temp_c + KELVIN

    def calculate_ashp_cop(
        self, hourly_air_temps: HourlyContinuousCollection,
    ) -> HourlyContinuousCollection:
        """Hodinový COP vzduch-voda TČ z Ladybug EPW teplot."""
        cop_values = [
            self._real_cop(t, ASHP_CARNOT_EFF)
            for t in hourly_air_temps.values
        ]
        return self._build_collection(cop_values, "COP_ASHP", "ASHP")

    def calculate_gshp_cop(
        self, hourly_ground_temps: HourlyContinuousCollection,
    ) -> HourlyContinuousCollection:
        """Hodinový COP země-voda TČ z půdních teplot."""
        cop_values = [
            self._real_cop(t, GSHP_CARNOT_EFF)
            for t in hourly_ground_temps.values
        ]
        return self._build_collection(cop_values, "COP_GSHP", "GSHP")

    def renewable_fraction_hourly(
        self, cop_collection: HourlyContinuousCollection,
    ) -> List[float]:
        """Obnovitelná frakce per hodina: (COP-1)/COP."""
        return [
            (cop - 1.0) / cop if cop > 1.0 else 0.0
            for cop in cop_collection.values
        ]

    def monthly_avg_cop(
        self, cop_collection: HourlyContinuousCollection,
    ) -> List[float]:
        """Měsíční COP — Ladybug average_monthly()."""
        monthly = cop_collection.average_monthly()
        return [round(v, 2) for v in monthly.values]

    # ------------------------------------------------------------------

    def _real_cop(self, t_source_c: float, carnot_eff: float) -> float:
        t_cold_k = t_source_c + KELVIN
        delta = self._t_hot_k - t_cold_k
        if delta <= 0.5:
            return 8.0
        cop_carnot = self._t_hot_k / delta
        return round(max(carnot_eff * cop_carnot, MIN_COP), 3)

    @staticmethod
    def _build_collection(
        values: List[float], name: str, hp_type: str,
    ) -> HourlyContinuousCollection:
        header = Header(
            data_type=GenericType(name, "-"),
            unit="-",
            analysis_period=AnalysisPeriod(),
            metadata={"type": hp_type, "source": "Carnot + correction"},
        )
        return HourlyContinuousCollection(header, values)