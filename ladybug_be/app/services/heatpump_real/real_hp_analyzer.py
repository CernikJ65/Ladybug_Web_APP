"""
Orchestrator celorocni simulace TC.

Vystup obsahuje:
  1. Tepelnou potrebu budovy (= co HVAC dodal do zon)
  2. ASHP (vzduch-voda): produkce teplo/chlad, spotreba elektriny
  3. GSHP (zeme-voda): to same

Data plynou z EnergyPlus end-use meteru:
  Heating:Electricity, Cooling:Electricity,
  Fans:Electricity, Pumps:Electricity, HeatRejection:Electricity

Z techto meteru pocitame zvlast COP topeni a COP chlazeni.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, Optional, List

from ..epw_climate_extractor import EPWClimateExtractor
from .real_hp_model_preparer import RealHPModelPreparer
from .real_hp_simulator import RealHPSimulator


class RealHPAnalyzer:
    """Celorocni simulace ASHP vs GSHP."""

    def __init__(
        self,
        hbjson_path: str,
        epw_path: str,
        building_type: str = "Office",
        heating_setpoint_c: Optional[float] = None,
        cooling_setpoint_c: Optional[float] = None,
        heat_recovery: float = 0.0,
        heating_only: bool = False,
    ):
        self._epw_path = epw_path
        self._climate = EPWClimateExtractor(epw_path)
        self._preparer = RealHPModelPreparer(
            hbjson_path, building_type,
            heating_setpoint_c, cooling_setpoint_c,
            heat_recovery, heating_only,
        )
        self._btype = building_type
        self._hr = heat_recovery
        self._heating_only = heating_only

    def analyze(self) -> Dict[str, Any]:
        rooms = self._preparer.get_rooms_info()
        area = self._preparer.get_total_floor_area()
        dds = self._climate.get_design_days()
        sim = RealHPSimulator(self._epw_path, dds)

        print("\n>>> ASHP (vzduch-voda) <<<")
        ashp_res = sim.simulate(self._preparer.prepare_ashp())

        print("\n>>> GSHP (zeme-voda) <<<")
        gshp_res = sim.simulate(self._preparer.prepare_gshp())

        demand = self._building_demand(ashp_res, area)

        return {
            "location": self._climate.get_location_info(),
            "climate_summary": (
                self._climate.get_climate_summary()
            ),
            "model_info": {
                "room_count": len(rooms),
                "total_floor_area_m2": round(area, 2),
                "building_type": self._btype,
                "ladybug_program": (
                    self._preparer.get_program_name()
                ),
            },
            "parameters": {
                "heat_recovery": self._hr,
                "heating_only": self._heating_only,
                "setpoints_applied": (
                    self._preparer.get_applied_setpoints()
                ),
                "setpoints_ladybug_default": (
                    self._preparer.get_program_setpoints()
                ),
            },
            "building_demand": demand,
            "ashp": self._build(
                "ASHP (vzduch-voda)", ashp_res,
            ),
            "gshp": self._build(
                "GSHP (zeme-voda)", gshp_res,
            ),
        }

    @staticmethod
    def _building_demand(
        res: Dict, area: float,
    ) -> Dict[str, Any]:
        """Tepelna potreba budovy = co HVAC dodal do zon.

        Bere data z ASHP simulace — obe HVAC sizovane na stejnou
        potrebu, takze teplo/chlad dodane do zon se shoduji.
        """
        ht = res["annual_heating_kwh"]
        ct = res["annual_cooling_kwh"]
        return {
            "annual_heating_kwh": ht,
            "annual_cooling_kwh": ct,
            "annual_total_kwh": round(ht + ct, 1),
            "specific_heating_kwh_m2": round(
                ht / area if area > 0 else 0.0, 1,
            ),
            "specific_cooling_kwh_m2": round(
                ct / area if area > 0 else 0.0, 1,
            ),
            "monthly_heating_kwh": res["monthly_heating_kwh"],
            "monthly_cooling_kwh": res["monthly_cooling_kwh"],
        }

    @staticmethod
    def _build(
        label: str, res: Dict,
    ) -> Dict[str, Any]:
        """Sestavi vysledky jednoho systemu + COPs z end-use meteru."""
        ht = res["annual_heating_kwh"]
        ct = res["annual_cooling_kwh"]
        heat_e = res["annual_heat_elec_kwh"]
        cool_e = res["annual_cool_elec_kwh"]
        fan_e = res["annual_fan_elec_kwh"]
        pump_e = res["annual_pump_elec_kwh"]
        hr_e = res["annual_heatrej_elec_kwh"]
        total_e = res["annual_electricity_kwh"]

        # COPs dle end-use: heating delivered / heating electricity
        cop_heat = round(ht / heat_e, 2) if heat_e > 0 else 0.0
        cop_cool = round(ct / cool_e, 2) if cool_e > 0 else 0.0
        cop_year = round(
            (ht + ct) / total_e, 2,
        ) if total_e > 0 else 0.0

        # Mesicni COP topeni (hlavni diagnostika)
        m_h = res["monthly_heating_kwh"]
        m_c = res["monthly_cooling_kwh"]
        m_he = res["monthly_heat_elec_kwh"]
        m_ce = res["monthly_cool_elec_kwh"]
        m_e = res["monthly_electricity_kwh"]

        m_cop_heat = [
            round(h / e, 2) if e > 0 else 0.0
            for h, e in zip(m_h, m_he)
        ]
        m_cop_cool = [
            round(c / e, 2) if e > 0 else 0.0
            for c, e in zip(m_c, m_ce)
        ]
        m_cop_total = [
            round((h + c) / e, 2) if e > 0 else 0.0
            for h, c, e in zip(m_h, m_c, m_e)
        ]

        breakdown = {
            "Topení (kompresor + el. backup)": round(heat_e, 1),
            "Chlazení (chiller / DX)": round(cool_e, 1),
            "Ventilátory": round(fan_e, 1),
            "Čerpadla": round(pump_e, 1),
            "Chladicí věž": round(hr_e, 1),
        }
        # Odfiltruj nuly
        breakdown = {
            k: v for k, v in breakdown.items() if v > 0.1
        }

        return {
            "label": label,
            "annual_heating_kwh": ht,
            "annual_cooling_kwh": ct,
            "annual_produced_kwh": round(ht + ct, 1),
            "annual_electricity_kwh": total_e,
            "annual_heat_elec_kwh": round(heat_e, 1),
            "annual_cool_elec_kwh": round(cool_e, 1),
            "annual_fan_elec_kwh": round(fan_e, 1),
            "annual_pump_elec_kwh": round(pump_e, 1),
            "annual_heatrej_elec_kwh": round(hr_e, 1),
            "cop_heating": cop_heat,
            "cop_cooling": cop_cool,
            "cop_annual": cop_year,
            "monthly_heating_kwh": m_h,
            "monthly_cooling_kwh": m_c,
            "monthly_heat_elec_kwh": m_he,
            "monthly_cool_elec_kwh": m_ce,
            "monthly_electricity_kwh": m_e,
            "monthly_cop_heating": m_cop_heat,
            "monthly_cop_cooling": m_cop_cool,
            "monthly_cop_total": m_cop_total,
            "electricity_breakdown": breakdown,
        }
