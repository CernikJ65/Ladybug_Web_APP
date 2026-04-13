"""
Post-processing HBJSON dict po exportu z Honeybee Model.

Opravuje dva problémy v exportovaném modelu:
  1. Otočené normály střech/podlah (RoofCeiling dolů, Floor nahoru)
  2. Konkávní polygony s >4 body → triangulace přes Face3D.triangulated_mesh3d

Pracuje přímo na dict (ne na Honeybee objektech), aby se
zachovaly všechny metadata z exportu.

Soubor: ladybug_be/app/services/converter/hbjson_postprocessor.py
"""

import logging

from ladybug_geometry.geometry3d.pointvector import Point3D
from ladybug_geometry.geometry3d.face import Face3D

logger = logging.getLogger(__name__)


class HbjsonPostprocessor:
    """Opravuje normály a trianguluje složité plochy v HBJSON dict."""

    def __init__(self, model_dict: dict):
        self.model_dict = model_dict
        self.fixed_normals = 0
        self.triangulated = 0

    def process(self) -> dict:
        """
        Spustí post-processing. Vrací upravený model_dict.

        Opravy:
          - RoofCeiling s normálou dolů (nz < 0) → otočí boundary
          - Floor s normálou nahoru (nz > 0) → otočí boundary
          - Plochy s >4 body → triangulace přes Mesh3D
        """
        for room_dict in self.model_dict.get("rooms", []):
            new_faces = []
            for face_dict in room_dict.get("faces", []):
                processed = self._process_face(face_dict)
                new_faces.extend(processed)
            room_dict["faces"] = new_faces

        if self.fixed_normals > 0:
            logger.info("Opraveno normál: %d", self.fixed_normals)
        if self.triangulated > 0:
            logger.info(
                "Triangulováno: %d trojúhelníků", self.triangulated,
            )
        return self.model_dict

    # ── interní ──────────────────────────────────────────

    def _process_face(self, face_dict: dict) -> list[dict]:
        """Zpracuje jednu face — opraví normálu, případně trianguluj."""
        ft = face_dict.get("face_type")
        b = face_dict.get("geometry", {}).get("boundary", [])

        if len(b) < 3:
            return [face_dict]

        # Oprav otočené normály
        self._fix_normal(face_dict, ft, b)

        # Trianguluj plochy s >4 body
        if len(b) > 4:
            triangles = self._triangulate(face_dict, b)
            if triangles:
                return triangles

        return [face_dict]

    def _fix_normal(self, face_dict: dict, ft: str, b: list) -> None:
        """Opraví normálu pokud směřuje špatným směrem."""
        v1 = [b[1][i] - b[0][i] for i in range(3)]
        v2 = [b[2][i] - b[0][i] for i in range(3)]
        nz = v1[0] * v2[1] - v1[1] * v2[0]

        if ft == "RoofCeiling" and nz < 0:
            face_dict["geometry"]["boundary"] = list(reversed(b))
            self.fixed_normals += 1
        elif ft == "Floor" and nz > 0:
            face_dict["geometry"]["boundary"] = list(reversed(b))
            self.fixed_normals += 1

    def _triangulate(self, face_dict: dict, b: list) -> list[dict] | None:
        """Trianguluje plochu s >4 body přes Face3D.triangulated_mesh3d."""
        try:
            pts = [Point3D(*p) for p in b]
            f3d = Face3D(pts)
            mesh = f3d.triangulated_mesh3d

            result = []
            ident = face_dict["identifier"]
            display = face_dict.get("display_name", "")

            for ti, tri_verts in enumerate(mesh.face_vertices):
                tri_boundary = [[v.x, v.y, v.z] for v in tri_verts]
                tri_face = dict(face_dict)
                tri_face["geometry"] = {
                    "type": "Face3D",
                    "boundary": tri_boundary,
                }
                tri_face["identifier"] = f"{ident}_{ti}"
                tri_face["display_name"] = f"{display}_{ti}"
                result.append(tri_face)
                self.triangulated += 1

            return result
        except Exception:
            return None

    @property
    def stats(self) -> dict:
        """Vrátí statistiky post-processingu."""
        return {
            "fixed_normals": self.fixed_normals,
            "triangulated_faces": self.triangulated,
        }