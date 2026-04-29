"""
Generuje 3 fixni varianty PED reseni z rozpoctu.

  PANELS_ONLY  — jen panely (referencni, bez TC)
  ASHP_PANELS  — 1x ASHP + zbytek panely (vyzaduje budget >= ASHP)
  GSHP_PANELS  — 1x GSHP + zbytek panely (vyzaduje budget >= GSHP)

Pokud rozpocet nestaci, varianta zustane v listu jako available=False
s lidskym zduvodnenim — uzivatel vidi, ze ji nelze realizovat.

Soubor: ladybug_be/app/services/ped_optimizer/variant_planner.py
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .cost_config import CostConfig

PANELS_ONLY = "panels_only"
ASHP_PANELS = "ashp_panels"
GSHP_PANELS = "gshp_panels"


@dataclass
class Variant:
    """Jedna konfigurace systemu."""

    key: str
    label: str
    available: bool
    unavailable_reason: str
    has_hp: bool
    hp_type: str
    hp_label: str
    hp_cost_czk: float
    num_panels: int
    pv_cost_czk: float
    total_cost_czk: float
    remaining_czk: float


class VariantPlanner:
    """Sestavi 3 varianty z rozpoctu + dostupnosti panelu na strese."""

    def __init__(self, config: CostConfig):
        self._cfg = config

    def plan(
        self, budget: float, max_panels_available: int,
    ) -> List[Variant]:
        """Vrati 3 varianty (vzdy v poradi PANELS_ONLY, ASHP, GSHP)."""
        return [
            self._panels_only(budget, max_panels_available),
            self._ashp_panels(budget, max_panels_available),
            self._gshp_panels(budget, max_panels_available),
        ]

    # ------------------------------------------------------------------
    # Privatni — sestaveni jednotlivych variant
    # ------------------------------------------------------------------

    def _panels_only(
        self, budget: float, max_avail: int,
    ) -> Variant:
        pc = self._cfg.pv_cost_per_panel_czk
        n = self._panel_count(budget, max_avail)
        pv_cost = n * pc
        return Variant(
            key=PANELS_ONLY,
            label="Pouze panely (referencni)",
            available=True,
            unavailable_reason="",
            has_hp=False,
            hp_type="",
            hp_label="",
            hp_cost_czk=0.0,
            num_panels=n,
            pv_cost_czk=pv_cost,
            total_cost_czk=pv_cost,
            remaining_czk=budget - pv_cost,
        )

    def _ashp_panels(
        self, budget: float, max_avail: int,
    ) -> Variant:
        return self._hp_with_panels(
            budget, max_avail,
            key=ASHP_PANELS,
            hp_type="ashp",
            hp_label="ASHP (vzduch-voda)",
            hp_cost=self._cfg.ashp_total_czk,
            label_prefix="ASHP + panely",
        )

    def _gshp_panels(
        self, budget: float, max_avail: int,
    ) -> Variant:
        return self._hp_with_panels(
            budget, max_avail,
            key=GSHP_PANELS,
            hp_type="gshp",
            hp_label="GSHP (zeme-voda)",
            hp_cost=self._cfg.gshp_total_czk,
            label_prefix="GSHP + panely",
        )

    def _hp_with_panels(
        self,
        budget: float,
        max_avail: int,
        key: str,
        hp_type: str,
        hp_label: str,
        hp_cost: float,
        label_prefix: str,
    ) -> Variant:
        if budget < hp_cost:
            reason = (
                f"Rozpocet {self._fmt(budget)} Kc < cena "
                f"{hp_label} {self._fmt(hp_cost)} Kc"
            )
            return Variant(
                key=key, label=label_prefix,
                available=False, unavailable_reason=reason,
                has_hp=True, hp_type=hp_type, hp_label=hp_label,
                hp_cost_czk=hp_cost,
                num_panels=0, pv_cost_czk=0.0,
                total_cost_czk=0.0, remaining_czk=budget,
            )
        rest = budget - hp_cost
        n = self._panel_count(rest, max_avail)
        pv_cost = n * self._cfg.pv_cost_per_panel_czk
        return Variant(
            key=key, label=label_prefix,
            available=True, unavailable_reason="",
            has_hp=True, hp_type=hp_type, hp_label=hp_label,
            hp_cost_czk=hp_cost,
            num_panels=n, pv_cost_czk=pv_cost,
            total_cost_czk=hp_cost + pv_cost,
            remaining_czk=budget - hp_cost - pv_cost,
        )

    def _panel_count(self, money: float, max_avail: int) -> int:
        pc = self._cfg.pv_cost_per_panel_czk
        if pc <= 0 or money <= 0:
            return 0
        return min(int(money // pc), max(max_avail, 0))

    @staticmethod
    def _fmt(v: float) -> str:
        return f"{int(round(v)):,}".replace(",", " ")


def variant_to_dict(v: Variant) -> dict:
    """Variant -> JSON-ready dict."""
    return {
        "key": v.key,
        "label": v.label,
        "available": v.available,
        "unavailable_reason": v.unavailable_reason,
        "has_hp": v.has_hp,
        "hp_type": v.hp_type,
        "hp_label": v.hp_label,
        "hp_cost_czk": round(v.hp_cost_czk),
        "num_panels": v.num_panels,
        "pv_cost_czk": round(v.pv_cost_czk),
        "total_cost_czk": round(v.total_cost_czk),
        "remaining_czk": round(v.remaining_czk),
    }
