"""
Pomocny orchestrator E+ simulaci pro PED varianty.

Pro kazdou dostupnou TC variantu (ASHP/GSHP) spusti jednu E+ simulaci
PRESNE NAD STEJNYM modelem jako heatpump_real.RealHPAnalyzer — bez
jakekoli kalibrace zatizeni. Heat delivered se proto 1:1 shoduje
s vystupem samostatne simulace TC.

Pokud zadna TC varianta neni dostupna (rozpocet < ASHP i GSHP),
spustime "bare" run s ASHP modelem jen pro extrakci lights+equipment
do PANELS_ONLY varianty.

Vystup: (ashp_cons, gshp_cons, passive_source) — vse dict z
ConsumptionResultsReader.

Soubor: ladybug_be/app/services/ped_optimizer/consumption_runner.py
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional, Tuple, Callable

from ..heatpump_real.real_hp_model_preparer import RealHPModelPreparer
from ..progress import report_progress

from .variant_planner import Variant, ASHP_PANELS, GSHP_PANELS
from .consumption_simulator import ConsumptionSimulator


def run_consumption_simulations(
    preparer: RealHPModelPreparer,
    sim: ConsumptionSimulator,
    variants: List[Variant],
    on_ashp_progress: Optional[Callable[[float], None]] = None,
    on_gshp_progress: Optional[Callable[[float], None]] = None,
    on_bare_progress: Optional[Callable[[float], None]] = None,
) -> Tuple[
    Optional[Dict[str, Any]],
    Optional[Dict[str, Any]],
    Dict[str, Any],
]:
    """Spusti ASHP/GSHP simulace + zajisti zdroj lights/equipment."""
    ashp_cons = None
    gshp_cons = None
    for v in variants:
        if v.key == ASHP_PANELS and v.available:
            print("\n>>> PED: ASHP simulace <<<")
            ashp_cons = sim.simulate(
                preparer.prepare_ashp(),
                on_progress=on_ashp_progress,
            )
        elif v.key == GSHP_PANELS and v.available:
            print("\n>>> PED: GSHP simulace <<<")
            gshp_cons = sim.simulate(
                preparer.prepare_gshp(),
                on_progress=on_gshp_progress,
            )

    passive_source = _pick_passive_source(
        preparer, sim, ashp_cons, gshp_cons, on_bare_progress,
    )
    return ashp_cons, gshp_cons, passive_source


def _pick_passive_source(
    preparer: RealHPModelPreparer,
    sim: ConsumptionSimulator,
    ashp_cons: Optional[Dict[str, Any]],
    gshp_cons: Optional[Dict[str, Any]],
    on_bare_progress: Optional[Callable[[float], None]] = None,
) -> Dict[str, Any]:
    """Zdroj lights+equipment pro PANELS_ONLY variantu (recyklace)."""
    if ashp_cons is not None:
        return ashp_cons
    if gshp_cons is not None:
        return gshp_cons
    print("\n>>> PED: bare simulace pro lights/equipment <<<")
    return sim.simulate(
        preparer.prepare_ashp(),
        on_progress=on_bare_progress,
    )
