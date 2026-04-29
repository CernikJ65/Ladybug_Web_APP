"""
Vytvori hbjson typickeho ceskeho rodinneho domu (modernizace 2010+).

Geometrie: 12 x 10 m pudorys, 1 podlazi, vyska 2.7 m, 4 mistnosti.
Konstrukce: CSN 73 0540-2 doporucene U-values.
Vzduch: n50 ~2 ACH50, ventilace 30 m3/h/os.

Spusti se z root projektu LADYBUG_APP:
    python tools/make_typicky_dum.py

Output: ladybug_be/app/services/heatpump_real/dum_typicky_cz.hbjson
"""
from __future__ import annotations

import json
import os

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


def build_construction_set() -> ConstructionSet:
    ext_render = EnergyMaterial(
        'CR_Ext_Render', 0.015, 0.87, 1800, 840, 'MediumRough',
        0.9, 0.5, 0.5,
    )
    eps_100 = EnergyMaterial(
        'EPS_100mm', 0.10, 0.034, 20, 1450, 'MediumSmooth',
        0.9, 0.5, 0.5,
    )
    porotherm_240 = EnergyMaterial(
        'Porotherm_240', 0.24, 0.36, 900, 900, 'MediumRough',
        0.9, 0.7, 0.7,
    )
    int_render = EnergyMaterial(
        'CR_Int_Render', 0.015, 0.7, 1600, 840, 'MediumSmooth',
        0.9, 0.5, 0.5,
    )
    ext_wall = OpaqueConstruction(
        'CR_Ext_Wall_U0.26',
        [ext_render, eps_100, porotherm_240, int_render],
    )

    roof_membrane = EnergyMaterial(
        'CR_Roof_Membrane', 0.005, 0.17, 1200, 1000, 'Smooth',
        0.9, 0.65, 0.65,
    )
    eps_200 = EnergyMaterial(
        'EPS_200mm', 0.20, 0.034, 20, 1450, 'MediumSmooth',
        0.9, 0.5, 0.5,
    )
    zb_deska_200 = EnergyMaterial(
        'ZB_Deska_200', 0.20, 1.58, 2400, 920, 'MediumRough',
        0.9, 0.7, 0.7,
    )
    roof = OpaqueConstruction(
        'CR_Roof_U0.16', [roof_membrane, eps_200, zb_deska_200],
    )

    zb_floor_150 = EnergyMaterial(
        'ZB_Floor_150', 0.15, 1.58, 2400, 920, 'MediumRough',
        0.9, 0.7, 0.7,
    )
    xps_100 = EnergyMaterial(
        'XPS_100mm', 0.10, 0.034, 35, 1450, 'MediumSmooth',
        0.9, 0.5, 0.5,
    )
    ground_floor = OpaqueConstruction(
        'CR_Ground_Floor_U0.31', [zb_floor_150, xps_100],
    )

    porotherm_150 = EnergyMaterial(
        'Porotherm_Int_150', 0.15, 0.36, 900, 900, 'MediumRough',
        0.9, 0.7, 0.7,
    )
    int_wall = OpaqueConstruction(
        'CR_Int_Wall', [int_render, porotherm_150, int_render],
    )
    int_floor = OpaqueConstruction(
        'CR_Int_Floor', [zb_deska_200],
    )

    win_mat = EnergyWindowMaterialSimpleGlazSys(
        'CR_Triple_Glass_U1.1_g0.55', 1.1, 0.55, 0.65,
    )
    window = WindowConstruction(
        'CR_Window_U1.1_g0.55', [win_mat],
    )

    cs = ConstructionSet('CR_Modern_2010Plus')
    cs.wall_set.exterior_construction = ext_wall
    cs.wall_set.interior_construction = int_wall
    cs.wall_set.ground_construction = ext_wall
    cs.floor_set.ground_construction = ground_floor
    cs.floor_set.interior_construction = int_floor
    cs.floor_set.exterior_construction = ground_floor
    cs.roof_ceiling_set.exterior_construction = roof
    cs.roof_ceiling_set.interior_construction = int_floor
    cs.roof_ceiling_set.ground_construction = roof
    cs.aperture_set.window_construction = window
    cs.aperture_set.skylight_construction = window
    cs.aperture_set.operable_construction = window
    cs.aperture_set.interior_construction = window
    return cs


def build_rooms(cs: ConstructionSet):
    rooms = [
        Room.from_box(
            'Obyvak_JZ', 6, 5, 2.7,
            origin=Point3D(0, 0, 0),
        ),
        Room.from_box(
            'Kuchyne_JV', 6, 5, 2.7,
            origin=Point3D(6, 0, 0),
        ),
        Room.from_box(
            'Loznice_SZ', 6, 5, 2.7,
            origin=Point3D(0, 5, 0),
        ),
        Room.from_box(
            'Koupelna_Chodba_SV', 6, 5, 2.7,
            origin=Point3D(6, 5, 0),
        ),
    ]
    rooms[0].display_name = 'Obyvak (jihozapad)'
    rooms[1].display_name = 'Kuchyne s jidelnou (jihovychod)'
    rooms[2].display_name = 'Loznice (severozapad)'
    rooms[3].display_name = 'Koupelna a chodba (severovychod)'

    for r in rooms:
        r.properties.energy.construction_set = cs
    Room.solve_adjacency(rooms, 0.01)
    return rooms


def apply_apertures(rooms):
    wwr_by_normal = {
        (0, -1, 0): 0.35,
        (0, 1, 0): 0.10,
        (1, 0, 0): 0.20,
        (-1, 0, 0): 0.20,
    }
    for r in rooms:
        for face in r.faces:
            if face.type.name != 'Wall':
                continue
            if face.boundary_condition.name != 'Outdoors':
                continue
            n = face.normal
            key = (round(n.x), round(n.y), round(n.z))
            wwr = wwr_by_normal.get(key)
            if wwr:
                face.apertures_by_ratio(wwr, tolerance=0.01)


def apply_air_loads(rooms):
    infil = Infiltration(
        'CR_Modern_Infil_n50_2ACH', 0.0001,
    )
    vent = Ventilation(
        'CR_Residential_Vent_30m3h_per_person',
        flow_per_person=0.0083,
    )
    for r in rooms:
        r.properties.energy.infiltration = infil
        r.properties.energy.ventilation = vent


def main():
    cs = build_construction_set()
    rooms = build_rooms(cs)
    apply_apertures(rooms)
    apply_air_loads(rooms)

    model = Model('CR_Typicky_Dum_120m2', rooms)
    model.display_name = 'Typicky CR rodinny dum 120 m2 (2010+)'

    out_dir = os.path.join(
        'ladybug_be', 'app', 'services', 'heatpump_real',
    )
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'dum_typicky_cz.hbjson')

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(model.to_dict(), f, indent=2, ensure_ascii=False)

    total_area = sum(r.floor_area for r in rooms)
    print(f'Saved: {out_path}')
    print(f'Rooms: {len(rooms)}')
    print(f'Total floor area: {total_area:.1f} m2')
    for r in rooms:
        ap_area = sum(
            ap.area for face in r.faces
            for ap in (face.apertures or [])
        )
        print(
            f'  {r.identifier}: floor={r.floor_area:.1f} m2, '
            f'aperture_area={ap_area:.2f} m2'
        )


if __name__ == '__main__':
    main()
