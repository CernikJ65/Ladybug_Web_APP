"""
Optimalizace výběru solárních panelů.

Postup:
  1. Přiřadí radiaci z RadiationStudy každému panelu (Shade objektu)
  2. Spočítá roční výrobu: radiace × plocha × účinnost × PR
  3. Seřadí panely od nejlepšího (nejvyšší výroba)
  4. Vrátí požadovaný počet panelů jako jediný výsledek

Dataclassy a serializace žijí v panel_optimizer_models.py.
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional

from .panel_placer import PanelPosition
from .panel_optimizer_models import (
    OptimizationResult,
    panel_position_to_result,
    result_to_dict,
)

# Re-export pro zpětnou kompatibilitu (dříve importovatelné z panel_optimizer)
from .panel_optimizer_models import PanelResult  # noqa: F401


class PanelOptimizer:
    """Optimalizuje výběr panelů podle solární radiace."""

    def __init__(
        self, pv_efficiency: float = 0.20, system_losses: float = 0.10
    ):
        self.pv_efficiency = pv_efficiency
        self.performance_ratio = 1.0 - system_losses

    def assign_radiation(
        self, panels: List[PanelPosition], radiation_values: List[float]
    ) -> None:
        """Přiřadí radiaci a spočítá základní výrobu pro každý panel."""
        for panel, rad in zip(panels, radiation_values):
            panel.radiation_kwh_m2 = rad
            panel.annual_production_kwh = round(
                rad * panel.area * self.pv_efficiency * self.performance_ratio,
                2,
            )

    def apply_pvlib_production(
        self, panels: List[PanelPosition], pvlib_results: Dict[str, Any]
    ) -> None:
        """Přepíše výrobu hodnotami z pvlib PVWatts (Radiance POA)."""
        panel_data = pvlib_results.get("panel_results", [])
        if not panel_data:
            return
        lookup = {r["panel_id"]: r["annual_production_kwh"] for r in panel_data}
        for panel in panels:
            if panel.id not in lookup:
                continue
            value = lookup[panel.id]
            # annual_production_kwh používá optimize() k řazení → přepisuj jen
            # pokud engine vrátil >0 (ochrana proti zkažení radiation-based
            # výroby, pokud pvlib z nějakého důvodu vrátil nulu).
            if value > 0:
                panel.annual_production_kwh = value

    def optimize(
        self,
        panels: List[PanelPosition],
        requested_count: int,
        total_available: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Seřadí panely a vrátí TOP-N (požadovaný počet) jako jediný výsledek.

        `total_available` — skutečný počet všech umístěných panelů (před
        výběrem TOP kandidátů pro EnergyPlus). Pokud není zadán, spadne
        se na `len(panels)`.
        """
        sorted_panels = sorted(
            panels, key=lambda p: p.annual_production_kwh, reverse=True
        )
        evaluated_count = len(sorted_panels)
        max_panels = total_available if total_available is not None else evaluated_count
        actual_count = max(1, min(requested_count, max_panels, evaluated_count))

        selected = sorted_panels[:actual_count]
        result = self._build_result(selected, actual_count)

        return {
            "max_panels_available": max_panels,
            "requested_count": actual_count,
            "result": result_to_dict(result),
        }

    # ------------------------------------------------------------------
    # Interní
    # ------------------------------------------------------------------

    def _build_result(
        self, selected: List[PanelPosition], count: int
    ) -> OptimizationResult:
        total_prod = sum(p.annual_production_kwh for p in selected)
        total_area = sum(p.area for p in selected)
        avg_rad = (
            sum(p.radiation_kwh_m2 for p in selected) / len(selected)
            if selected else 0
        )

        panels = [
            panel_position_to_result(p, self.pv_efficiency) for p in selected
        ]

        return OptimizationResult(
            num_panels=count,
            total_production_kwh=round(total_prod, 2),
            total_capacity_kwp=round(total_area * self.pv_efficiency, 2),
            total_area_m2=round(total_area, 2),
            avg_radiation_kwh_m2=round(avg_rad, 2),
            panels=panels,
        )
