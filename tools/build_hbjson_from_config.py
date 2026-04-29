"""
Cte kompaktni building config (atributy) a vyrobi plny hbjson pro EnergyPlus.

Spusti se:
    python tools/build_hbjson_from_config.py tools/buildings/dum_typicky_cz.json

Output: ladybug_be/app/services/heatpump_real/<config_name>.hbjson
"""
from __future__ import annotations

import json
import os
import sys

from ladybug_geometry.geometry3d.pointvector import Point3D
from honeybee.room import Room
from honeybee.model import Model

from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy.material.glazing import (
    EnergyWindowMaterialSimpleGlazSys,
)
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.construction.window import WindowConstruction
from honeybee_energy.constructionset import ConstructionSet
from honeybee_energy.load.infiltration import Infiltration
from honeybee_energy.load.ventilation import Ventilation


WWR_NORMAL_MAP = {
    (0, -1, 0): "south",
    (0, 1, 0): "north",
    (1, 0, 0): "east",
    (-1, 0, 0): "west",
}


def opaque_from_u(identifier: str, u_value: float) -> OpaqueConstruction:
    r_total = 1.0 / u_value - 0.17
    if r_total <= 0:
        raise ValueError(
            f"U={u_value} too high — Rsi+Rse already exceeds 1/U",
        )
    eps = EnergyMaterial(
        f"{identifier}_EPS",
        thickness=r_total * 0.034,
        conductivity=0.034,
        density=20,
        specific_heat=1450,
        roughness="MediumSmooth",
        thermal_absorptance=0.9,
        solar_absorptance=0.5,
        visible_absorptance=0.5,
    )
    return OpaqueConstruction(identifier, [eps])


def window_from_u_g(
    identifier: str, u_value: float, g_value: float, vt: float,
) -> WindowConstruction:
    mat = EnergyWindowMaterialSimpleGlazSys(
        f"{identifier}_Glass", u_value, g_value, vt,
    )
    return WindowConstruction(identifier, [mat])


def n50_to_m3s_per_ext_area(n50_ach: float) -> float:
    factor = n50_ach / 20.0
    return factor / 3600.0 * 1.0


def build_construction_set(env: dict) -> ConstructionSet:
    cs = ConstructionSet("Building_Custom_CS")
    cs.wall_set.exterior_construction = opaque_from_u(
        "Wall_Ext", env["wall_u_w_m2k"],
    )
    cs.wall_set.interior_construction = opaque_from_u(
        "Wall_Int", 1.5,
    )
    cs.wall_set.ground_construction = opaque_from_u(
        "Wall_Ground", env["wall_u_w_m2k"],
    )
    cs.floor_set.ground_construction = opaque_from_u(
        "Floor_Ground", env["floor_u_w_m2k"],
    )
    cs.floor_set.exterior_construction = opaque_from_u(
        "Floor_Ext", env["floor_u_w_m2k"],
    )
    cs.floor_set.interior_construction = opaque_from_u(
        "Floor_Int", 3.0,
    )
    cs.roof_ceiling_set.exterior_construction = opaque_from_u(
        "Roof", env["roof_u_w_m2k"],
    )
    cs.roof_ceiling_set.interior_construction = opaque_from_u(
        "Ceiling_Int", 3.0,
    )
    cs.roof_ceiling_set.ground_construction = opaque_from_u(
        "Roof_Ground", env["roof_u_w_m2k"],
    )
    win = window_from_u_g(
        "Window",
        env["window_u_w_m2k"],
        env["window_g_value"],
        env.get("window_vt", 0.65),
    )
    cs.aperture_set.window_construction = win
    cs.aperture_set.skylight_construction = win
    cs.aperture_set.operable_construction = win
    cs.aperture_set.interior_construction = win
    return cs


def build_rooms(geom: dict, cs: ConstructionSet):
    height = geom["height_m"]
    rooms = []
    for r in geom["rooms"]:
        x0, x1 = r["x"]
        y0, y1 = r["y"]
        room = Room.from_box(
            r["id"], x1 - x0, y1 - y0, height,
            origin=Point3D(x0, y0, 0),
        )
        room.display_name = r.get("display_name", r["id"])
        room.properties.energy.construction_set = cs
        rooms.append(room)
    Room.solve_adjacency(rooms, 0.01)
    return rooms


def apply_apertures(rooms, wwr: dict):
    for r in rooms:
        for face in r.faces:
            if face.type.name != "Wall":
                continue
            if face.boundary_condition.name != "Outdoors":
                continue
            n = face.normal
            key = (round(n.x), round(n.y), round(n.z))
            orient = WWR_NORMAL_MAP.get(key)
            if orient and wwr.get(orient, 0) > 0:
                face.apertures_by_ratio(wwr[orient], tolerance=0.01)


def apply_air_loads(rooms, air: dict):
    infil_flow = n50_to_m3s_per_ext_area(air["infiltration_n50_ach"])
    infil = Infiltration(
        f"Infil_n50_{air['infiltration_n50_ach']}ACH", infil_flow,
    )
    vent = Ventilation(
        f"Vent_{air['ventilation_m3h_per_person']}m3h_per_person",
        flow_per_person=air["ventilation_m3h_per_person"] / 3600.0,
    )
    for r in rooms:
        r.properties.energy.infiltration = infil
        r.properties.energy.ventilation = vent


def main():
    if len(sys.argv) < 2:
        print("Usage: python build_hbjson_from_config.py <config.json>")
        sys.exit(1)
    config_path = sys.argv[1]

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    cs = build_construction_set(cfg["envelope"])
    rooms = build_rooms(cfg["geometry"], cs)
    apply_apertures(rooms, cfg["wwr_per_orientation"])
    apply_air_loads(rooms, cfg["air"])

    model = Model(cfg["name"], rooms)
    model.display_name = cfg.get("display_name", cfg["name"])
    if cfg["geometry"].get("north_angle_deg", 0):
        model.angle = cfg["geometry"]["north_angle_deg"]

    out_dir = os.path.join(
        "ladybug_be", "app", "services", "heatpump_real",
    )
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(config_path))[0]
    out_path = os.path.join(out_dir, f"{base}.hbjson")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(model.to_dict(), f, indent=2, ensure_ascii=False)

    total_area = sum(r.floor_area for r in rooms)
    print(f"Saved: {out_path}")
    print(f"Rooms: {len(rooms)}, total floor area: {total_area:.1f} m2")
    for r in rooms:
        ap = sum(
            a.area for face in r.faces for a in (face.apertures or [])
        )
        print(
            f"  {r.identifier}: floor={r.floor_area:.1f} m2, "
            f"ap={ap:.2f} m2"
        )


if __name__ == "__main__":
    main()
