"""
Serializace výsledků solar pipeline do finálního API response.

Obsahuje i roof_world_bounds helper, protože ten je čistě prezentační
(pro správné měřítko vizualizace ve frontendu).
"""
from __future__ import annotations

from typing import Optional


def roof_world_bounds(geometry) -> dict:
    """Světový bounding box střechy v XY rovině (pro FE vizualizaci)."""
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
            "min_x": 0, "max_x": 0, "min_y": 0, "max_y": 0,
            "width_m": 0, "depth_m": 0,
        }


def build_response(
    *,
    roofs,
    model_info: dict,
    location_info: dict,
    optimal,
    panel_width: float,
    panel_height: float,
    panel_spacing: float,
    pv_efficiency: float,
    pv_sim,
    mounting_type: str,
    engine_label_parts: list,
    pv_engine: str,
    ep_results: Optional[dict],
    pvlib_results: Optional[dict],
    results: dict,
) -> dict:
    """Sestaví finální JSON response pro frontend."""
    roof_summary = [
        {
            "identifier": r.identifier,
            "area_m2": r.area,
            "tilt": r.tilt,
            "azimuth": r.azimuth,
            "orientation": r.orientation,
            "center": list(r.center),
            "source": r.source,
            "world_bounds": roof_world_bounds(r.geometry),
        }
        for r in roofs
    ]

    # Logický počet střech = unikátní parent rooms.
    # Sedlová střecha = 2 plochy, ale 1 "střecha".
    logical_roof_count = len({r.parent_id for r in roofs})

    engine_totals: dict = {}
    if ep_results is not None:
        engine_totals["energyplus_kwh"] = ep_results["annual_production_kwh"]
    if pvlib_results is not None:
        engine_totals["pvlib_kwh"] = pvlib_results["annual_production_kwh"]

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
            "cardinal_direction": optimal.cardinal_direction,
        },
        "roofs": roof_summary,
        "panel_config": {
            "panel_width_m": panel_width,
            "panel_height_m": panel_height,
            "panel_area_m2": round(panel_width * panel_height, 2),
            "spacing_m": panel_spacing,
            "pv_efficiency": pv_efficiency,
            "active_area_fraction": pv_sim.active_area_fraction,
            "panel_age_years": 0,
            "system_losses": pv_sim.get_loss_breakdown(),
            "module_type": pv_sim.module_type,
            "mounting_type": mounting_type,
        },
        "simulation_engine": "+".join(engine_label_parts),
        "pv_engine": pv_engine,
        "engine_totals": engine_totals,
        "optimization": results,
    }