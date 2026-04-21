"""
Optimalizace výběru solárních panelů.

Postup:
  1. Přiřadí radiaci z RadiationStudy každému panelu (Shade objektu)
  2. Spočítá roční výrobu: radiace × plocha × účinnost × PR
  3. Seřadí panely od nejlepšího (nejvyšší výroba)
  4. Vrátí požadovanou variantu + 3 alternativy

Environmentální metriky: CO₂ úspory (0.468 kg/kWh CZ mix), stromy.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from .panel_placer import PanelPosition

CO2_KG_PER_KWH = 0.468
TREES_PER_TON_CO2 = 50


@dataclass
class PanelResult:
    """Serializovatelný výsledek jednoho panelu."""

    id: int
    shade_id: str
    roof_id: str
    center: List[float]
    area_m2: float
    tilt: float
    azimuth: float
    radiation_kwh_m2: float
    annual_production_kwh: float
    capacity_kwp: float


@dataclass
class OptimizationVariant:
    """Jedna varianta rozmístění panelů."""

    num_panels: int
    is_requested: bool
    total_production_kwh: float
    total_capacity_kwp: float
    total_area_m2: float
    avg_radiation_kwh_m2: float
    co2_savings_kg: float
    co2_savings_tons: float
    trees_equivalent: float
    panels: List[PanelResult]


class PanelOptimizer:
    """Optimalizuje výběr panelů podle solární radiace."""

    def __init__(
        self, pv_efficiency: float = 0.20, system_losses: float = 0.14
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

    def apply_energyplus_production(
        self, panels: List[PanelPosition], ep_results: Dict[str, Any]
    ) -> None:
        """Přepíše výrobu hodnotami z EnergyPlus (pokud jsou dostupné)."""
        panel_data = ep_results.get("panel_results", [])
        if not panel_data:
            return
        lookup = {r["panel_id"]: r["annual_production_kwh"] for r in panel_data}
        for panel in panels:
            if panel.id in lookup and lookup[panel.id] > 0:
                panel.annual_production_kwh = lookup[panel.id]

    def optimize(
        self,
        panels: List[PanelPosition],
        requested_count: int,
        total_available: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Seřadí panely, vrátí požadovanou + alternativní varianty.

        Alternativy: N-2, N-1, N (požadovaný), N+1

        `total_available` — skutečný počet všech umístěných panelů (před
        výběrem TOP kandidátů pro EnergyPlus). Pokud není zadán, spadne
        se na `len(panels)` (původní chování).
        """
        sorted_panels = sorted(
            panels, key=lambda p: p.annual_production_kwh, reverse=True
        )
        evaluated_count = len(sorted_panels)
        max_panels = total_available if total_available is not None else evaluated_count
        requested_count = min(requested_count, max_panels)
        # Varianty lze sestavit jen z panelů, pro které máme EnergyPlus
        # výrobu — horní mez je tedy evaluated_count, ne max_panels.
        variant_cap = min(max_panels, evaluated_count)

        counts = set()
        for delta in [-2, -1, 0, 1]:
            c = requested_count + delta
            if 1 <= c <= variant_cap:
                counts.add(c)
        if 1 <= requested_count <= variant_cap:
            counts.add(requested_count)

        variants = []
        for count in sorted(counts):
            variant = self._build_variant(
                sorted_panels[:count], count,
                is_requested=(count == requested_count),
            )
            variants.append(variant)

        return {
            "max_panels_available": max_panels,
            "requested_count": requested_count,
            "variants": [self._variant_to_dict(v) for v in variants],
        }

    # ------------------------------------------------------------------
    # Interní
    # ------------------------------------------------------------------

    def _build_variant(
        self, selected: List[PanelPosition], count: int, is_requested: bool
    ) -> OptimizationVariant:
        total_prod = sum(p.annual_production_kwh for p in selected)
        total_area = sum(p.area for p in selected)
        total_cap = round(total_area * self.pv_efficiency, 2)
        avg_rad = (
            sum(p.radiation_kwh_m2 for p in selected) / len(selected)
            if selected else 0
        )
        co2_kg = total_prod * CO2_KG_PER_KWH

        panels = [
            PanelResult(
                id=p.id,
                shade_id=p.shade.identifier,
                roof_id=p.roof_id,
                center=[
                    round(p.center_3d.x, 1),
                    round(p.center_3d.y, 1),
                    round(p.center_3d.z, 1),
                ],
                area_m2=p.area,
                tilt=p.tilt,
                azimuth=p.azimuth,
                radiation_kwh_m2=p.radiation_kwh_m2,
                annual_production_kwh=p.annual_production_kwh,
                capacity_kwp=round(p.area * self.pv_efficiency, 3),
            )
            for p in selected
        ]

        return OptimizationVariant(
            num_panels=count,
            is_requested=is_requested,
            total_production_kwh=round(total_prod, 2),
            total_capacity_kwp=total_cap,
            total_area_m2=round(total_area, 2),
            avg_radiation_kwh_m2=round(avg_rad, 2),
            co2_savings_kg=round(co2_kg, 2),
            co2_savings_tons=round(co2_kg / 1000, 2),
            trees_equivalent=round(co2_kg / 1000 * TREES_PER_TON_CO2, 1),
            panels=panels,
        )

    @staticmethod
    def _variant_to_dict(v: OptimizationVariant) -> Dict[str, Any]:
        return {
            "num_panels": v.num_panels,
            "is_requested": v.is_requested,
            "total_production_kwh": v.total_production_kwh,
            "total_capacity_kwp": v.total_capacity_kwp,
            "total_area_m2": v.total_area_m2,
            "avg_radiation_kwh_m2": v.avg_radiation_kwh_m2,
            "co2_savings_kg": v.co2_savings_kg,
            "co2_savings_tons": v.co2_savings_tons,
            "trees_equivalent": v.trees_equivalent,
            "panels": [
                {
                    "id": p.id,
                    "shade_id": p.shade_id,
                    "roof_id": p.roof_id,
                    "center": p.center,
                    "area_m2": p.area_m2,
                    "tilt": p.tilt,
                    "azimuth": p.azimuth,
                    "radiation_kwh_m2": p.radiation_kwh_m2,
                    "annual_production_kwh": p.annual_production_kwh,
                    "capacity_kwp": p.capacity_kwp,
                }
                for p in v.panels
            ],
        }