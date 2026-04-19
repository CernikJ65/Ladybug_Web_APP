"""
Umístění solárních panelů na střešní plochy — čistá mřížka řad a sloupců.

Logika:
  - Každá střecha dostane pravidelnou mřížku: sloupce (X) × řady (Y)
  - Mezera mezi sloupci: panel_width + spacing
  - Mezera mezi řadami: určena výpočtem stínění (Sunpath) pro ploché střechy,
    jinak panel_height + spacing
  - Panely se umisťují od levého dolního rohu, postupně po řadách
  - Ploché střechy (tilt < 5°): panely se nakloní k optimálnímu azimutu
  - Šikmé střechy: panely kopírují sklon střechy

Výsledek je deterministická mřížka — žádná náhodnost.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Optional

from honeybee.shade import Shade
from ladybug_geometry.geometry2d.pointvector import Point2D, Vector2D
from ladybug_geometry.geometry2d.polygon import Polygon2D
from ladybug_geometry.geometry3d.pointvector import Point3D
from ladybug_geometry.geometry3d.face import Face3D
from ladybug_geometry.geometry3d.plane import Plane

from .roof_detector import RoofInfo
from .tilt_optimizer import TiltOptimizer, OptimalOrientation

FLAT_ROOF_THRESHOLD = 5.0  # stupně — pod tímto = plochá střecha


@dataclass
class PanelPosition:
    """Jedna pozice solárního panelu."""

    id: int
    roof_id: str
    shade: Shade
    area: float
    tilt: float
    azimuth: float
    row: int = 0
    col: int = 0
    radiation_kwh_m2: float = 0.0
    annual_production_kwh: float = 0.0

    @property
    def geometry(self) -> Face3D:
        return self.shade.geometry

    @property
    def center_3d(self) -> Point3D:
        return self.shade.center


class PanelPlacer:
    """Generuje pravidelnou mřížku panelů na střechách."""

    def __init__(
        self,
        panel_width: float = 1.0,
        panel_height: float = 1.7,
        spacing: float = 0.3,
        edge_margin: float = 0.3,
        tilt_optimizer: Optional[TiltOptimizer] = None,
        latitude: float = 50.0,
    ):
        self.panel_width = panel_width
        self.panel_height = panel_height
        self.spacing = spacing
        self.edge_margin = edge_margin
        self.tilt_optimizer = tilt_optimizer
        self.latitude = latitude
        self._next_id = 0
        self._optimal: Optional[OptimalOrientation] = None

    # ------------------------------------------------------------------
    # Veřejné API
    # ------------------------------------------------------------------

    def place_on_all_roofs(self, roofs: List[RoofInfo]) -> List[PanelPosition]:
        """Umístí panely na všechny střechy, vrátí celkový seznam."""
        self._next_id = 0
        if self.tilt_optimizer:
            self._optimal = self.tilt_optimizer.find_optimal_orientation()
        panels: List[PanelPosition] = []
        for roof in roofs:
            panels.extend(self._place_on_roof(roof))
        return panels

    # ------------------------------------------------------------------
    # Mřížkové umístění
    # ------------------------------------------------------------------

    def _place_on_roof(self, roof: RoofInfo) -> List[PanelPosition]:
        """
        Vyplní střešní plochu pravidelnou mřížkou panelů.

        Souřadnice jsou v lokální rovině střechy (2D).
        Sloupce (X) = podél šířky, řady (Y) = podél hloubky.
        Začínáme od levého dolního rohu s okrajem edge_margin.
        """
        is_flat = roof.tilt < FLAT_ROOF_THRESHOLD
        face = roof.geometry
        plane: Plane = face.plane
        poly2d = face.boundary_polygon2d

        # Ohraničující obdélník v rovině střechy
        xs = [v.x for v in poly2d.vertices]
        ys = [v.y for v in poly2d.vertices]
        x_min = min(xs) + self.edge_margin
        x_max = max(xs) - self.edge_margin
        y_min = min(ys) + self.edge_margin
        y_max = max(ys) - self.edge_margin

        # Příliš malá střecha
        if (x_max - x_min) < self.panel_width or (y_max - y_min) < self.panel_height:
            return []

        col_step = self.panel_width + self.spacing   # krok sloupců
        row_step = self._row_step(is_flat)            # krok řad (zahrnuje stínění)

        hw = self.panel_width / 2.0
        hh = self.panel_height / 2.0

        panels: List[PanelPosition] = []
        row_idx = 0

        # Iterace řad (Y) od spodního okraje
        y = y_min + hh
        while y + hh <= y_max:
            col_idx = 0

            # Iterace sloupců (X) zleva doprava
            x = x_min + hw
            while x + hw <= x_max:
                center_2d = Point2D(x, y)

                # Panel musí být celý uvnitř polygonu střechy
                if self._panel_inside(poly2d, center_2d, hw, hh):
                    panel = self._build_panel(
                        plane=plane,
                        cx=x, cy=y,
                        hw=hw, hh=hh,
                        roof=roof,
                        is_flat=is_flat,
                        row=row_idx,
                        col=col_idx,
                    )
                    if panel is not None:
                        panels.append(panel)

                x += col_step
                col_idx += 1

            y += row_step
            row_idx += 1

        return panels

    # ------------------------------------------------------------------
    # Krok řad — stínění
    # ------------------------------------------------------------------

    def _row_step(self, is_flat: bool) -> float:
        """
        Vzdálenost mezi řadami (středy panelů).

        Plochá střecha s nakloněnými panely:
          Výpočet z minimálního slunečního úhlu (zimní slunovrat)
          tak, aby přední řada nestínila zadní.

        Šikmá střecha:
          Panely leží na ploše → minimální rozestup = panel_height + spacing.
        """
        if is_flat and self._optimal and self.tilt_optimizer:
            return self.tilt_optimizer.calculate_row_spacing(
                self.panel_height, self._optimal.tilt_degrees
            )
        # Šikmá střecha: panely leží na sklonu, stínění řeší geometrie střechy
        return self.panel_height + self.spacing

    # ------------------------------------------------------------------
    # Tvorba panelu
    # ------------------------------------------------------------------

    def _build_panel(
        self,
        plane: Plane,
        cx: float, cy: float,
        hw: float, hh: float,
        roof: RoofInfo,
        is_flat: bool,
        row: int, col: int,
    ) -> Optional[PanelPosition]:
        """
        Vytvoří Shade reprezentující jeden panel.

        Ploché střechy: panel nakloněn k optimálnímu směru.
        Šikmé střechy: panel leží rovně na ploše.
        """
        corners_2d = [
            Point2D(cx - hw, cy - hh),
            Point2D(cx + hw, cy - hh),
            Point2D(cx + hw, cy + hh),
            Point2D(cx - hw, cy + hh),
        ]
        corners_3d = [plane.xy_to_xyz(p) for p in corners_2d]

        try:
            panel_face = Face3D(corners_3d)
        except Exception:
            return None

        # Normála musí mířit nahoru
        if panel_face.normal.z < 0:
            panel_face = panel_face.flip()

        actual_tilt = roof.tilt
        actual_azimuth = roof.azimuth

        # Na ploché střeše: nakloňme panel k optimálnímu světovému směru
        if is_flat and self._optimal:
            panel_face = TiltOptimizer.tilt_face(
                panel_face,
                self._optimal.tilt_degrees,
                self._optimal.azimuth_degrees,
            )
            actual_tilt = self._optimal.tilt_degrees
            actual_azimuth = self._optimal.azimuth_degrees

        pid = self._next_id
        self._next_id += 1

        shade = Shade(f"PV_{pid:04d}", panel_face, is_detached=True)
        return PanelPosition(
            id=pid,
            roof_id=roof.identifier,
            shade=shade,
            area=round(self.panel_width * self.panel_height, 4),
            tilt=round(actual_tilt, 1),
            azimuth=round(actual_azimuth, 1),
            row=row,
            col=col,
        )

    # ------------------------------------------------------------------
    # Pomocné metody
    # ------------------------------------------------------------------

    @staticmethod
    def _panel_inside(poly2d, center: Point2D, hw: float, hh: float) -> bool:
        """
        Zkontroluje, že obdélník panelu leží celý uvnitř polygonu střechy.
        Využívá nativní Polygon2D.from_rectangle + is_polygon_inside z ladybug_geometry.
        """
        base = Point2D(center.x - hw, center.y - hh)
        panel_rect = Polygon2D.from_rectangle(
            base_point=base,
            height_vector=Vector2D(0, 1),
            base=2 * hw,
            height=2 * hh,
        )
        return poly2d.is_polygon_inside(panel_rect)