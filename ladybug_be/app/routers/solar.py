"""
Solar analysis router – endpoint pro optimalizaci FV panelů.

Optimalizovaná pipeline:
  1. HBJSON → detekce střech
  2. EPW → SkyMatrix → RadiationDome → optimální sklon
  3. Umístění VŠECH možných panelů
  4. RadiationStudy → radiace pro VŠECHNY panely (rychlé, jen senzory)
  5. Seřazení podle radiace → vyber jen TOP kandidáty pro varianty
  6. EnergyPlus PV simulace jen na TOP kandidátech (velké urychlení)
  7. Optimalizace → top N + alternativy

Klíčové urychlení: EnergyPlus dostane jen (num_panels + 1) panelů,
ne všechny stovky možných pozic.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from typing import Optional
import tempfile
import os

from ..services.progress import progress_scope, registry, report_progress

router = APIRouter()


def _roof_world_bounds(geometry) -> dict:
    """
    Vrátí světový bounding box střechy v XY rovině.
    Používá nativní Face3D.min / Face3D.max (Point3D) z ladybug_geometry.
    Používá se ve frontendu pro správné měřítko vizualizace panelů.
    """
    try:
        mn, mx = geometry.min, geometry.max
        return {
            "min_x": round(mn.x, 3),
            "max_x": round(mx.x, 3),
            "min_y": round(mn.y, 3),
            "max_y": round(mx.y, 3),
            "width_m": round(mx.x - mn.x, 3),
            "depth_m": round(mx.y - mn.y, 3),
        }
    except Exception:
        return {
            "min_x": 0, "max_x": 0,
            "min_y": 0, "max_y": 0,
            "width_m": 0, "depth_m": 0,
        }


@router.post("/optimize-panels")
async def optimize_panels(
    hbjson_file: UploadFile = File(...),
    epw_file: UploadFile = File(...),
    num_panels: int = Form(10),
    pv_efficiency: float = Form(0.20),
    system_losses: float = Form(0.14),
    panel_width: float = Form(1.0),
    panel_height: float = Form(1.7),
    panel_spacing: float = Form(0.3),
    max_tilt: float = Form(60.0),
    module_type: str = Form("Standard"),
    mounting_type: str = Form("FixedOpenRack"),
    job_id: Optional[str] = Form(None),
):
    """Optimalizuje rozmístění FV panelů na střechách."""
    if not hbjson_file.filename.endswith((".hbjson", ".json")):
        raise HTTPException(400, "HBJSON: přípona .hbjson nebo .json")
    if not epw_file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory")
    if num_panels < 1:
        raise HTTPException(400, "Počet panelů musí být alespoň 1")

    # Registruj job hned, ať první polling z FE nedostane 404 (FE
    # začíná pollovat ihned po odeslání POST, ale progress_scope se
    # vytváří až uvnitř threadpoolu po načtení souborů).
    if job_id:
        registry.create(job_id)

    hbjson_path = _save_temp(await hbjson_file.read(), ".hbjson")
    epw_path = _save_temp(await epw_file.read(), ".epw")

    try:
        # Celá pipeline je CPU-bound a synchronní → pustit ji v threadpoolu,
        # aby FastAPI event loop mohl mezitím obsluhovat polling progressu.
        return await run_in_threadpool(
            _run_solar_pipeline,
            hbjson_path,
            epw_path,
            num_panels,
            pv_efficiency,
            system_losses,
            panel_width,
            panel_height,
            panel_spacing,
            max_tilt,
            module_type,
            mounting_type,
            job_id,
        )
    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba: {str(e)}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _run_solar_pipeline(
    hbjson_path: str,
    epw_path: str,
    num_panels: int,
    pv_efficiency: float,
    system_losses: float,
    panel_width: float,
    panel_height: float,
    panel_spacing: float,
    max_tilt: float,
    module_type: str,
    mounting_type: str,
    job_id: Optional[str],
) -> dict:
    """Synchronní část — pouští se v threadpoolu, aby neblokovala event loop."""
    from ..services.roof_detector import RoofDetector
    from ..services.panel_placer import PanelPlacer
    from ..services.solar_calculator import SolarRadiationCalculator
    from ..services.panel_optimizer import PanelOptimizer
    from ..services.tilt_optimizer import TiltOptimizer
    from ..services.pv_simulator import PVSimulator

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

        # 4. RadiationStudy → radiace pro VŠECHNY panely
        report_progress("radiation", 32)
        radiation_values = calc.calculate_panel_radiation(all_panels, context)

        # 5. Přiřaď radiaci a seřaď
        report_progress("ranking", 38)
        optimizer = PanelOptimizer(pv_efficiency, system_losses)
        optimizer.assign_radiation(all_panels, radiation_values)

        # 6. Vyber TOP kandidáty pro EnergyPlus
        ep_candidate_count = min(
            len(all_panels),
            max(num_panels + 1, int((num_panels + 1) * 1.2)),
        )
        sorted_all = sorted(
            all_panels,
            key=lambda p: p.annual_production_kwh,
            reverse=True,
        )
        ep_candidates = sorted_all[:ep_candidate_count]

        # 7. EnergyPlus jen na kandidátech — nejdelší krok, tween 40 → 92
        pv_sim = PVSimulator(
            epw_path=epw_path,
            rated_efficiency=pv_efficiency,
            module_type=module_type,
            mounting_type=mounting_type,
        )
        pv_sim.assign_pv_properties(ep_candidates)
        report_progress("energyplus", 40)

        # Progress je teď vázaný na skutečný stdout EnergyPlus — každý
        # dokončený měsíc posune procenta. 40 → 92 = 52 bodů rozložených
        # přes ~13 event-lajn.
        def _ep_progress(fraction: float) -> None:
            report_progress("energyplus", 40 + fraction * 52)

        ep_results = pv_sim.simulate(
            ep_candidates, detector.model, on_progress=_ep_progress,
        )

        # 8. Optimalizace
        report_progress("optimize", 96)
        optimizer.apply_energyplus_production(ep_candidates, ep_results)
        results = optimizer.optimize(
            ep_candidates, num_panels, total_available=len(all_panels)
        )

    # Souhrn střech — včetně world_bounds pro správnou vizualizaci
    roof_summary = [
        {
            "identifier": r.identifier,
            "area_m2": r.area,
            "tilt": r.tilt,
            "azimuth": r.azimuth,
            "orientation": r.orientation,
            "center": list(r.center),
            "source": r.source,
            "world_bounds": _roof_world_bounds(r.geometry),
        }
        for r in roofs
    ]

    # Logický počet střech = unikátní parent rooms (případně samostatné shady).
    # Sedlová střecha = 2 plochy (východ + západ) ale 1 "střecha".
    logical_roof_count = len({r.parent_id for r in roofs})

    return {
        "model_info": {
            **model_info,
            "total_roof_area_m2": round(sum(r.area for r in roofs), 2),
            "roof_count": logical_roof_count,
            "roof_surface_count": len(roofs),
        },
        "location": location_info,
        "optimal_orientation": {
            "tilt_degrees": optimal.tilt_degrees,
            "azimuth_degrees": optimal.azimuth_degrees,
            "max_radiation_kwh_m2": optimal.max_radiation_kwh_m2,
            "source": optimal.source,
        },
        "roofs": roof_summary,
        "panel_config": {
            "panel_width_m": panel_width,
            "panel_height_m": panel_height,
            "panel_area_m2": round(panel_width * panel_height, 2),
            "spacing_m": panel_spacing,
            "pv_efficiency": pv_efficiency,
            "system_losses": pv_sim.get_loss_breakdown(),
            "module_type": module_type,
            "mounting_type": mounting_type,
        },
        "simulation_engine": ep_results.get("simulation_engine", ""),
        "optimization": results,
    }


def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)