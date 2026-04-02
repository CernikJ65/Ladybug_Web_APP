"""
Orchestrator celorocni simulace TC — ASHP vs GSHP.

Pipeline:
  1. RealHPModelPreparer.prepare_ashp()
     -> FCUwithDOAS + centralni ASHP
  2. RealHPModelPreparer.prepare_gshp()
     -> WSHPwithDOAS + zemni smycka
  3. RealHPSimulator x2
     -> hodinova data pres Ladybug API
  4. Rozpad: TC elektrina vs pomocna (DOAS, cerpadla)
  5. Dva COP: system_cop a hp_cop

Ladybug funkce:
  - data_collections_by_output_name() -> kolekce v kWh
  - HourlyContinuousCollection + operator
  - collection.total_monthly() -> mesicni soucty

Soubor: ladybug_be/app/services/heatpump_real/real_hp_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ..epw_climate_extractor import EPWClimateExtractor
from .real_hp_model_preparer import RealHPModelPreparer
from .real_hp_simulator import RealHPSimulator

VINTAGE = "ASHRAE_2019"


class RealHPAnalyzer:
    """Celorocni simulace ASHP vs GSHP."""

    def __init__(
        self,
        hbjson_path: str,
        epw_path: str,
        building_type: str = "Office",
        heating_sp: float = 20.0,
        cooling_sp: float = 26.0,
        heat_recovery: float = 0.0,
        electricity_price: float = 6.0,
        grid_co2: float = 450.0,
    ):
        self._epw_path = epw_path
        self._climate = EPWClimateExtractor(epw_path)
        self._preparer = RealHPModelPreparer(
            hbjson_path, building_type,
            heating_sp, cooling_sp, heat_recovery,
        )
        self._btype = building_type
        self._heat_sp = heating_sp
        self._cool_sp = cooling_sp
        self._hr = heat_recovery
        self._price = electricity_price
        self._co2 = grid_co2

    def analyze(self) -> Dict[str, Any]:
        """Kompletni analyza ASHP vs GSHP."""
        rooms = self._preparer.get_rooms_info()
        area = self._preparer.get_total_floor_area()
        dds = self._climate.get_design_days()
        sim = RealHPSimulator(self._epw_path, dds)

        print("\n>>> ASHP simulace <<<")
        ashp_model = self._preparer.prepare_ashp()
        ashp_res = sim.simulate(ashp_model)

        print("\n>>> GSHP simulace <<<")
        gshp_model = self._preparer.prepare_gshp()
        gshp_res = sim.simulate(gshp_model)

        ashp_out = self._build(
            "ASHP (vzduch-voda)", ashp_res, area,
        )
        gshp_out = self._build(
            "GSHP (zeme-voda)", gshp_res, area,
        )

        return {
            "location": (
                self._climate.get_location_info()
            ),
            "climate_summary": (
                self._climate.get_climate_summary()
            ),
            "model_info": {
                "room_count": len(rooms),
                "total_floor_area_m2": round(area, 2),
                "building_type": self._btype,
            },
            "parameters": self._params(),
            "ashp": ashp_out,
            "gshp": gshp_out,
            "comparison": self._compare(
                ashp_out, gshp_out,
            ),
        }

    def _build(
        self, label: str, res: Dict, area: float,
    ) -> Dict[str, Any]:
        """Sestavi vysledky jednoho systemu."""
        ht = res["total_heating_kwh"]
        ct = res["total_cooling_kwh"]
        total_e = res["total_electricity_kwh"]
        hp_e = res["hp_electricity_kwh"]
        aux_e = res["aux_electricity_kwh"]

        thermal = ht + ct
        renewable = max(thermal - total_e, 0.0)
        co2_f = self._co2 / 1000.0

        sys_cop = thermal / total_e if total_e > 0 else 0
        hp_cop = thermal / hp_e if hp_e > 0 else 0

        m_h = res["monthly_heating_kwh"]
        m_c = res["monthly_cooling_kwh"]
        m_e = res["monthly_electricity_kwh"]
        m_hp = res["monthly_hp_elec_kwh"]

        m_ren = [
            round(h + c - e, 1)
            for h, c, e in zip(m_h, m_c, m_e)
        ]
        m_sys_cop = [
            round((h + c) / e, 2)
            if e > 0 else 0.0
            for h, c, e in zip(m_h, m_c, m_e)
        ]
        m_hp_cop = [
            round((h + c) / hp, 2)
            if hp > 0 else 0.0
            for h, c, hp in zip(m_h, m_c, m_hp)
        ]

        savings = max(thermal - total_e, 0.0)

        return {
            "label": label,
            "annual_heating_kwh": round(ht, 1),
            "annual_cooling_kwh": round(ct, 1),
            "annual_electricity_kwh": round(
                total_e, 1,
            ),
            "hp_electricity_kwh": round(hp_e, 1),
            "aux_electricity_kwh": round(aux_e, 1),
            "annual_renewable_kwh": round(
                renewable, 1,
            ),
            "system_cop": round(sys_cop, 2),
            "hp_cop": round(hp_cop, 2),
            "monthly_heating_kwh": m_h,
            "monthly_cooling_kwh": m_c,
            "monthly_electricity_kwh": m_e,
            "monthly_hp_elec_kwh": m_hp,
            "monthly_renewable_kwh": m_ren,
            "monthly_system_cop": m_sys_cop,
            "monthly_hp_cop": m_hp_cop,
            "hp_breakdown": res.get(
                "hp_breakdown", {},
            ),
            "aux_breakdown": res.get(
                "aux_breakdown", {},
            ),
            "available_outputs": res.get(
                "available_outputs", [],
            ),
            "energy_metrics": {
                "savings_vs_direct_kwh": round(
                    savings, 1,
                ),
                "savings_czk": round(
                    savings * self._price, 0,
                ),
                "co2_savings_kg": round(
                    savings * co2_f, 1,
                ),
                "annual_cost_czk": round(
                    total_e * self._price, 0,
                ),
                "cost_direct_czk": round(
                    thermal * self._price, 0,
                ),
                "specific_demand_kwh_m2": round(
                    ht / area if area > 0 else 0, 1,
                ),
            },
        }

    def _compare(self, ashp, gshp) -> Dict[str, Any]:
        ar = ashp["annual_renewable_kwh"]
        gr = gshp["annual_renewable_kwh"]
        better = "GSHP" if gr > ar else "ASHP"
        diff = abs(gr - ar)
        base = min(ar, gr) if min(ar, gr) > 0 else 1
        return {
            "better_type": better,
            "difference_kwh": round(diff, 1),
            "advantage_pct": round(
                diff / base * 100, 1,
            ),
        }

    def _params(self) -> Dict[str, Any]:
        return {
            "heating_setpoint_c": self._heat_sp,
            "cooling_setpoint_c": self._cool_sp,
            "heat_recovery": self._hr,
            "electricity_price_czk": self._price,
            "grid_co2_kg_per_mwh": self._co2,
            "hvac_vintage": VINTAGE,
            "ashp_system": "FCUwithDOAS + ASHP",
            "gshp_system": "WSHPwithDOAS + GSHP",
        }