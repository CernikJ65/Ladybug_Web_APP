"""
Validace DXF souboru — inventura vrstev, bloků, 3D geometrie.

Vrací strukturované výsledky validace jako dict, nikoli jen
textový výpis. Použitelné z API endpointu.

Soubor: ladybug_be/app/services/converter/dxf_validator.py
"""

import os
import logging
from collections import Counter

import ezdxf
from ezdxf import recover

logger = logging.getLogger(__name__)


class DxfValidator:
    """Validuje DXF soubor a vrátí inventuru obsahu."""

    def __init__(self, dxf_path: str):
        self.dxf_path = os.path.abspath(dxf_path)
        if not os.path.isfile(self.dxf_path):
            raise FileNotFoundError(f"DXF nenalezen: {self.dxf_path}")

    def validate(self) -> dict:
        """
        Spustí kompletní validaci DXF.

        Returns:
            dict s klíči: file_size, dxf_version, layers, modelspace,
                          blocks, geometry_3d, issues, is_valid
        """
        doc = self._load()
        msp = doc.modelspace()

        layers = self._analyze_layers(doc, msp)
        ms_types = self._modelspace_types(msp)
        blocks = self._analyze_blocks(doc)
        geo3d = self._analyze_3d(doc)
        issues = self._collect_issues(blocks, geo3d)

        return {
            "file_size_bytes": os.path.getsize(self.dxf_path),
            "dxf_version": doc.dxfversion,
            "layers": layers,
            "modelspace": ms_types,
            "blocks": blocks,
            "geometry_3d": geo3d,
            "issues": issues,
            "is_valid": len(issues) == 0,
        }

    # ── načtení ──────────────────────────────────────────

    def _load(self):
        try:
            return ezdxf.readfile(self.dxf_path)
        except Exception:
            logger.warning("Standardní čtení selhalo, recovery…")
            doc, auditor = recover.readfile(self.dxf_path)
            if auditor.has_errors:
                logger.warning("%d chyb při recovery", len(auditor.errors))
            return doc

    # ── analýza vrstev ───────────────────────────────────

    @staticmethod
    def _analyze_layers(doc, msp) -> list[dict]:
        result = []
        for layer in doc.layers:
            name = layer.dxf.name
            count = sum(
                1 for e in msp if e.dxf.get("layer", "0") == name
            )
            result.append({"name": name, "entity_count": count})
        return result

    # ── modelspace typy ──────────────────────────────────

    @staticmethod
    def _modelspace_types(msp) -> dict:
        types = Counter()
        for e in msp:
            types[e.dxftype()] += 1
        return {
            "total": sum(types.values()),
            "by_type": dict(types.most_common()),
        }

    # ── bloky ────────────────────────────────────────────

    @staticmethod
    def _analyze_blocks(doc) -> dict:
        total = 0
        empty = 0
        with_content = []

        for block in doc.blocks:
            if block.name.startswith("*"):
                continue
            total += 1
            ents = list(block)
            if not ents:
                empty += 1
            else:
                types = Counter(e.dxftype() for e in ents)
                with_content.append({
                    "name": block.name,
                    "count": len(ents),
                    "types": dict(types),
                })

        return {
            "total": total,
            "empty": empty,
            "with_content": len(with_content),
            "details": sorted(
                with_content, key=lambda x: -x["count"]
            )[:20],
        }

    # ── 3D geometrie ─────────────────────────────────────

    @staticmethod
    def _analyze_3d(doc) -> dict:
        counts = {
            "3dface": 0, "3dsolid": 0,
            "polyface_mesh": 0, "polyline_3d": 0,
            "mesh": 0, "line_with_z": 0,
        }
        for block in doc.blocks:
            for e in block:
                t = e.dxftype()
                if t == "3DFACE":
                    counts["3dface"] += 1
                elif t == "3DSOLID":
                    counts["3dsolid"] += 1
                elif t == "POLYLINE":
                    flags = e.dxf.get("flags", 0)
                    if flags & 0x40:
                        counts["polyface_mesh"] += 1
                    elif flags & 0x8:
                        counts["polyline_3d"] += 1
                elif t == "MESH":
                    counts["mesh"] += 1
                elif t == "LINE":
                    try:
                        if (abs(e.dxf.start.z) > 0.001
                                or abs(e.dxf.end.z) > 0.001):
                            counts["line_with_z"] += 1
                    except Exception:
                        pass
        return counts

    # ── problémy ─────────────────────────────────────────

    @staticmethod
    def _collect_issues(blocks: dict, geo3d: dict) -> list[str]:
        issues = []
        if blocks["empty"] > 10:
            issues.append(
                f"{blocks['empty']} prázdných bloků (ztracená data)"
            )
        total_3d = (
            geo3d["3dface"] + geo3d["3dsolid"]
            + geo3d["polyface_mesh"] + geo3d["mesh"]
        )
        if total_3d == 0 and geo3d["line_with_z"] == 0:
            issues.append("Žádná 3D geometrie")
        return issues