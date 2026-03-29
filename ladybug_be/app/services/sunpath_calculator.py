"""
Sluneční dráha z EPW — Sunpath.calculate_sun().

  - Sunpath.from_location(epw.location)
  - Sun.altitude, Sun.azimuth (stupně v Ladybug 1.x+)
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from ladybug.epw import EPW
from ladybug.sunpath import Sunpath

MONTH_NAMES_CZ = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
]


class SunpathCalculator:

    def __init__(self, epw: EPW):
        self._location = epw.location
        self._sp = Sunpath.from_location(self._location)

    def analyze(self) -> Dict[str, Any]:
        return {
            "daily_arcs": self._daily_arcs(),
            "day_length": self._day_length_table(),
            "location": {
                "latitude": round(self._location.latitude, 2),
                "longitude": round(self._location.longitude, 2),
            },
        }

    def _daily_arcs(self) -> List[Dict[str, Any]]:
        arcs = []
        for month in range(1, 13):
            points = []
            hour = 0.0
            while hour < 24.0:
                sun = self._sp.calculate_sun(month, 21, hour)
                if 0.5 < sun.altitude < 90:
                    points.append({
                        "hour": round(hour, 2),
                        "altitude": round(sun.altitude, 2),
                        "azimuth": round(sun.azimuth % 360, 2),
                    })
                hour += 1 / 6
            if points:
                arcs.append({
                    "month": month,
                    "name": MONTH_NAMES_CZ[month - 1],
                    "day": 21,
                    "points": points,
                    "max_altitude": round(max(p["altitude"] for p in points), 1),
                })
        return arcs

    def _day_length_table(self) -> List[Dict[str, Any]]:
        table = []
        for month in range(1, 13):
            sr = self._find_sun_up(month, 21, 3.0, 12.0)
            ss = self._find_sun_down(month, 21, 12.0, 23.0)
            length = (ss - sr) if (sr is not None and ss is not None) else 0
            noon = self._sp.calculate_sun(month, 21, 12.0)
            table.append({
                "month": month,
                "name": MONTH_NAMES_CZ[month - 1],
                "sunrise": self._fmt(sr),
                "sunset": self._fmt(ss),
                "day_length_h": round(length, 2),
                "noon_altitude": round(noon.altitude, 1),
            })
        return table

    def _find_sun_up(self, m: int, d: int, start: float, end: float) -> Optional[float]:
        h = start
        while h < end:
            if self._sp.calculate_sun(m, d, h).altitude > 0:
                return round(h, 3)
            h += 1 / 60
        return None

    def _find_sun_down(self, m: int, d: int, start: float, end: float) -> Optional[float]:
        h = start
        while h < end:
            if self._sp.calculate_sun(m, d, h).altitude <= 0:
                return round(h - 1 / 60, 3)
            h += 1 / 60
        return None

    @staticmethod
    def _fmt(h: Optional[float]) -> str:
        if h is None:
            return "--:--"
        return f"{int(h):02d}:{int((h - int(h)) * 60):02d}"