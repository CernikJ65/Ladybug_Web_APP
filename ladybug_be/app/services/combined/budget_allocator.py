"""
Rozpočtový alokátor — zkusí ASHP, GSHP, jen FVE.

Pro každou variantu TČ odečte jeho cenu z rozpočtu
a za zbytek koupí maximum FV panelů.

Soubor: ladybug_be/app/services/combined/budget_allocator.py
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, List

from .cost_config import CostConfig


@dataclass
class SystemVariant:
    """Jedna konfigurace systému."""

    hp_type: str
    hp_label: str
    has_hp: bool
    num_panels: int
    hp_cost_czk: float
    pv_cost_czk: float
    total_cost_czk: float
    remaining_czk: float


class BudgetAllocator:
    """Generuje varianty systému z rozpočtu."""

    def __init__(self, config: CostConfig):
        self._cfg = config

    def generate_variants(
        self, budget: float,
    ) -> List[SystemVariant]:
        """Vrátí všechny varianty v rámci rozpočtu."""
        variants = []
        pc = self._cfg.pv_cost_per_panel_czk

        for hp_type, label, cost in [
            ("ashp", "TČ vzduch–voda", self._cfg.ashp_total_czk),
            ("gshp", "TČ země–voda", self._cfg.gshp_total_czk),
        ]:
            if budget >= cost:
                rest = budget - cost
                n = int(rest // pc) if pc > 0 else 0
                pv = n * pc
                variants.append(SystemVariant(
                    hp_type=hp_type, hp_label=label,
                    has_hp=True, num_panels=n,
                    hp_cost_czk=cost, pv_cost_czk=pv,
                    total_cost_czk=cost + pv,
                    remaining_czk=budget - cost - pv,
                ))

        # Jen FVE
        n = int(budget // pc) if pc > 0 else 0
        if n > 0:
            pv = n * pc
            variants.append(SystemVariant(
                hp_type="none", hp_label="Pouze FVE",
                has_hp=False, num_panels=n,
                hp_cost_czk=0, pv_cost_czk=pv,
                total_cost_czk=pv,
                remaining_czk=budget - pv,
            ))

        return variants

    @staticmethod
    def variant_to_dict(v: SystemVariant) -> Dict[str, Any]:
        return {
            "hp_type": v.hp_type,
            "hp_label": v.hp_label,
            "has_hp": v.has_hp,
            "num_panels": v.num_panels,
            "hp_cost_czk": round(v.hp_cost_czk),
            "pv_cost_czk": round(v.pv_cost_czk),
            "total_cost_czk": round(v.total_cost_czk),
            "remaining_czk": round(v.remaining_czk),
        }