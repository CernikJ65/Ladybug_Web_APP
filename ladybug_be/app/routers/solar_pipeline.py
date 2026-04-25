"""
Synchronní pipeline pro optimalizaci FV panelů.

Pouští se v threadpoolu, aby neblokovala FastAPI event loop. Spouštění
enginů žije v solar_engines, sestavení response v solar_response.

Pipeline:
  1. HBJSON → detekce střech
  2. EPW → SkyMatrix → RadiationDome → optimální sklon
  3. Umístění všech možných panelů
  4. RadiationStudy → radiace pro všechny panely
  5. Seřazení → TOP kandidáti
  6. PV engine(y): EnergyPlus PVWatts a/nebo pvlib PVWatts (Radiance POA)
  7. Optimalizace → varianty
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from ..services.progress import progress_scope, report_progress
from .solar_engines import run_engines
from .solar_response import build_response


def run_solar_pipeline(
    hbjson_path: str,
    epw_path: str,
    num_panels: int,
    pv_efficiency: float,
    system_losses: float,
    panel_width: float,
    panel_height: float,
    panel_spacing: float,
    max_tilt: float,
    mounting_type: str,
    pv_engine: str,
    job_id: Optional[str],
) -> dict:
    """Hlavní orchestrace — běží synchronně v threadpoolu."""
    from ..services.roof_detector import RoofDetector
    from ..services.panel_placer import PanelPlacer
    from ..services.solar_calculator import SolarRadiationCalculator
    from ..services.panel_optimizer import PanelOptimizer
    from ..services.tilt_optimizer import TiltOptimizer
    from ..services.pv_simulator import PVSimulator
    from ..services.pvlib_calculator import PVLibCalculator

    with progress_scope(job_id):
        report_progress("init", 2)

        # 1. Detekce střech
        report_progress("roofs", 6)
        detector = RoofDetector(hbjson_path)
        roofs = detector.detect_roofs(max_tilt=max_tilt)
        if not roofs:
            raise HTTPException(400, "Žádné střechy nenalezeny.")
        model_info = detector.get_model_info()
        context = detector.get_context_geometry()

        # 2. Klimatická data + optimální sklon
        report_progress("climate", 12)
        calc = SolarRadiationCalculator(epw_path)
        calc.load_and_prepare()
        location_info = calc.get_location_info()
        latitude = location_info.get("latitude", 50.0)

        report_progress("tilt", 18)
        tilt_opt = TiltOptimizer(calc.sky_matrix, calc.location)
        optimal = tilt_opt.find_optimal_orientation()

        # 3. Umístění panelů
        report_progress("placement", 24)
        placer = PanelPlacer(
            panel_width=panel_width,
            panel_height=panel_height,
            spacing=panel_spacing,
            tilt_optimizer=tilt_opt,
            latitude=latitude,
        )
        all_panels = placer.place_on_all_roofs(roofs)
        if not all_panels:
            raise HTTPException(400, "Na střechách není místo pro panely.")

        # 4. RadiationStudy → radiace pro všechny panely
        report_progress("radiation", 32)
        radiation_values = calc.calculate_panel_radiation(all_panels, context)

        # 5. Přiřaď radiaci a seřaď
        report_progress("ranking", 38)
        optimizer = PanelOptimizer(pv_efficiency, system_losses)
        optimizer.assign_radiation(all_panels, radiation_values)

        # 6. TOP kandidáti pro engine(y)
        ep_candidates = _top_candidates(all_panels, num_panels)

        # 7. PV engine(y)
        pv_sim = PVSimulator(
            epw_path=epw_path,
            rated_efficiency=pv_efficiency,
            mounting_type=mounting_type,
        )
        engine_out = run_engines(
            pv_engine=pv_engine,
            pv_sim=pv_sim,
            ep_candidates=ep_candidates,
            building_model=detector.model,
            epw_path=epw_path,
            pv_efficiency=pv_efficiency,
            system_losses=system_losses,
            mounting_type=mounting_type,
            pvlib_cls=PVLibCalculator,
        )
        ep_results = engine_out["ep_results"]
        pvlib_results = engine_out["pvlib_results"]

        # 8. Optimalizace — při "both" má pvlib finální annual_production_kwh
        # (aplikováno jako poslední) díky přesnější Radiance POA; EP zůstává
        # na panelu jako production_ep_kwh pro porovnání. EP stíněná POA se
        # propisuje na panel uvnitř apply_energyplus_production (z SQL).
        report_progress("optimize", 96)
        if ep_results is not None:
            optimizer.apply_energyplus_production(ep_candidates, ep_results)
        if pvlib_results is not None:
            optimizer.apply_pvlib_production(ep_candidates, pvlib_results)
        results = optimizer.optimize(
            ep_candidates, num_panels, total_available=len(all_panels)
        )

    return build_response(
        roofs=roofs,
        model_info=model_info,
        location_info=location_info,
        optimal=optimal,
        panel_width=panel_width,
        panel_height=panel_height,
        panel_spacing=panel_spacing,
        pv_efficiency=pv_efficiency,
        pv_sim=pv_sim,
        mounting_type=mounting_type,
        engine_label_parts=engine_out["engine_label_parts"],
        pv_engine=pv_engine,
        ep_results=ep_results,
        pvlib_results=pvlib_results,
        results=results,
    )


def _top_candidates(all_panels, num_panels: int):
    """Výběr TOP kandidátů pro engine(y) — jen (N+1) nejvýkonnějších."""
    ep_candidate_count = min(
        len(all_panels),
        max(num_panels + 1, int((num_panels + 1) * 1.2)),
    )
    sorted_all = sorted(
        all_panels, key=lambda p: p.annual_production_kwh, reverse=True,
    )
    return sorted_all[:ep_candidate_count]
