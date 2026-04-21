"""
Detekce střešních ploch z HBJSON modelu.

Podporuje dva zdroje střech:
  1. Room faces s typem RoofCeiling (honeybee rooms)
  2. Orphaned shades – horizontální plochy ve výšce

Orientace se čte z nativních vlastností Face3D:
  - `Face3D.tilt` — úhel od svislice v radiánech (0 = nahoru, π = dolů)
  - `Face3D.azimuth` — radiány, 0 = +Y, clockwise

Plocha s tilt > π/2 směřuje dolů → flip a znovu přečíst tilt.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from honeybee.model import Model
from ladybug_geometry.geometry3d.face import Face3D

COMPASS = [
    (337.5, 360, "North"), (0, 22.5, "North"),
    (22.5, 67.5, "North-East"), (67.5, 112.5, "East"),
    (112.5, 157.5, "South-East"), (157.5, 202.5, "South"),
    (202.5, 247.5, "South-West"), (247.5, 292.5, "West"),
    (292.5, 337.5, "North-West"),
]


@dataclass
class RoofInfo:
    """Jedna střešní plocha připravená pro umístění panelů."""

    identifier: str
    geometry: Face3D
    area: float
    tilt: float
    azimuth: float
    center: tuple
    source: str = ""
    parent_id: str = ""  # room.identifier (rooms) / shade.identifier (shades)

    @property
    def orientation(self) -> str:
        if self.tilt < 5:
            return "Horizontal"
        for lo, hi, name in COMPASS:
            if lo <= self.azimuth < hi:
                return name
        return "North"


class RoofDetector:
    """Detekuje střechy z HBJSON modelu."""

    def __init__(self, hbjson_path: str):
        self.model: Model = Model.from_hbjson(hbjson_path)

    def detect_roofs(
        self,
        max_tilt: float = 60.0,
        min_area: float = 5.0,
        min_height: float = 2.0,
    ) -> List[RoofInfo]:
        roofs: List[RoofInfo] = []
        roofs.extend(self._from_rooms(max_tilt, min_area))
        roofs.extend(self._from_shades(max_tilt, min_area, min_height))
        return roofs

    def get_context_geometry(self) -> List[Face3D]:
        walls: List[Face3D] = []
        for room in self.model.rooms:
            for face in room.faces:
                if str(face.type) != "RoofCeiling":
                    walls.append(face.geometry)
        return walls

    def get_model_info(self) -> Dict[str, Any]:
        name = self.model.display_name or self.model.identifier
        return {
            "model_name": name,
            "room_count": len(self.model.rooms),
            "shade_count": len(self.model.orphaned_shades)
            if hasattr(self.model, "orphaned_shades")
            else 0,
        }

    # ------------------------------------------------------------------

    def _from_rooms(self, max_tilt: float, min_area: float) -> List[RoofInfo]:
        roofs: List[RoofInfo] = []
        for room in self.model.rooms:
            for face in room.faces:
                if str(face.type) != "RoofCeiling":
                    continue
                # Jen venkovní plochy — RoofCeiling s bc=Surface je
                # mezipatrový strop, ne skutečná střecha (nemá sun exposure).
                if str(face.boundary_condition) != "Outdoors":
                    continue
                roof = self._validate_roof(
                    face.geometry, face.identifier,
                    max_tilt, min_area, "room",
                    parent_id=room.identifier,
                )
                if roof:
                    roofs.append(roof)
        return roofs

    def _from_shades(
        self, max_tilt: float, min_area: float, min_height: float
    ) -> List[RoofInfo]:
        if not hasattr(self.model, "orphaned_shades"):
            return []
        roofs: List[RoofInfo] = []
        for shade in self.model.orphaned_shades:
            geom: Face3D = shade.geometry
            if geom.center.z < min_height:
                continue
            roof = self._validate_roof(
                geom, shade.identifier,
                max_tilt, min_area, "shade",
                parent_id=shade.identifier,
            )
            if roof:
                roofs.append(roof)
        return roofs

    @staticmethod
    def _validate_roof(
        geom: Face3D,
        identifier: str,
        max_tilt: float,
        min_area: float,
        source: str,
        parent_id: str = "",
    ) -> Optional[RoofInfo]:
        """
        Validuje plochu jako střechu pomocí nativních Face3D vlastností.

        `Face3D.tilt` vrací úhel normály od svislice v radiánech:
          - 0      = dokonale horizontální (plochá střecha)
          - π/2    = vertikální stěna
          - > π/2  = plocha směřuje dolů (flip a znovu)

        Tilt > max_tilt → vyloučeno (není vhodné pro panely).
        """
        # Normála směřuje dolů → otočíme plochu
        if geom.tilt > math.pi / 2:
            geom = geom.flip()

        tilt = math.degrees(geom.tilt)
        if tilt > max_tilt:
            return None

        area = geom.area
        if area < min_area:
            return None

        azimuth = math.degrees(geom.azimuth)
        c = geom.center
        return RoofInfo(
            identifier=identifier,
            geometry=geom,
            area=round(area, 2),
            tilt=round(tilt, 2),
            azimuth=round(azimuth, 2),
            center=(round(c.x, 2), round(c.y, 2), round(c.z, 2)),
            source=source,
            parent_id=parent_id or identifier,
        )