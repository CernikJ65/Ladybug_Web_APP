"""
Extrakce terénu z DXF vrstvy 'topography' → Honeybee Shade.

Terénní plochy (trojúhelníky z polyface mesh) se převedou
na Honeybee Shade objekty — kontextová geometrie ovlivňující
zastínění a odrazy v energetické simulaci.

Využívá ladybug_geometry:
  - Face3D(pts)                        → terénní plocha
  - Face3D.remove_duplicate_vertices() → deduplikace bodů
  - Face3D.check_planar()              → ověření planarity
  - Face3D.triangulated_mesh3d         → triangulace neplanárních
  - Face3D.area                        → filtrace příliš malých

Honeybee:
  - Shade(id, face)     → stínící / kontextová plocha
  - clean_string()      → ASCII-safe identifikátor

Soubor: ladybug_be/app/services/converter/dxf_terrain_extractor.py
"""

import logging

from ladybug_geometry.geometry3d.face import Face3D
from honeybee.shade import Shade
from honeybee.typing import clean_string

from .dxf_parser import parse_polyface_mesh

logger = logging.getLogger(__name__)

# Geometrická tolerance (m)
TOL = 0.01


class DxfTerrainExtractor:
    """Extrahuje terénní plochy z DXF → Honeybee Shade objekty."""

    def __init__(self, doc, msp, layer_name: str = "topography"):
        self.doc = doc
        self.msp = msp
        self.layer = layer_name.lower()

    def extract(self) -> list[Shade]:
        """Vrátí seznam Shade objektů z terénní vrstvy."""
        inserts = [
            e for e in self.msp
            if e.dxftype() == "INSERT"
            and e.dxf.layer.lower() == self.layer
        ]

        shades: list[Shade] = []
        idx = 0

        for ins in inserts:
            block = self.doc.blocks.get(ins.dxf.name)
            if not block:
                continue

            for entity in block:
                if entity.dxftype() != "POLYLINE":
                    continue
                if not (entity.dxf.get("flags", 0) & 0x40):
                    continue

                verts, face_indices = parse_polyface_mesh(entity)
                for fi in face_indices:
                    shade = self._face_to_shade(verts, fi, idx)
                    if shade:
                        shades.append(shade)
                        idx += 1

        logger.info("Terén: %d Shade objektů", len(shades))
        return shades

    # ── interní ──────────────────────────────────────────

    @staticmethod
    def _face_to_shade(
        verts: list, fi: list[int], idx: int,
    ) -> Shade | None:
        """Vytvoří Shade z jednoho face indexu."""
        pts = [verts[i] for i in fi if i < len(verts)]
        if len(pts) < 3:
            return None

        try:
            face = Face3D(pts)
            face = face.remove_duplicate_vertices(TOL)
            if face.area <= TOL:
                return None

            identifier = clean_string(f"Terrain_{idx:05d}")

            # Ověř planaritu — neplanární → trianguluj
            if not face.check_planar(TOL, raise_exception=False):
                mesh = face.triangulated_mesh3d
                face = Face3D(mesh.face_vertices[0])

            return Shade(identifier, face)

        except Exception:
            return None