"trida pro detekci strech z HBJSON modelu"
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from honeybee.model import Model
from honeybee.boundarycondition import Outdoors
from ladybug_geometry.geometry3d.face import Face3D
"kostanta slouzi prevodu k ciselne hodnot azimuth pro oznaceni"
COMPASS = [
    (337.5, 360, "North"), (0, 22.5, "North"),
    (22.5, 67.5, "North-East"), (67.5, 112.5, "East"),
    (112.5, 157.5, "South-East"), (157.5, 202.5, "South"),
    (202.5, 247.5, "South-West"), (247.5, 292.5, "West"),
    (292.5, 337.5, "North-West"),
]

"zde ulozi infroamce o strese co najde"
@dataclass
class RoofInfo:


    identifier: str
    geometry: Face3D
    area: float
    tilt: float
    azimuth: float
    center: tuple
    source: str = ""
    parent_id: str = ""

    @property
    def orientation(self) -> str:
        if self.tilt < 5:
            return "Horizontal"
        for lo, hi, name in COMPASS:
            if lo <= self.azimuth < hi:
                return name
        return "North"


@dataclass
class _RoofCandidate:
    """Mezistav před slučováním koplanárních sousedících ploch."""

    geometry: Face3D
    identifier: str
    source: str
    parent_id: str

