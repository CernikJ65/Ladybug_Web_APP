"""
Orchestrátor celoroční simulace TČ s reálným HVAC.

Pipeline:
  1. RealHPModelPreparer → VRF / WSHP model
  2. RealHPSimulator × 2 → hodinová data přes Ladybug API
  3. Obnovitelná E = dodané teplo + chlad − elektřina

Ladybug funkce:
  - data_collections_by_output_name() → hodinové kolekce
  - HourlyContinuousCollection.total_monthly() → měsíční Σ
  - Kolekce operátor + pro sčítání zón

Soubor: ladybug_be/app/services/heatpump_real/real_hp_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ..epw_climate_extractor import EPWClimateExtractor
from .real_hp_model_preparer import RealHPModelPreparer
from .real_hp_simulator import RealHPSimulator


class RealHPAnalyzer:
    """Celoroční simulace VRF vs WSHP s reálným HVAC."""

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
        rooms = self._preparer.get_rooms_info()
        area = self._preparer.get_total_floor_area()
        dds = self._climate.get_design_days()
        sim = RealHPSimulator(self._epw_path, dds)

        vrf_model = self._preparer.prepare_vrf()
        vrf_res = sim.simulate(vrf_model)

        wshp_model = self._preparer.prepare_wshp()
        wshp_res = sim.simulate(wshp_model)

        vrf_out = self._build(
            "VRF (vzduch-voda)", vrf_res, area,
        )
        wshp_out = self._build(
            "WSHP GSHP (země-voda)", wshp_res, area,
        )

        return {
            "location": self._climate.get_location_info(),
            "climate_summary": self._climate.get_climate_summary(),
            "model_info": {
                "room_count": len(rooms),
                "total_floor_area_m2": round(area, 2),
                "building_type": self._btype,
            },
            "parameters": self._params(),
            "vrf": vrf_out,
            "wshp": wshp_out,
            "comparison": self._compare(vrf_out, wshp_out),
            "debug": {
                "vrf_outputs": vrf_res.get(
                    "available_outputs", [],
                ),
                "wshp_outputs": wshp_res.get(
                    "available_outputs", [],
                ),
                "vrf_eui": vrf_res.get("eui", None),
                "wshp_eui": wshp_res.get("eui", None),
            },
        }

    def _build(
        self, label: str, res: Dict, area: float,
    ) -> Dict[str, Any]:
        ht = res["total_heating_kwh"]
        ct = res["total_cooling_kwh"]
        el = res["total_electricity_kwh"]
        renewable = max((ht + ct) - el, 0.0)
        cop = (ht + ct) / el if el > 0 else 0.0
        savings = (ht + ct) - el
        co2_f = self._co2 / 1000.0

        m_h = res["monthly_heating_kwh"]
        m_c = res["monthly_cooling_kwh"]
        m_e = res["monthly_electricity_kwh"]
        m_ren = [
            round(h + c - e, 1)
            for h, c, e in zip(m_h, m_c, m_e)
        ]
        m_cop = [
            round((h + c) / e, 1) if e > 0 else 0.0
            for h, c, e in zip(m_h, m_c, m_e)
        ]

        return {
            "label": label,
            "annual_heating_kwh": round(ht, 1),
            "annual_cooling_kwh": round(ct, 1),
            "annual_electricity_kwh": round(el, 1),
            "annual_renewable_kwh": round(renewable, 1),
            "annual_cop": round(cop, 2),
            "monthly_heating_kwh": m_h,
            "monthly_cooling_kwh": m_c,
            "monthly_electricity_kwh": m_e,
            "monthly_renewable_kwh": m_ren,
            "monthly_cop": m_cop,
            "energy_metrics": {
                "savings_vs_direct_kwh": round(savings, 1),
                "savings_czk": round(
                    savings * self._price, 0,
                ),
                "co2_savings_kg": round(
                    savings * co2_f, 1,
                ),
                "annual_cost_czk": round(
                    el * self._price, 0,
                ),
                "cost_direct_czk": round(
                    (ht + ct) * self._price, 0,
                ),
                "specific_demand_kwh_m2": round(
                    ht / area if area > 0 else 0, 1,
                ),
            },
        }

    def _compare(self, vrf, wshp) -> Dict[str, Any]:
        vr = vrf["annual_renewable_kwh"]
        wr = wshp["annual_renewable_kwh"]
        better = "WSHP" if wr > vr else "VRF"
        diff = abs(wr - vr)
        base = min(vr, wr) if min(vr, wr) > 0 else 1
        return {
            "better_type": better,
            "difference_kwh": round(diff, 1),
            "advantage_pct": round(diff / base * 100, 1),
        }

    def _params(self) -> Dict[str, Any]:
        return {
            "heating_setpoint_c": self._heat_sp,
            "cooling_setpoint_c": self._cool_sp,
            "heat_recovery": self._hr,
            "electricity_price_czk": self._price,
            "grid_co2_kg_per_mwh": self._co2,
            "hvac_vintage": "ASHRAE_2019",
        }