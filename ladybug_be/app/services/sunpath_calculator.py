"""
Sluneční dráha z EPW — Sunpath.calculate_sun() + calculate_sunrise_sunset().

Využité Ladybug funkce:
  - Sunpath.from_location(epw.location)
  - Sunpath.calculate_sun(month, day, hour) → Sun
  - Sunpath.calculate_sunrise_sunset(month, day, depression) → dict
  - Sun.altitude, Sun.azimuth (stupně v Ladybug 1.x+)

Soubor: ladybug_be/app/services/sunpath_calculator.py
"""
from __future__ import annotations

from typing import Dict, Any, List

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
        """Tabulka východu, západu a délky dne přes Ladybug.

        Sunpath.calculate_sunrise_sunset() s depression=0 definuje
        východ/západ jako okamžik, kdy střed slunce prochází matematickým
        horizontem (altitude = 0°). Tím se chování shoduje s původní
        implementací, která hledala první minutu s altitude > 0.
        """
        table = []
        for month in range(1, 13):
            riseset = self._sp.calculate_sunrise_sunset(
                month, 21, depression=0,
            )
            sr_dt = riseset.get("sunrise")
            ss_dt = riseset.get("sunset")

            noon = self._sp.calculate_sun(month, 21, 12)

            if sr_dt is not None and ss_dt is not None:
                sr_float = sr_dt.hour + sr_dt.minute / 60
                ss_float = ss_dt.hour + ss_dt.minute / 60
                length = ss_float - sr_float
            else:
                length = 0

            table.append({
                "month": month,
                "name": MONTH_NAMES_CZ[month - 1],
                "sunrise": self._fmt_dt(sr_dt),
                "sunset": self._fmt_dt(ss_dt),
                "day_length_h": round(length, 2),
                "noon_altitude": round(noon.altitude, 1),
            })
        return table

    @staticmethod
    def _fmt_dt(dt) -> str:
        if dt is None:
            return "--:--"
        return f"{dt.hour:02d}:{dt.minute:02d}"