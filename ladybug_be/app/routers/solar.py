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
import tempfile
import os

router = APIRouter()


def _roof_world_bounds(geometry) -> dict:
    """
    Vrátí světový bounding box střechy v XY rovině.
    Používá se ve frontendu pro správné měřítko vizualizace panelů.
    """
    try:
        verts = geometry.vertices  # List[Point3D]
        xs = [v.x for v in verts]
        ys = [v.y for v in verts]
        return {
            "min_x": round(min(xs), 3),
            "max_x": round(max(xs), 3),
            "min_y": round(min(ys), 3),
            "max_y": round(max(ys), 3),
            "width_m": round(max(xs) - min(xs), 3),
            "depth_m": round(max(ys) - min(ys), 3),
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
):
    """Optimalizuje rozmístění FV panelů na střechách."""
    if not hbjson_file.filename.endswith((".hbjson", ".json")):
        raise HTTPException(400, "HBJSON: přípona .hbjson nebo .json")
    if not epw_file.filename.endswith(".epw"):
        raise HTTPException(400, "Pouze EPW soubory")
    if num_panels < 1:
        raise HTTPException(400, "Počet panelů musí být alespoň 1")

    hbjson_path = _save_temp(await hbjson_file.read(), ".hbjson")
    epw_path = _save_temp(await epw_file.read(), ".epw")

    try:
        from ..services.roof_detector import RoofDetector
        from ..services.panel_placer import PanelPlacer
        from ..services.solar_calculator import SolarRadiationCalculator
        from ..services.panel_optimizer import PanelOptimizer
        from ..services.tilt_optimizer import TiltOptimizer
        from ..services.pv_simulator import PVSimulator

        # 1. Detekce střech
        detector = RoofDetector(hbjson_path)
        roofs = detector.detect_roofs(max_tilt=max_tilt)
        if not roofs:
            raise HTTPException(400, "Žádné střechy nenalezeny.")
        model_info = detector.get_model_info()
        context = detector.get_context_geometry()

        # 2. Klimatická data + optimální sklon
        calc = SolarRadiationCalculator(epw_path)
        calc.load_and_prepare()
        location_info = calc.get_location_info()
        latitude = location_info.get("latitude", 50.0)

        tilt_opt = TiltOptimizer(calc.sky_matrix, calc.location)
        optimal = tilt_opt.find_optimal_orientation()

        # 3. Umístění panelů
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
        radiation_values = calc.calculate_panel_radiation(all_panels, context)

        # 5. Přiřaď radiaci a seřaď
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

        # 7. EnergyPlus jen na kandidátech
        pv_sim = PVSimulator(
            epw_path=epw_path,
            rated_efficiency=pv_efficiency,
            module_type=module_type,
            mounting_type=mounting_type,
        )
        pv_sim.assign_pv_properties(ep_candidates)
        ep_results = pv_sim.simulate(ep_candidates, detector.model)

        # 8. Optimalizace
        optimizer.apply_energyplus_production(ep_candidates, ep_results)
        results = optimizer.optimize(ep_candidates, num_panels)

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

        return {
            "model_info": {
                **model_info,
                "total_roof_area_m2": round(sum(r.area for r in roofs), 2),
                "roof_count": len(roofs),
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

    except ImportError as e:
        raise HTTPException(500, f"Chybí knihovny: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Chyba: {str(e)}")
    finally:
        _cleanup(hbjson_path, epw_path)


def _save_temp(content: bytes, suffix: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        return tmp.name


def _cleanup(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            os.unlink(p)