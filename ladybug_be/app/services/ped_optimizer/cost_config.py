"""
Konfigurace investicnich nakladu pro PED optimalizator.

Defaulty:
  ASHP (vzduch-voda):  250 000 CZK
  GSHP (zeme-voda):    370 000 CZK
  PV panel (1 kus):     18 000 CZK

Soubor: ladybug_be/app/services/ped_optimizer/cost_config.py
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CostConfig:
    """Konfigurace nakladu — vsechny hodnoty editovatelne pres FE."""

    ashp_total_czk: float = 250_000.0
    gshp_total_czk: float = 370_000.0
    pv_cost_per_panel_czk: float = 18_000.0
