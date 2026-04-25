"""
Spouštění PV engine(ů) — EnergyPlus PVWatts a/nebo pvlib PVWatts.

Oddělené od run_solar_pipeline, aby volba engine a progress reporting
žily v jednom modulu a pipeline zůstala přehledná.
"""
from __future__ import annotations

from typing import List, Optional

from ..services.progress import report_progress


def run_engines(
    *,
    pv_engine: str,
    pv_sim,
    ep_candidates,
    building_model,
    epw_path: str,
    pv_efficiency: float,
    system_losses: float,
    mounting_type: str,
    pvlib_cls,
) -> dict:
    """Odbaví EnergyPlus a/nebo pvlib engine podle výběru."""
    run_ep = pv_engine in ("energyplus", "both")
    run_pvlib = pv_engine in ("pvlib", "both")

    ep_results: Optional[dict] = None
    pvlib_results: Optional[dict] = None
    label_parts: List[str] = []

    if run_ep:
        ep_results = _run_energyplus(pv_sim, ep_candidates, building_model)
        label_parts.append(
            ep_results.get("simulation_engine", "EnergyPlus_PVWatts")
        )

    if run_pvlib:
        pvlib_results = _run_pvlib(
            pvlib_cls=pvlib_cls,
            ep_candidates=ep_candidates,
            epw_path=epw_path,
            pv_efficiency=pv_efficiency,
            system_losses=system_losses,
            mounting_type=mounting_type,
            after_ep=run_ep,
        )
        label_parts.append(
            pvlib_results.get("simulation_engine", "pvlib_PVWatts")
        )

    return {
        "ep_results": ep_results,
        "pvlib_results": pvlib_results,
        "engine_label_parts": label_parts,
    }


def _run_energyplus(pv_sim, ep_candidates, building_model) -> dict:
    pv_sim.assign_pv_properties(ep_candidates)
    report_progress("energyplus", 40)

    # Progress vázaný na stdout EnergyPlus — každý dokončený měsíc posune
    # procenta. 40 → 92 = 52 bodů rozložených přes ~13 event-lajn.
    def _ep_progress(fraction: float) -> None:
        report_progress("energyplus", 40 + fraction * 52)

    return pv_sim.simulate(
        ep_candidates, building_model, on_progress=_ep_progress,
    )


def _run_pvlib(
    *,
    pvlib_cls,
    ep_candidates,
    epw_path: str,
    pv_efficiency: float,
    system_losses: float,
    mounting_type: str,
    after_ep: bool,
) -> dict:
    report_progress("pvlib", 93 if after_ep else 60)
    pvlib_calc = pvlib_cls(
        epw_path=epw_path,
        rated_efficiency=pv_efficiency,
        mounting_type=mounting_type,
    )
    return pvlib_calc.simulate(ep_candidates)
