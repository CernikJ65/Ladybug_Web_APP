"""
Orchestrátor analýzy potenciálu TČ pro PED.

Spojuje:
  1. HeatPumpModelPreparer → honeybee Model + PED konstrukce
  2. HeatPumpSimulator → E+ tepelné zátěže
  3. EPWClimateExtractor → Ladybug klimatická data
  4. HeatPumpCOPCalculator → COP z Ladybug kolekcí
  5. HeatPumpEnergyMetrics → spotřeba, úspory, CO₂

SCOP (Seasonal COP):
  Roční SCOP = Σ(tepelná_zátěž) / Σ(spotřeba_elektřiny)
  Měsíční SCOP = měsíční_teplo / měsíční_elektřina
  Fyzikálně korektní — váží COP tepelnou zátěží,
  takže letní hodiny bez vytápění nezkreslují výsledek.

Soubor: ladybug_be/app/services/heatpump_potential_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from .epw_climate_extractor import EPWClimateExtractor
from .heatpump_cop_calculator import HeatPumpCOPCalculator
from .heatpump_energy_metrics import HeatPumpEnergyMetrics
from .heatpump_model_preparer import HeatPumpModelPreparer
from .heatpump_simulator import HeatPumpSimulator

HOURS_PER_MONTH = [
    744, 672, 744, 720, 744, 720,
    744, 744, 720, 744, 720, 744,
]


class HeatPumpPotentialAnalyzer:
    """Hlavní analyzátor obnovitelného potenciálu TČ."""

    def __init__(
        self,
        hbjson_path: str,
        epw_path: str,
        supply_temp_c: float = 35.0,
        collector_depth_m: float = 1.5,
        building_type: str = "Office",
        heating_setpoint_c: float = 20.0,
        electricity_price: float = 6.0,
        grid_co2_kg_per_mwh: float = 450.0,
        heat_recovery: float = 0.0,
    ):
        self._climate = EPWClimateExtractor(epw_path)
        self._preparer = HeatPumpModelPreparer(
            hbjson_path, building_type,
            heating_setpoint_c, heat_recovery,
        )
        self._cop_calc = HeatPumpCOPCalculator(supply_temp_c)
        self._metrics = HeatPumpEnergyMetrics(
            electricity_price, grid_co2_kg_per_mwh,
        )
        self._collector_depth = collector_depth_m
        self._supply_temp = supply_temp_c
        self._epw_path = epw_path
        self._building_type = building_type
        self._heating_sp = heating_setpoint_c
        self._elec_price = electricity_price
        self._co2_factor = grid_co2_kg_per_mwh
        self._heat_recovery = heat_recovery

    def analyze(self) -> Dict[str, Any]:
        """Kompletní analýza — E+ + SCOP + ekonomika."""
        model = self._preparer.prepare_for_simulation()
        rooms_info = self._preparer.get_rooms_info()
        floor_area = self._preparer.get_total_floor_area()
        applied = self._preparer.get_applied_programs()

        design_days = self._climate.get_design_days()
        simulator = HeatPumpSimulator(
            self._epw_path, design_days,
        )
        sim_result = simulator.simulate(model)
        loads = sim_result["room_heating_loads_kwh"]

        air_temps = self._climate.get_hourly_air_temps()
        ground_temps = self._climate.get_hourly_ground_temps(
            self._collector_depth,
        )

        ashp_cop = self._cop_calc.calculate_ashp_cop(air_temps)
        gshp_cop = self._cop_calc.calculate_gshp_cop(ground_temps)
        ashp_frac = self._cop_calc.renewable_fraction_hourly(
            ashp_cop,
        )
        gshp_frac = self._cop_calc.renewable_fraction_hourly(
            gshp_cop,
        )

        ashp_rooms = self._calc_rooms(rooms_info, loads, ashp_frac)
        gshp_rooms = self._calc_rooms(rooms_info, loads, gshp_frac)
        ashp_total = sum(
            r["annual_renewable_kwh"] for r in ashp_rooms
        )
        gshp_total = sum(
            r["annual_renewable_kwh"] for r in gshp_rooms
        )

        ashp_metrics = self._metrics.compute_metrics(
            loads, ashp_cop, floor_area,
        )
        gshp_metrics = self._metrics.compute_metrics(
            loads, gshp_cop, floor_area,
        )

        return {
            "location": self._climate.get_location_info(),
            "climate_summary": self._climate.get_climate_summary(),
            "model_info": {
                "room_count": len(rooms_info),
                "total_floor_area_m2": round(floor_area, 2),
                "building_type": self._building_type,
                "applied_programs": applied,
            },
            "simulation": {
                "engine": sim_result["engine"],
                "total_heating_kwh": sim_result[
                    "total_annual_heating_kwh"
                ],
            },
            "parameters": self._params_dict(),
            "ashp": self._build_hp_result(
                "Vzduch–voda (ASHP)",
                ashp_rooms, ashp_total, loads,
                ashp_frac, ashp_metrics,
            ),
            "gshp": self._build_hp_result(
                "Země–voda (GSHP)",
                gshp_rooms, gshp_total, loads,
                gshp_frac, gshp_metrics,
            ),
            "comparison": self._compare(ashp_total, gshp_total),
        }

    # ------------------------------------------------------------------

    def _params_dict(self) -> Dict[str, Any]:
        return {
            "supply_temp_c": self._supply_temp,
            "collector_depth_m": self._collector_depth,
            "heating_setpoint_c": self._heating_sp,
            "electricity_price_czk": self._elec_price,
            "grid_co2_kg_per_mwh": self._co2_factor,
            "heat_recovery": self._heat_recovery,
        }

    def _build_hp_result(
        self, label, rooms, total,
        loads, frac, metrics,
    ) -> Dict[str, Any]:
        """Sestaví výsledek s SCOP místo prostého průměru COP."""
        heating_total = metrics["electricity_kwh"] + metrics[
            "savings_vs_direct_kwh"
        ]
        elec_total = metrics["electricity_kwh"]

        # Roční SCOP — vážený tepelnou zátěží
        scop = (
            heating_total / elec_total
            if elec_total > 0 else 0.0
        )

        # Měsíční SCOP
        monthly_heat = self._monthly_heating(loads)
        monthly_elec = metrics["monthly_electricity_kwh"]
        monthly_scop = [
            round(h / e, 1) if e > 0 else 0.0
            for h, e in zip(monthly_heat, monthly_elec)
        ]

        return {
            "label": label,
            "annual_renewable_kwh": round(total, 1),
            "annual_avg_cop": round(scop, 2),
            "monthly_avg_cop": monthly_scop,
            "monthly_renewable_kwh": self._monthly_ren(
                loads, frac,
            ),
            "rooms": rooms,
            "energy_metrics": metrics,
        }

    @staticmethod
    def _monthly_heating(
        loads: Dict[str, List[float]],
    ) -> List[float]:
        """Měsíční součet tepelných zátěží."""
        all_h = [0.0] * 8760
        for hourly in loads.values():
            for i, v in enumerate(hourly):
                all_h[i] += v
        monthly, idx = [], 0
        for hours in HOURS_PER_MONTH:
            monthly.append(round(sum(all_h[idx:idx + hours]), 1))
            idx += hours
        return monthly

    @staticmethod
    def _calc_rooms(rooms_info, loads, frac):
        results = []
        for room in rooms_info:
            rid = room["identifier"]
            hourly = loads.get(rid, [0.0] * 8760)
            annual = sum(h * f for h, f in zip(hourly, frac))
            results.append({
                "id": rid,
                "name": room["display_name"],
                "floor_area_m2": room["floor_area_m2"],
                "annual_renewable_kwh": round(annual, 1),
            })
        return results

    @staticmethod
    def _monthly_ren(loads, frac) -> List[float]:
        all_h = [0.0] * 8760
        for hourly in loads.values():
            for i, v in enumerate(hourly):
                all_h[i] += v
        monthly, idx = [], 0
        for hours in HOURS_PER_MONTH:
            s = sum(
                all_h[idx + h] * frac[idx + h]
                for h in range(hours)
            )
            monthly.append(round(s, 1))
            idx += hours
        return monthly

    @staticmethod
    def _compare(ashp: float, gshp: float) -> Dict[str, Any]:
        better = "GSHP" if gshp > ashp else "ASHP"
        diff = abs(gshp - ashp)
        base = min(ashp, gshp) if min(ashp, gshp) > 0 else 1
        return {
            "better_type": better,
            "difference_kwh": round(diff, 1),
            "advantage_percent": round(diff / base * 100, 1),
        }