"Detekje strechy z HBJSON a potom hleda vhodne plochy pro umisteni panelu"
"detekuje jestli ma hjbsoj atribut roof_ceiling a jestli se jedna o outdoor plochu"
class RoofDetector:


    def __init__(self, hbjson_path: str):
        self.model: Model = Model.from_hbjson(hbjson_path)

    def detect_roofs(
        self,
        max_tilt: float = 100.0,
        min_area: float = 5.0,
        min_height: float = 2.0,
    ) -> List[RoofInfo]:
        # 1) sebrat všechny kandidáty (room + shade), normalizovat orientaci normály
        candidates: List[_RoofCandidate] = []
        candidates.extend(self._collect_room_candidates(max_tilt))
        candidates.extend(self._collect_shade_candidates(max_tilt, min_height))

        # 2) sloučit sousedící koplanární plochy do jedné střechy
        merged = self._merge_coplanar_adjacent(candidates)

        # 3) finální min_area filtr a sestavení RoofInfo
        roofs: List[RoofInfo] = []
        for cand in merged:
            if cand.geometry.area < min_area:
                continue
            roofs.append(self._build_roof_info(cand))
        return roofs

    def get_context_geometry(self) -> List[Face3D]:
        context: List[Face3D] = []
        for room in self.model.rooms:
            for face in room.walls + room.floors:
                context.append(face.geometry)
        return context

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
    # Sběr kandidátů
    # ------------------------------------------------------------------

    def _collect_room_candidates(self, max_tilt: float) -> List[_RoofCandidate]:
        out: List[_RoofCandidate] = []
        for room in self.model.rooms:
            for face in room.roof_ceilings:
                # RoofCeiling s bc=Surface je mezipatrový strop, ne skutečná
                # střecha (nemá sun exposure).
                if not isinstance(face.boundary_condition, Outdoors):
                    continue
                geom = self._normalize(face.geometry, max_tilt)
                if geom is None:
                    continue
                out.append(_RoofCandidate(
                    geometry=geom,
                    identifier=face.identifier,
                    source="room",
                    parent_id=room.identifier,
                ))
        return out

    def _collect_shade_candidates(
        self, max_tilt: float, min_height: float
    ) -> List[_RoofCandidate]:
        if not hasattr(self.model, "orphaned_shades"):
            return []
        out: List[_RoofCandidate] = []
        for shade in self.model.orphaned_shades:
            geom: Face3D = shade.geometry
            if geom.center.z < min_height:
                continue
            normalized = self._normalize(geom, max_tilt)
            if normalized is None:
                continue
            out.append(_RoofCandidate(
                geometry=normalized,
                identifier=shade.identifier,
                source="shade",
                parent_id=shade.identifier,
            ))
        return out

    @staticmethod
    def _normalize(geom: Face3D, max_tilt: float) -> Optional[Face3D]:
        """Otočí plochu normálou nahoru a odřízne příliš strmé plochy."""
        if geom.tilt > math.pi / 2:
            geom = geom.flip()
        if math.degrees(geom.tilt) > max_tilt:
            return None
        return geom

    # ------------------------------------------------------------------
    # Slučování koplanárních sousedů
    # ------------------------------------------------------------------

    def _merge_coplanar_adjacent(
        self, candidates: List[_RoofCandidate]
    ) -> List[_RoofCandidate]:
        """Sousedící koplanární střešní plochy spojí do jedné.

        Dvě střechy, které leží ve stejné rovině a sdílejí hranu (např. ploché
        střechy nad sousedními místnostmi v patře), bývají v HBJSON modelu
        oddělené Face3D. Pro umístění panelů je ale chceme řešit jako jednu
        plochu — jinak se na hraně mezi nimi vynechá pruh kvůli edge_marginu
        a panely se rozházejí proti uživatelově očekávání.
        """
        if len(candidates) <= 1:
            return list(candidates)

        tol = self.model.tolerance
        ang_tol = self.model.angle_tolerance
        ang_tol_rad = math.radians(ang_tol) if ang_tol else math.radians(1.0)

        groups = self._group_by_coplanarity(candidates, tol, ang_tol_rad)

        # mapování Face3D -> kandidát (id() je stabilní v rámci běhu)
        by_id = {id(c.geometry): c for c in candidates}

        merged: List[_RoofCandidate] = []
        for group in groups:
            if len(group) == 1:
                merged.append(by_id[id(group[0])])
                continue

            group_members = [by_id[id(f)] for f in group]

            # join_coplanar_faces očekává *přesně* koplanární faces — všechny
            # ve skupině musí mít plane shodný s prvním. Přemodelujeme
            # zbývající plochy do shodné roviny, ať floating-point nesoulad
            # rovin nezpůsobí pád v Polygon2D.joined_intersected_boundary.
            base_plane = group[0].plane
            normalized_group: List[Face3D] = [group[0]]
            for f in group[1:]:
                pts3d = tuple(
                    base_plane.xy_to_xyz(base_plane.xyz_to_xy(p))
                    for p in f.boundary
                )
                normalized_group.append(Face3D(pts3d, plane=base_plane))

            # join_coplanar_faces spojí jen ty, co skutečně sdílejí hranu;
            # nepřekrývající se koplanární plochy zůstanou samostatné.
            try:
                joined = Face3D.join_coplanar_faces(normalized_group, tol)
            except Exception:
                # Při degenerované geometrii nesluč — radši nech původní.
                for c in group_members:
                    merged.append(c)
                continue

            # Pro každý výstupní polygon zjistíme, kteří původní členové
            # do něj patří — `joined` může vrátit víc samostatných polygonů,
            # pokud koplanární plochy nejsou všechny propojené (např. dvě
            # nesouvisející budovy se shodnou výškou střechy).
            for joined_face in joined:
                # Po sloučení zůstanou na bývalé sdílené hraně kolineární
                # vrcholy — odstraníme je, ať má polygon čistý tvar pro
                # offset/inset v panel placeru.
                try:
                    joined_face = joined_face.remove_colinear_vertices(tol)
                except Exception:
                    pass

                joined_poly_2d = joined_face.boundary_polygon2d
                joined_plane = joined_face.plane
                contained: List[_RoofCandidate] = []
                for member in group_members:
                    cx_3d = member.geometry.center
                    cx_2d = joined_plane.xyz_to_xy(cx_3d)
                    if joined_poly_2d.is_point_inside_check(cx_2d):
                        contained.append(member)

                if not contained:
                    # Floating-point fallback: připoj k nejbližšímu členu.
                    cx = joined_face.center
                    contained = [min(
                        group_members,
                        key=lambda m: m.geometry.center.distance_to_point(cx),
                    )]

                if len(contained) == 1:
                    only = contained[0]
                    merged.append(_RoofCandidate(
                        geometry=joined_face,
                        identifier=only.identifier,
                        source=only.source,
                        parent_id=only.parent_id,
                    ))
                else:
                    ids = "+".join(c.identifier for c in contained)
                    parents = "+".join(sorted({c.parent_id for c in contained}))
                    sources = sorted({c.source for c in contained})
                    source = sources[0] if len(sources) == 1 else "merged"
                    merged.append(_RoofCandidate(
                        geometry=joined_face,
                        identifier=ids,
                        source=source,
                        parent_id=parents,
                    ))
        return merged

    @staticmethod
    def _group_by_coplanarity(
        candidates: List["_RoofCandidate"],
        tolerance: float,
        angle_tolerance: float,
    ) -> List[List[Face3D]]:
        """Skupiny Face3D, jejichž roviny jsou v rámci tolerance shodné.

        Náhrada za Face3D.group_by_coplanarity (v ladybug-geometry 1.34.19
        ještě neexistuje — projektový venv tu verzi používá).
        """
        groups: List[List[Face3D]] = []
        for cand in candidates:
            face = cand.geometry
            placed = False
            for grp in groups:
                if grp[0].plane.is_coplanar_tolerance(
                    face.plane, tolerance, angle_tolerance
                ):
                    grp.append(face)
                    placed = True
                    break
            if not placed:
                groups.append([face])
        return groups

    # ------------------------------------------------------------------
    # RoofInfo z kandidáta
    # ------------------------------------------------------------------

    @staticmethod
    def _build_roof_info(cand: _RoofCandidate) -> RoofInfo:
        geom = cand.geometry
        tilt = math.degrees(geom.tilt)
        azimuth = math.degrees(geom.azimuth)
        c = geom.center
        return RoofInfo(
            identifier=cand.identifier,
            geometry=geom,
            area=round(geom.area, 2),
            tilt=round(tilt, 2),
            azimuth=round(azimuth, 2),
            center=(round(c.x, 2), round(c.y, 2), round(c.z, 2)),
            source=cand.source,
            parent_id=cand.parent_id or cand.identifier,
        )
