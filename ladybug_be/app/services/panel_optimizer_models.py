"prepravak mezu be a fe"
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from .panel_placer import PanelPosition


@dataclass
class PanelResult:
    """Serializovatelný výsledek jednoho panelu."""

    id: int
    roof_id: str
    center: List[float]
    area_m2: float
    tilt: float
    azimuth: float
    radiation_kwh_m2: float
    annual_production_kwh: float
    capacity_kwp: float
    # Volitelné per-engine hodnoty — vyplní se jen když běží daný engine
    production_ep_kwh: Optional[float] = None
    production_pvlib_kwh: Optional[float] = None
    # EP implicit POA (unshaded, z EPW) — pro porovnání s Radiance (shaded)
    ep_solar_potential_kwh_m2: Optional[float] = None


@dataclass
class OptimizationResult:
    """Souhrnný výsledek pro zvolený počet panelů."""

    num_panels: int
    total_production_kwh: float
    total_capacity_kwp: float
    total_area_m2: float
    avg_radiation_kwh_m2: float
    panels: List[PanelResult]


def panel_position_to_result(
    p: PanelPosition, pv_efficiency: float
) -> PanelResult:
    """PanelPosition → PanelResult (vč. volitelných per-engine hodnot)."""
    return PanelResult(
        id=p.id,
        roof_id=p.roof_id,
        center=[
            round(p.center_3d.x, 1),
            round(p.center_3d.y, 1),
            round(p.center_3d.z, 1),
        ],
        area_m2=p.area,
        tilt=p.tilt,
        azimuth=p.azimuth,
        radiation_kwh_m2=p.radiation_kwh_m2,
        annual_production_kwh=p.annual_production_kwh,
        capacity_kwp=round(p.area * pv_efficiency, 3),
        production_ep_kwh=(
            round(p.production_ep_kwh, 2)
            if p.production_ep_kwh is not None else None
        ),
        production_pvlib_kwh=(
            round(p.production_pvlib_kwh, 2)
            if p.production_pvlib_kwh is not None else None
        ),
        ep_solar_potential_kwh_m2=(
            round(p.ep_solar_potential_kwh_m2, 2)
            if p.ep_solar_potential_kwh_m2 is not None else None
        ),
    )


def result_to_dict(v: OptimizationResult) -> Dict[str, Any]:
    """OptimizationResult → JSON-ready dict pro API response."""
    return {
        "num_panels": v.num_panels,
        "total_production_kwh": v.total_production_kwh,
        "total_capacity_kwp": v.total_capacity_kwp,
        "total_area_m2": v.total_area_m2,
        "avg_radiation_kwh_m2": v.avg_radiation_kwh_m2,
        "panels": [_panel_result_to_dict(p) for p in v.panels],
    }


def _panel_result_to_dict(p: PanelResult) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": p.id,
        "roof_id": p.roof_id,
        "center": p.center,
        "area_m2": p.area_m2,
        "tilt": p.tilt,
        "azimuth": p.azimuth,
        "radiation_kwh_m2": p.radiation_kwh_m2,
        "annual_production_kwh": p.annual_production_kwh,
        "capacity_kwp": p.capacity_kwp,
    }
    if p.production_ep_kwh is not None:
        out["production_ep_kwh"] = p.production_ep_kwh
    if p.production_pvlib_kwh is not None:
        out["production_pvlib_kwh"] = p.production_pvlib_kwh
    if p.ep_solar_potential_kwh_m2 is not None:
        out["ep_solar_potential_kwh_m2"] = p.ep_solar_potential_kwh_m2
    return out
