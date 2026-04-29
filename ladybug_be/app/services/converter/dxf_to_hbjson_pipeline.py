"""
DXF → HBJSON pipeline orchestrátor.

Účelem této pipeline je čistě geometrický převod (DWG/)DXF → HBJSON
pro 3D vizualizaci v UI — výstup obsahuje pouze ladybug-native
geometrii a klasifikaci ploch (Wall / RoofCeiling / Floor / Shade,
Outdoors / Ground / Surface), bez energetických materiálů,
konstrukcí, programů či radiance modifikátorů.

Extension data se nevyloučí post-mortem mazáním z dictu, ale rovnou
přes oficiální API: Model.to_dict(included_prop=[]). Honeybee tak
do výstupu vůbec nezapíše energy/radiance properties.

Celá konverzní pipeline:
  1. (volitelně) DWG → DXF přes DwgConverter
  2. Validace DXF přes DxfValidator
  3. Extrakce budov → Honeybee Rooms (DxfBuildingExtractor)
  4. Extrakce terénu → Honeybee Shades (DxfTerrainExtractor)
  5. Sestavení Honeybee Model → to_dict(included_prop=[],
                                        include_plane=False)
  6. Post-processing (HbjsonPostprocessor): oprava normál + triangulace
  7. Zápis HBJSON

Soubor: ladybug_be/app/services/converter/dxf_to_hbjson_pipeline.py
"""

import os
import json
import math
import logging
import tempfile

import ezdxf
from ezdxf import recover

from honeybee.model import Model
from honeybee.typing import clean_string

from .dxf_building_extractor import DxfBuildingExtractor
from .dxf_terrain_extractor import DxfTerrainExtractor
from .dxf_validator import DxfValidator
from .dwg_converter import DwgConverter
from .hbjson_postprocessor import HbjsonPostprocessor

logger = logging.getLogger(__name__)

TOL = 0.01
ANGLE_TOL = math.radians(1.0)


class DxfToHbjsonPipeline:
    """Orchestruje celou konverzi DXF/DWG → HBJSON."""

    def __init__(
        self,
        input_path: str,
        output_path: str | None = None,
        include_terrain: bool = True,
    ):
        self.input_path = os.path.abspath(input_path)
        self.include_terrain = include_terrain
        self._is_dwg = self.input_path.lower().endswith(".dwg")

        if output_path:
            self.output_path = os.path.abspath(output_path)
        else:
            base = os.path.splitext(self.input_path)[0]
            self.output_path = base + ".hbjson"

    def run(self) -> dict:
        """
        Spustí celou pipeline.

        Returns:
            dict s klíči: hbjson_path, hbjson_dict, validation,
                          buildings, terrain_count, summary, postprocess
        """
        # 1. DWG → DXF
        dxf_path = self._ensure_dxf()

        # 2. Validace DXF
        validator = DxfValidator(dxf_path)
        validation = validator.validate()

        # 3. Načti DXF dokument
        doc, msp = self._load_dxf(dxf_path)

        # 4. Extrakce budov
        extractor = DxfBuildingExtractor(doc, msp)
        rooms, build_stats = extractor.extract()

        # 5. Extrakce terénu
        shades = []
        if self.include_terrain:
            terrain_ext = DxfTerrainExtractor(doc, msp)
            shades = terrain_ext.extract()

        # 6. Sestavení modelu
        model_id = clean_string(
            os.path.splitext(os.path.basename(self.input_path))[0]
        )
        model = Model(
            model_id,
            rooms=rooms if rooms else None,
            orphaned_shades=shades if shades else None,
            tolerance=TOL,
            angle_tolerance=ANGLE_TOL,
        )
        # included_prop=[] → vůbec se nevygenerují extension data
        # (energy/radiance konstrukce, materiály, programy…). Pro pouhý
        # geometrický převod a 3D vizualizaci nemají smysl.
        # include_plane=False → planes Face3D se nezahrnou (zmenšuje dict
        # a vizualizace je nepotřebuje).
        hbjson_dict = model.to_dict(included_prop=[], include_plane=False)

        # 7. Post-processing: oprava normál + triangulace
        postprocessor = HbjsonPostprocessor(hbjson_dict)
        hbjson_dict = postprocessor.process()

        # 8. Zápis
        with open(self.output_path, "w", encoding="utf-8") as f:
            json.dump(hbjson_dict, f, indent=2)

        # 9. Souhrn
        total_floor = sum(r.floor_area for r in model.rooms)
        total_vol = sum(abs(r.volume) for r in model.rooms)
        total_faces = sum(len(r.faces) for r in model.rooms)

        summary = {
            "rooms": len(model.rooms),
            "faces": total_faces,
            "shades": len(model.orphaned_shades),
            "floor_area_m2": round(total_floor, 1),
            "volume_m3": round(total_vol, 1),
            "file_size_kb": round(
                os.path.getsize(self.output_path) / 1024, 1
            ),
        }
        logger.info(
            "HBJSON hotovo: %d rooms, %.0f m², %s",
            summary["rooms"], total_floor, self.output_path,
        )

        return {
            "hbjson_path": self.output_path,
            "hbjson_dict": hbjson_dict,
            "validation": validation,
            "buildings": build_stats,
            "terrain_count": len(shades),
            "summary": summary,
            "postprocess": postprocessor.stats,
        }

    # ── interní ──────────────────────────────────────────

    def _ensure_dxf(self) -> str:
        if not self._is_dwg:
            return self.input_path
        converter = DwgConverter()
        dxf_path = tempfile.mktemp(suffix=".dxf")
        return converter.convert(self.input_path, dxf_path)

    @staticmethod
    def _load_dxf(path: str):
        try:
            doc = ezdxf.readfile(path)
        except Exception:
            doc, _ = recover.readfile(path)
        return doc, doc.modelspace()