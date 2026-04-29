"""
Orchestrator celorocni simulace TC — ASHP vs GSHP.

Vystup:
  1. model_info — pocet a rozmery mistnosti, plocha
  2. building_demand — celkova + per-room potreba tepla/chladu
  3. ashp / gshp — produkce, spotreba, COPs

Heating-only se resi cooling setpointem 50 C v zone, cimz se
vypnou zonove FCU/WSHP cooling coily. DOAS supply temperature
reset (15-21 C) bezi nezavisle a v lete mirne chladi privadeny
vzduch — to je legitimni temperace ventilacniho vzduchu, nikoli
klimatizace mistnosti.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, Optional, List

from .real_hp_model_preparer import RealHPModelPreparer
from .real_hp_simulator import RealHPSimulator
from ..epw_climate_extractor import EPWClimateExtractor
from ..progress import report_progress


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
        apply_cz_calibration: bool = True,
    ):
        self._epw_path = epw_path
        self._climate = EPWClimateExtractor(epw_path)
        self._preparer = RealHPModelPreparer(
            hbjson_path, building_type,
            heating_setpoint_c, cooling_setpoint_c,
            heat_recovery, heating_only,
            apply_cz_calibration,
        )
        self._btype = building_type
        self._hr = heat_recovery
        self._heating_only = heating_only
        self._apply_cz = apply_cz_calibration

    def analyze(self) -> Dict[str, Any]:
        report_progress("init", 2, "Příprava modelu…")
        rooms = self._preparer.get_rooms_info()
        area = self._preparer.get_total_floor_area()
        dds = self._climate.get_design_days()
        sim = RealHPSimulator(self._epw_path, dds)

        report_progress("model_ashp", 5, "Sestavuji ASHP model…")
        ashp_model = self._preparer.prepare_ashp()
        report_progress("ashp", 8, "EnergyPlus simulace ASHP…")

        def _ashp_progress(frac: float) -> None:
            report_progress(
                "ashp", 8 + frac * 42, "EnergyPlus simulace ASHP…",
            )

        print("\n>>> ASHP (vzduch-voda) <<<")
        ashp_res = sim.simulate(ashp_model, on_progress=_ashp_progress)

        report_progress("model_gshp", 52, "Sestavuji GSHP model…")
        gshp_model = self._preparer.prepare_gshp()
        report_progress("gshp", 55, "EnergyPlus simulace GSHP…")

        def _gshp_progress(frac: float) -> None:
            report_progress(
                "gshp", 55 + frac * 40, "EnergyPlus simulace GSHP…",
            )

        print("\n>>> GSHP (zeme-voda) <<<")
        gshp_res = sim.simulate(gshp_model, on_progress=_gshp_progress)

        report_progress("results", 97, "Sestavuji výsledky…")
        demand = self._building_demand(ashp_res, area, rooms)

        return {
            "model_info": {
                "room_count": len(rooms),
                "total_floor_area_m2": round(area, 2),
                "building_type": self._btype,
                "rooms": rooms,
            },
            "parameters": {
                "heat_recovery": self._hr,
                "heating_only": self._heating_only,
                "apply_cz_calibration": self._apply_cz,
                "setpoints_applied": (
                    self._preparer.get_applied_setpoints()
                ),
            },
            "building_demand": demand,
            "ashp": self._build("ASHP (vzduch-voda)", ashp_res),
            "gshp": self._build("GSHP (zeme-voda)", gshp_res),
        }

    @staticmethod
    def _building_demand(
        res: Dict, area: float, rooms: List[Dict],
    ) -> Dict[str, Any]:
        """Tepelna potreba budovy + per-room rozpis."""
        ht = res["annual_heating_kwh"]
        ct = res["annual_cooling_kwh"]
        heat_pz = res.get("heating_per_zone_kwh", {})
        cool_pz = res.get("cooling_per_zone_kwh", {})
        per_room = []
        for r in rooms:
            zk = r["identifier"].upper()
            per_room.append({
                "identifier": r["identifier"],
                "display_name": r["display_name"],
                "floor_area_m2": r["floor_area_m2"],
                "dim_x_m": r["dim_x_m"],
                "dim_y_m": r["dim_y_m"],
                "heating_kwh": heat_pz.get(zk, 0.0),
                "cooling_kwh": cool_pz.get(zk, 0.0),
            })
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
            "rooms": per_room,
        }

    @staticmethod
    def _build(label: str, res: Dict) -> Dict[str, Any]:
        """Sestavi vysledky jednoho HP systemu + COPs."""
        ht = res["annual_heating_kwh"]
        ct = res["annual_cooling_kwh"]
        heat_e = res["annual_heat_elec_kwh"]
        cool_e = res["annual_cool_elec_kwh"]
        total_e = res["annual_electricity_kwh"]

        cop_heat = round(ht / heat_e, 2) if heat_e > 0 else 0.0
        cop_cool = round(ct / cool_e, 2) if cool_e > 0 else 0.0
        cop_year = round(
            (ht + ct) / total_e, 2,
        ) if total_e > 0 else 0.0

        m_h = res["monthly_heating_kwh"]
        m_c = res["monthly_cooling_kwh"]
        m_he = res["monthly_heat_elec_kwh"]
        m_ce = res["monthly_cool_elec_kwh"]
        m_e = res["monthly_electricity_kwh"]
        m_cop_total = [
            round((h + c) / e, 2) if e > 0 else 0.0
            for h, c, e in zip(m_h, m_c, m_e)
        ]
        m_cop_heat = [
            round(h / e, 2) if e > 0 else 0.0
            for h, e in zip(m_h, m_he)
        ]
        m_cop_cool = [
            round(c / e, 2) if e > 0 else 0.0
            for c, e in zip(m_c, m_ce)
        ]

        return {
            "label": label,
            "annual_heating_kwh": ht,
            "annual_cooling_kwh": ct,
            "annual_electricity_kwh": total_e,
            "annual_heat_elec_kwh": round(heat_e, 1),
            "annual_cool_elec_kwh": round(cool_e, 1),
            "cop_heating": cop_heat,
            "cop_cooling": cop_cool,
            "cop_annual": cop_year,
            "monthly_heating_kwh": m_h,
            "monthly_cooling_kwh": m_c,
            "monthly_cop_total": m_cop_total,
            "monthly_cop_heating": m_cop_heat,
            "monthly_cop_cooling": m_cop_cool,
        }