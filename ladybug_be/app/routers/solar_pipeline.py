"""
Synchronní pipeline pro optimalizaci FV panelů.

Pouští se v threadpoolu, aby neblokovala FastAPI event loop. Sestavení
response žije v solar_response.

Pipeline:
  1. HBJSON → detekce střech
  2. EPW → SkyMatrix → RadiationDome → optimální sklon
  3. Umístění všech možných panelů
  4. RadiationStudy → radiace pro všechny panely
  5. Seřazení → TOP kandidáti
  6. pvlib PVWatts (Radiance POA)
  7. Optimalizace → varianty
"""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from ..services.progress import progress_scope, report_progress
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
    job_id: Optional[str],
) -> dict:
    """Hlavní orchestrace — běží synchronně v threadpoolu."""
    from ..services.roof_detector import RoofDetector
    from ..services.panel_placer import PanelPlacer
    from ..services.solar_calculator import SolarRadiationCalculator
    from ..services.panel_optimizer import PanelOptimizer
    from ..services.tilt_optimizer import TiltOptimizer
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

        report_progress("tilt", 25)
        tilt_opt = TiltOptimizer(calc.sky_matrix, calc.location)
        optimal = tilt_opt.find_optimal_orientation()

        # 3. Umístění panelů
        report_progress("placement", 35)
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
        report_progress("radiation", 50)
        radiation_values = calc.calculate_panel_radiation(all_panels, context)

        # 5. Přiřaď radiaci a seřaď
        report_progress("ranking", 70)
        optimizer = PanelOptimizer(pv_efficiency, system_losses)
        optimizer.assign_radiation(all_panels, radiation_values)

        # 6. TOP kandidáti pro pvlib engine
        candidates = _top_candidates(all_panels, num_panels)

        # 7. pvlib PVWatts simulace s Radiance POA
        report_progress("pvlib", 80)
        pvlib_calc = PVLibCalculator(
            epw_path=epw_path,
            rated_efficiency=pv_efficiency,
            mounting_type=mounting_type,
        )
        pvlib_results = pvlib_calc.simulate(candidates)

        # 8. Optimalizace — pvlib přepisuje annual_production_kwh
        # přesnější Radiance-based hodnotou.
        report_progress("optimize", 96)
        optimizer.apply_pvlib_production(candidates, pvlib_results)
        results = optimizer.optimize(
            candidates, num_panels, total_available=len(all_panels)
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
        pvlib_calc=pvlib_calc,
        mounting_type=mounting_type,
        pvlib_results=pvlib_results,
        results=results,
    )


def _top_candidates(all_panels, num_panels: int):
    """Výběr TOP kandidátů pro pvlib — jen (N+1) nejvýkonnějších."""
    candidate_count = min(
        len(all_panels),
        max(num_panels + 1, int((num_panels + 1) * 1.2)),
    )
    sorted_all = sorted(
        all_panels, key=lambda p: p.annual_production_kwh, reverse=True,
    )
    return sorted_all[:candidate_count]
