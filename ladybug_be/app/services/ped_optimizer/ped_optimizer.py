"""
PED optimalizator — orchestrator.

Kroky:
  1. Detekce strech + plne solar pipeline (1x) -> max_panels + per-panel data
  2. Variant planning (3 fixni varianty) z budgetu + max_panels
  3. Spotreba — pro kazdou TC variantu jedna E+ simulace, pro PANELS_ONLY
     se recykluji lights+equipment z prvni dostupne TC simulace.
     (Detail viz consumption_runner.run_consumption_simulations.)
  4. Vyhodnoceni per variantu pres VariantEvaluator
  5. Vrati strukturovany dict pro FE

Soubor: ladybug_be/app/services/ped_optimizer/ped_optimizer.py
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from ..heatpump_real.real_hp_model_preparer import RealHPModelPreparer
from ..epw_climate_extractor import EPWClimateExtractor

from .cost_config import CostConfig
from .variant_planner import (
    VariantPlanner, Variant,
    PANELS_ONLY, ASHP_PANELS, GSHP_PANELS,
)
from .consumption_simulator import ConsumptionSimulator
from .consumption_runner import run_consumption_simulations
from .pv_pipeline_runner import PVPipelineRunner
from .variant_evaluator import VariantEvaluator


class PEDOptimizer:
    """Orchestrator PED analyzy."""

    def __init__(
        self,
        hbjson_path: str,
        epw_path: str,
        budget_czk: float,
        config: Optional[CostConfig] = None,
        heating_setpoint_c: float = 20.0,
        pv_efficiency: float = 0.20,
        system_losses: float = 0.10,
        building_type: str = "Residential",
        mounting_type: str = "FixedOpenRack",
        apply_cz_calibration: bool = True,
    ):
        self._hbjson = hbjson_path
        self._epw = epw_path
        self._budget = budget_czk
        self._cfg = config or CostConfig()
        self._heating_sp = heating_setpoint_c
        self._eff = pv_efficiency
        self._losses = system_losses
        self._btype = building_type
        self._mounting = mounting_type
        self._apply_cz = apply_cz_calibration

    def analyze(self) -> Dict[str, Any]:
        """Spusti vsechno a vrati strukturovany vysledek."""
        # 1. Solar pipeline — pustime ji jen pro maximalni N (panels-only)
        max_panels_budget = int(
            self._budget // self._cfg.pv_cost_per_panel_czk,
        )
        pv_runner = PVPipelineRunner(
            hbjson_path=self._hbjson,
            epw_path=self._epw,
            pv_efficiency=self._eff,
            system_losses=self._losses,
            mounting_type=self._mounting,
        )
        pv = pv_runner.run(max_panels_budget)
        max_avail = pv["max_available"]

        # 2. Variant planning
        planner = VariantPlanner(self._cfg)
        variants = planner.plan(self._budget, max_avail)

        # 3. Spotreba (ASHP + GSHP simulace + zdroj lights/equipment)
        # CZ kalibrace bezi automaticky pro building_type='Residential'
        preparer = RealHPModelPreparer(
            hbjson_path=self._hbjson,
            building_type=self._btype,
            heating_setpoint_c=self._heating_sp,
            cooling_setpoint_c=None,
            heat_recovery=0.0,
            heating_only=True,
            apply_cz_calibration=self._apply_cz,
        )
        climate = EPWClimateExtractor(self._epw)
        sim = ConsumptionSimulator(self._epw, climate.get_design_days())
        ashp_cons, gshp_cons, passive_source = run_consumption_simulations(
            preparer, sim, variants,
        )

        # 4. Vyhodnoceni
        floor_area = preparer.get_total_floor_area()
        evaluator = VariantEvaluator(pv, floor_area_m2=floor_area)
        results: List[Dict[str, Any]] = []
        for v in variants:
            results.append(self._evaluate_one(
                v, evaluator, ashp_cons, gshp_cons, passive_source,
            ))

        return {
            "location": climate.get_location_info().get("city", ""),
            "model_info": {
                "room_count": len(preparer.get_rooms_info()),
                "total_floor_area_m2": round(
                    preparer.get_total_floor_area(), 2,
                ),
                "building_type": self._btype,
            },
            "parameters": {
                "heating_setpoint_c": self._heating_sp,
                "apply_cz_calibration": self._apply_cz,
            },
            "pv_settings": {
                "engine": "Radiance + pvlib",
                "mounting_type": self._mounting,
            },
            "max_panels_available": max_avail,
            "budget_czk": round(self._budget),
            "variants": results,
            "best_index": self._best_index(results),
        }

    # ------------------------------------------------------------------
    # Privatni
    # ------------------------------------------------------------------

    @staticmethod
    def _evaluate_one(
        v: Variant,
        evaluator: VariantEvaluator,
        ashp_cons: Optional[Dict[str, Any]],
        gshp_cons: Optional[Dict[str, Any]],
        passive_source: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not v.available:
            return evaluator.evaluate_unavailable(v)
        if v.key == PANELS_ONLY:
            return evaluator.evaluate(v, passive_source, passive_only=True)
        if v.key == ASHP_PANELS:
            return evaluator.evaluate(v, ashp_cons, passive_only=False)
        if v.key == GSHP_PANELS:
            return evaluator.evaluate(v, gshp_cons, passive_only=False)
        raise ValueError(f"Neznamy klic varianty: {v.key}")

    @staticmethod
    def _best_index(results: List[Dict[str, Any]]) -> int:
        """Vyber variantu s nejvyssim balance_kwh (jen z dostupnych)."""
        best_i = 0
        best_val = float("-inf")
        for i, r in enumerate(results):
            bal = r.get("balance_kwh")
            if bal is None:
                continue
            if bal > best_val:
                best_val = bal
                best_i = i
        return best_i
