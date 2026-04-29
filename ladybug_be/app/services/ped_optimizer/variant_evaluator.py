"""
Vyhodnoceni jedne varianty: zkombinuje spotrebu + PV vyrobu.

Pro variantu PANELS_ONLY:
  - HVAC slozky se vynuluji (zadne TC = bez topeni, bez fanu, bez cerpadel)
  - Lights + Equipment se prevezme z dodanych referencnich dat
    (z ASHP/GSHP/bare runu — viz orchestrator)
  - Vytapeni neni pokryto -> UI ukaze upozorneni

Pro varianty ASHP_PANELS / GSHP_PANELS:
  - Spotreba = vse z prislusne E+ simulace
  - PV = soucet TOP-N panelu

Soubor: ladybug_be/app/services/ped_optimizer/variant_evaluator.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from .variant_planner import (
    Variant, variant_to_dict,
    PANELS_ONLY,
)
from .pv_pipeline_runner import PVPipelineRunner

MONTH_NAMES = [
    "Leden", "Unor", "Brezen", "Duben", "Kveten", "Cerven",
    "Cervenec", "Srpen", "Zari", "Rijen", "Listopad", "Prosinec",
]

PASSIVE_KEYS = ("lights", "equipment")
HVAC_KEYS = ("heating", "cooling", "fans", "pumps", "heat_rejection")


class VariantEvaluator:
    """Evaluator pro jednu variantu."""

    def __init__(
        self, pv_pipeline: Dict[str, Any], floor_area_m2: float = 0.0,
    ):
        self._pv = pv_pipeline
        self._area = max(floor_area_m2, 0.0)

    def evaluate(
        self,
        variant: Variant,
        consumption: Dict[str, Any],
        passive_only: bool,
    ) -> Dict[str, Any]:
        """consumption: dict z ConsumptionResultsReader (annual+monthly)."""
        annual_breakdown = self._build_annual(
            consumption["annual_kwh"], passive_only,
        )
        monthly_breakdown = self._build_monthly(
            consumption["monthly_kwh"], passive_only,
        )

        annual_pv = PVPipelineRunner.sum_top_n(
            self._pv["panel_annual_kwh"], variant.num_panels,
        )
        monthly_pv = PVPipelineRunner.sum_top_n_monthly(
            self._pv["panel_monthly_kwh"], variant.num_panels,
        )

        cons_total = annual_breakdown["total"]
        balance = annual_pv - cons_total
        ped_ratio = (annual_pv / cons_total) if cons_total > 0 else 0.0
        deficit = max(cons_total - annual_pv, 0.0)
        cons_per_m2 = (
            cons_total / self._area if self._area > 0 else 0.0
        )

        return {
            "system": variant_to_dict(variant),
            "consumption_kwh": annual_breakdown,
            "consumption_per_m2_kwh": round(cons_per_m2, 1),
            "pv_production_kwh": round(annual_pv, 1),
            "balance_kwh": round(balance, 1),
            "ped_ratio": round(ped_ratio, 3),
            "is_ped": balance >= 0,
            "deficit_kwh": round(deficit, 1),
            "heating_uncovered": variant.key == PANELS_ONLY,
            "hp_performance": self._build_hp_performance(
                consumption, annual_breakdown, passive_only, self._area,
            ),
            "monthly": self._build_monthly_table(
                monthly_breakdown, monthly_pv,
            ),
        }

    @staticmethod
    def evaluate_unavailable(variant: Variant) -> Dict[str, Any]:
        """Pro variantu kterou nejde realizovat (rozpocet < cena)."""
        return {
            "system": variant_to_dict(variant),
            "consumption_kwh": None,
            "consumption_per_m2_kwh": None,
            "pv_production_kwh": None,
            "balance_kwh": None,
            "ped_ratio": None,
            "is_ped": False,
            "deficit_kwh": None,
            "heating_uncovered": False,
            "hp_performance": None,
            "monthly": [],
        }

    @staticmethod
    def _build_hp_performance(
        consumption: Dict[str, Any],
        annual_breakdown: Dict[str, float],
        passive_only: bool,
        floor_area_m2: float,
    ) -> Dict[str, Any] | None:
        """Vrati SCOP + dodane teplo + teplo z prostredi pro TC variantu.

        SCOP definice (jako v heatpump_real RealHPAnalyzer):
          system_elec = heating + fans + pumps + heat_rejection
          SCOP = delivered / system_elec
        Tim se zahrnuji parazitni spotreby (obehova cerpadla, ventilatory).
        """
        if passive_only:
            return None
        delivered = consumption.get(
            "heating_delivered_kwh", {},
        ).get("annual", 0.0)
        heat_elec = annual_breakdown.get("heating", 0.0)
        fan_elec = annual_breakdown.get("fans", 0.0)
        pump_elec = annual_breakdown.get("pumps", 0.0)
        hr_elec = annual_breakdown.get("heat_rejection", 0.0)
        system_elec = heat_elec + fan_elec + pump_elec + hr_elec
        if delivered <= 0 and system_elec <= 0:
            return None
        scop = (delivered / system_elec) if system_elec > 0 else 0.0
        free_heat = max(delivered - system_elec, 0.0)
        per_m2 = (
            delivered / floor_area_m2 if floor_area_m2 > 0 else 0.0
        )
        return {
            "heat_delivered_kwh": round(delivered, 1),
            "heat_demand_per_m2_kwh": round(per_m2, 1),
            "heating_electricity_kwh": round(heat_elec, 1),
            "system_electricity_kwh": round(system_elec, 1),
            "free_heat_kwh": round(free_heat, 1),
            "scop": round(scop, 2),
        }

    # ------------------------------------------------------------------
    # Privatni — sestaveni breakdown
    # ------------------------------------------------------------------

    @staticmethod
    def _build_annual(
        src: Dict[str, float], passive_only: bool,
    ) -> Dict[str, float]:
        out = {k: 0.0 for k in HVAC_KEYS + PASSIVE_KEYS}
        for k in PASSIVE_KEYS:
            out[k] = src.get(k, 0.0)
        if not passive_only:
            for k in HVAC_KEYS:
                out[k] = src.get(k, 0.0)
        out["total"] = round(sum(out.values()), 1)
        return out

    @staticmethod
    def _build_monthly(
        src: Dict[str, List[float]], passive_only: bool,
    ) -> List[Dict[str, float]]:
        rows: List[Dict[str, float]] = []
        for m in range(12):
            row = {k: 0.0 for k in HVAC_KEYS + PASSIVE_KEYS}
            for k in PASSIVE_KEYS:
                row[k] = src.get(k, [0.0] * 12)[m]
            if not passive_only:
                for k in HVAC_KEYS:
                    row[k] = src.get(k, [0.0] * 12)[m]
            row["total"] = round(sum(row.values()), 1)
            rows.append(row)
        return rows

    @staticmethod
    def _build_monthly_table(
        consumption_rows: List[Dict[str, float]],
        pv_monthly: List[float],
    ) -> List[Dict[str, Any]]:
        out = []
        for m in range(12):
            cons = consumption_rows[m]["total"]
            pv = pv_monthly[m]
            bal = pv - cons
            out.append({
                "month": MONTH_NAMES[m],
                "consumption_kwh": round(cons, 1),
                "pv_kwh": round(pv, 1),
                "balance_kwh": round(bal, 1),
                "is_positive": bal >= 0,
            })
        return out
