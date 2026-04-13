"""
Extrakce budov z DXF vrstvy 'buildings' → Honeybee Room.

3-krokový přístup: solid → polygon → bbox (vždy uspěje).
Vrací diagnostiku pro každou budovu (název + metoda/důvod selhání).

Soubor: ladybug_be/app/services/converter/dxf_building_extractor.py
"""

import logging
from ladybug_geometry.geometry3d.pointvector import Point3D, Vector3D
from ladybug_geometry.geometry3d.plane import Plane
from ladybug_geometry.geometry3d.face import Face3D
from ladybug_geometry.geometry3d.polyface import Polyface3D
from honeybee.room import Room
from honeybee.typing import clean_string
from .dxf_parser import parse_polyface_mesh, extract_mesh_boundary

logger = logging.getLogger(__name__)
TOL = 0.01
ANGLE_TOL = 0.0174533


class DxfBuildingExtractor:
    """Extrahuje budovy z DXF dokumentu → Honeybee Rooms."""

    def __init__(self, doc, msp, layer_name: str = "buildings"):
        self.doc = doc
        self.msp = msp
        self.layer = layer_name.lower()

    def extract(self) -> tuple[list[Room], dict]:
        """Vrátí (rooms, stats). Stats obsahuje i 'details' per budova."""
        inserts = [
            e for e in self.msp
            if e.dxftype() == "INSERT"
            and e.dxf.layer.lower() == self.layer
        ]
        rooms: list[Room] = []
        stats = {
            "solid": 0, "polygon": 0, "bbox": 0,
            "outline_skip": 0, "error": 0,
            "details": [],
        }
        for ins in inserts:
            name = ins.dxf.name
            block = self.doc.blocks.get(name)
            if not block:
                stats["details"].append({"name": name, "status": "no_block"})
                stats["error"] += 1
                continue
            meshes, has_outline = self._read_meshes(block)
            if not meshes:
                status = "outline_only" if has_outline else "no_geometry"
                stats["details"].append({"name": name, "status": status})
                if has_outline:
                    stats["outline_skip"] += 1
                else:
                    stats["error"] += 1
                continue
            all_zs = [v.z for verts, _ in meshes for v in verts]
            height = max(all_zs) - min(all_zs)
            if height < 0.5:
                stats["details"].append({"name": name, "status": "flat"})
                stats["error"] += 1
                continue
            room, method = self._build(name, meshes)
            if room:
                rooms.append(room)
                stats[method] += 1
                stats["details"].append({"name": name, "status": method})
            else:
                stats["error"] += 1
                stats["details"].append({"name": name, "status": "all_failed"})
        logger.info(
            "Budovy: %d solid, %d polygon, %d bbox, %d skip, %d err",
            stats["solid"], stats["polygon"], stats["bbox"],
            stats["outline_skip"], stats["error"],
        )
        return rooms, stats

    @staticmethod
    def _read_meshes(block):
        meshes, has_outline = [], False
        for entity in block:
            etype = entity.dxftype()
            if etype == "POLYLINE":
                flags = entity.dxf.get("flags", 0)
                if flags & 0x40:
                    verts, faces = parse_polyface_mesh(entity)
                    if verts and faces:
                        meshes.append((verts, faces))
                elif flags & 0x8:
                    has_outline = True
            elif etype == "3DFACE":
                try:
                    pts = [Point3D(entity.dxf.get(f"vtx{i}").x,
                                   entity.dxf.get(f"vtx{i}").y,
                                   entity.dxf.get(f"vtx{i}").z)
                           for i in range(4)]
                    seen, unique = set(), []
                    for p in pts:
                        k = (round(p.x, 2), round(p.y, 2), round(p.z, 2))
                        if k not in seen:
                            seen.add(k); unique.append(p)
                    if len(unique) >= 3:
                        meshes.append((unique, [list(range(len(unique)))]))
                except Exception:
                    pass
        return meshes, has_outline

    def _build(self, name, meshes):
        ident = clean_string(name)
        all_zs = [v.z for verts, _ in meshes for v in verts]
        floor_z, height = min(all_zs), max(all_zs) - min(all_zs)

        room = self._try_solid(ident, meshes)
        if room:
            return room, "solid"
        room = self._try_polygon(ident, meshes, floor_z, height)
        if room:
            return room, "polygon"
        room = self._try_bbox(ident, meshes, floor_z, height)
        if room:
            return room, "bbox"
        return None, "error"

    @staticmethod
    def _try_solid(ident, meshes):
        faces = []
        for verts, fi_list in meshes:
            for fi in fi_list:
                pts = [verts[i] for i in fi if i < len(verts)]
                if len(pts) < 3:
                    continue
                try:
                    f = Face3D(pts).remove_duplicate_vertices(TOL)
                    if f.area > TOL:
                        faces.append(f)
                except Exception:
                    pass
        if len(faces) < 4:
            return None
        try:
            pf = Polyface3D.from_faces(faces, TOL)
            if not pf.is_solid:
                pf = pf.merge_overlapping_edges(TOL, ANGLE_TOL)
            if pf.is_solid:
                return Room.from_polyface3d(ident, pf)
        except Exception:
            pass
        return None

    @staticmethod
    def _try_polygon(ident, meshes, floor_z, height):
        flat = []
        for verts, faces in meshes:
            if not verts:
                continue
            zs = [v.z for v in verts]
            if max(zs) - min(zs) < 0.3:
                flat.append((sum(zs) / len(zs), verts, faces))
        flat.sort(key=lambda x: x[0], reverse=True)
        for _, verts, faces in flat:
            boundary = extract_mesh_boundary(verts, faces)
            if not boundary or len(boundary) < 3:
                continue
            try:
                pts = [Point3D(p.x, p.y, floor_z) for p in boundary]
                ff = Face3D(pts).remove_colinear_vertices(TOL)
                if ff.normal.z < 0:
                    ff = ff.flip()
                if ff.area < 1.0:
                    continue
                pf = Polyface3D.from_offset_face(ff, height)
                return Room.from_polyface3d(ident, pf)
            except Exception:
                continue
        return None

    @staticmethod
    def _try_bbox(ident, meshes, floor_z, height):
        """Bbox — vždy uspěje pokud jsou body."""
        try:
            pts = [v for verts, _ in meshes for v in verts]
            if not pts:
                return None
            xs = [p.x for p in pts]
            ys = [p.y for p in pts]
            w = max(xs) - min(xs)
            d = max(ys) - min(ys)
            w = max(w, 0.5)
            d = max(d, 0.5)
            origin = Point3D(min(xs), min(ys), floor_z)
            plane = Plane(Vector3D(0, 0, 1), origin)
            pf = Polyface3D.from_box(w, d, height, plane)
            return Room.from_polyface3d(ident, pf)
        except Exception:
            return None