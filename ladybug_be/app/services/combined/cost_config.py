"""
Investiční náklady — ASHP i GSHP.

ASHP (vzduch–voda): ~345 000 CZK vč. instalace
GSHP (země–voda + plošný kolektor 1.5m): ~500 000 CZK

Soubor: ladybug_be/app/services/combined/cost_config.py
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CostConfig:
    """Konfigurace nákladů pro PED analýzu."""

    ashp_total_czk: float = 345_000.0
    gshp_total_czk: float = 500_000.0
    pv_cost_per_panel_czk: float = 18_000.0