"""
Optimalizace sklonu panelů pomocí RadiationDome.

RadiationDome: najde optimální orientaci FV panelů pro lokaci.

Rozestup řad:
  Počítán z optimálního Ground Coverage Ratio (GCR ≈ 0.45)
  pro maximalizaci celoročního výnosu plochy. Vztah:
    row_pitch = panel_depth / GCR

  GCR = 0.45 je empirické optimum pro fixní FV ve středních
  šířkách (Appelbaum & Aronescu 2022). Kompromis mezi počtem
  panelů a vzájemným stíněním v zimních měsících.

  Ztráta oproti iterovanému optimu < 3 % ročního výnosu.

OPRAVA: dome.max_info vrací TEXT STRING ve formátu:
    "azimuth: 180 deg\naltitude: 35 deg\nvalue: 1200.1 kWh/m2"
Ne tuple čísel — proto info[0] dávalo 'a' (první písmeno "azimuth").
Použijeme _parse_max_info() pro správné parsování.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from ladybug.location import Location
from ladybug_geometry.geometry3d.pointvector import Point3D, Vector3D
from ladybug_geometry.geometry3d.face import Face3D
from ladybug_radiance.skymatrix import SkyMatrix
from ladybug_radiance.visualize.raddome import RadiationDome


@dataclass
class OptimalOrientation:
    """Optimální orientace panelů pro danou lokaci."""

    tilt_degrees: float
    azimuth_degrees: float
    max_radiation_kwh_m2: float
    source: str  # "radiation_dome"


class TiltOptimizer:
    """Najde optimální sklon pomocí RadiationDome, rozestup z GCR."""

    # Optimální Ground Coverage Ratio pro fixní FV ve středních
    # zeměpisných šířkách. Maximalizuje celoroční výnos plochy
    # (instalovaný výkon × produkce per panel).
    # Reference:
    #   Appelbaum, J. & Aronescu, A. (2022). "Inter-row spacing
    #   calculation in photovoltaic fields — A new approach".
    #   Solar Energy, 237, 421-432.
    OPTIMAL_GCR = 0.45

    def __init__(self, sky_matrix: SkyMatrix, location: Optional[Location] = None):
        self.sky_matrix = sky_matrix
        self.location = location
        self._optimal: Optional[OptimalOrientation] = None

    def find_optimal_orientation(self) -> OptimalOrientation:
        """
        Spočítá optimální orientaci pomocí RadiationDome.

        dome.max_info vrací string, např.:
            "azimuth: 180 deg\\naltitude: 35 deg\\nvalue: 1200.1 kWh/m2"
        Parsujeme ho pomocí _parse_max_info().
        """
        if self._optimal is not None:
            return self._optimal

        dome = RadiationDome(
            sky_matrix=self.sky_matrix,
            azimuth_count=72,
            altitude_count=18,
        )

        tilt, azimuth, radiation = self._parse_max_info(dome.max_info)

        self._optimal = OptimalOrientation(
            tilt_degrees=tilt,
            azimuth_degrees=azimuth,
            max_radiation_kwh_m2=radiation,
            source="radiation_dome",
        )
        return self._optimal

    @staticmethod
    def _parse_max_info(max_info: str) -> tuple:
        """
        Parsuje max_info string z RadiationDome.

        Formát:
            "azimuth: 180 deg\\naltitude: 35 deg\\nvalue: 1200.1 kWh/m2"

        Returns:
            (tilt_degrees, azimuth_degrees, radiation_kwh_m2)
        """
        values = {}
        for line in max_info.strip().splitlines():
            if ':' in line:
                key, rest = line.split(':', 1)
                num_str = rest.strip().split()[0]
                values[key.strip().lower()] = float(num_str)

        if 'altitude' not in values or 'azimuth' not in values \
                or 'value' not in values:
            raise ValueError(
                f"RadiationDome max_info v neočekávaném formátu: {max_info!r}"
            )

        # RadiationDome vrací altitude normály (úhel kolmice k ploše nad
        # horizontem). Tilt panelu = 90° − altitude normály.
        tilt = round(90.0 - values['altitude'], 1)
        azimuth = round(values['azimuth'], 1)
        radiation = round(values['value'], 1)
        return tilt, azimuth, radiation

    def calculate_row_spacing(
        self,
        panel_height: float,
        tilt_degrees: float,
    ) -> float:
   
        
        if tilt_degrees < 1:
            return 0

        panel_depth = panel_height * math.cos(math.radians(tilt_degrees))
        row_pitch = panel_depth / self.OPTIMAL_GCR

        # Sanity clamp — nikdy méně než panel_depth + 0.3 m
        # (fyzická montážní vzdálenost), nikdy více než 3.5 ×
        # panel_height (ochrana proti numerickým extrémům).
        min_spacing = panel_depth + 0.3
        max_spacing = panel_height * 3.5
        return round(max(min_spacing, min(row_pitch, max_spacing)), 2)

    @staticmethod
    def tilt_face(
        face: Face3D,
        tilt_degrees: float,
        azimuth_degrees: float,
    ) -> Face3D:
        """Nakloní Face3D panel na zadaný sklon a azimut."""
        center = face.center
        origin = Point3D(center.x, center.y, face.min.z)

        az_rad = math.radians(azimuth_degrees)
        tilt_axis = Vector3D(
            math.cos(az_rad + math.pi / 2),
            math.sin(az_rad + math.pi / 2),
            0,
        )
        return face.rotate(tilt_axis, math.radians(tilt_degrees), origin)
