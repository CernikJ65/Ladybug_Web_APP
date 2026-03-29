"""
Optimalizace sklonu panelů pomocí RadiationDome + Sunpath.

RadiationDome: najde optimální orientaci FV panelů pro lokaci.
Sunpath: přesný výpočet pozice slunce pro rozestup řad.

OPRAVA v2: Rozestup řad počítán pro ROVNODENNOST (21.3.) místo
zimního slunovratu (21.12.). Důvod:
  - Zimní slunovrat dává extrémně konzervativní rozestup (~4.9 m)
  - V praxi se používá rovnodennost nebo pravidlo 3× výška
  - Na 50°N: slunce 21.3. ve 12:00 = ~40° → rozestup ~2.6 m
  - Výsledek: 7–8 řad místo 4 na 20m střeše

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
from ladybug.sunpath import Sunpath
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
    """Najde optimální sklon pomocí RadiationDome, rozestup pomocí Sunpath."""

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

        tilt = round(values.get('altitude', 35.0), 1)
        azimuth = round(values.get('azimuth', 180.0), 1)
        radiation = round(values.get('value', 0.0), 1)
        return tilt, azimuth, radiation

    def calculate_row_spacing(
        self,
        panel_height: float,
        tilt_degrees: float,
    ) -> float:
        """
        Spočítá rozestup řad pomocí Sunpath (Ladybug).

        Používá jarní rovnodennost (21.3.) ve 12:00 — standardní
        kompromis mezi maximálním počtem panelů a stíněním.

        V praxi se nepoužívá zimní slunovrat (příliš konzervativní),
        ale rovnodennost nebo pravidlo 3× výška panelu.

        Fallback: pokud výška slunce vyjde příliš nízko (< 15°),
        použije se pravidlo 3× výška jako pojistka.
        """
        if tilt_degrees < 1:
            return 0

        panel_vertical = panel_height * math.sin(math.radians(tilt_degrees))
        panel_depth = panel_height * math.cos(math.radians(tilt_degrees))

        # Zkusíme přesný výpočet z rovnodennosti
        try:
            sun_alt = self._equinox_altitude()

            if sun_alt < 15:
                # Příliš nízko — fallback na pravidlo 3×
                shadow_length = panel_vertical * 3.0
            else:
                shadow_length = panel_vertical / math.tan(math.radians(sun_alt))
        except RuntimeError:
            # Nemáme location — použijeme pravidlo 3×
            shadow_length = panel_vertical * 3.0

        # Minimální rozestup: stín + hloubka panelu + malá rezerva
        spacing = shadow_length + panel_depth + 0.15

        # Clamp: nikdy méně než panel_depth + 0.3 m,
        # nikdy více než 3.5× panel_height (sanity check)
        min_spacing = panel_depth + 0.3
        max_spacing = panel_height * 3.5

        return round(max(min_spacing, min(spacing, max_spacing)), 2)

    def _equinox_altitude(self) -> float:
        """
        Výška slunce při jarní rovnodennosti (21.3.) ve 12:00.

        Pro 50°N: ~40°
        Pro 45°N: ~45°
        Pro 55°N: ~35°
        """
        if not self.location:
            raise RuntimeError(
                "TiltOptimizer: location je None — nelze spočítat rozestup řad."
            )

        sp = Sunpath.from_location(self.location)
        sun = sp.calculate_sun(month=3, day=21, hour=12.0)
        alt = float(sun.altitude)

        if alt <= 0:
            raise RuntimeError(
                f"Rovnodennost ve 12:00: záporná výška slunce "
                f"({alt:.1f}°) pro šířku {self.location.latitude:.1f}°."
            )
        return alt

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