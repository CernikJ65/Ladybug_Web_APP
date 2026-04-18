"""
Sluneční dráha z EPW — maximální využití Ladybug API, bez fallbacků.

Použité moduly a funkce:
  - ladybug.sunpath.Sunpath
        from_location() — sestavení dráhy z EPW lokace
        calculate_sunrise_sunset() — analytický východ/západ/poledne
        calculate_sun_from_date_time() — pozice slunce v DateTime
        calculate_sun() — pozice slunce pro (měsíc, den, hodina)
  - Sun.altitude, Sun.azimuth (stupně)

Soubor: ladybug_be/app/services/sunpath_calculator.py
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
        """Oblouk sluneční dráhy pro 21. den každého měsíce.

        Interval vzorkování je omezen na rozsah mezi východem a západem
        slunce získaným analyticky přes calculate_sunrise_sunset.
        Nevzorkuje se tedy zbytečně noc, kde je altitude záporná.
        """
        arcs = []
        for month in range(1, 13):
            times = self._sp.calculate_sunrise_sunset(month, 21)
            sr_dt = times["sunrise"]
            ss_dt = times["sunset"]

            # Polární den/noc (nenastává pro ČR, ale bezpečně ošetřeno).
            if sr_dt is None or ss_dt is None:
                continue

            sr_h = self._to_hour(sr_dt)
            ss_h = self._to_hour(ss_dt)

            # Přesné krajní body — v okamžiku východu/západu má slunce
            # altitude = 0, takže oblouk dosedne na spodní osu grafu.
            sr_sun = self._sp.calculate_sun(month, 21, sr_h)
            ss_sun = self._sp.calculate_sun(month, 21, ss_h)

            points = [{
                "hour": round(sr_h, 2),
                "altitude": 0.0,
                "azimuth": round(sr_sun.azimuth % 360, 2),
            }]

            hour = sr_h + 1 / 6
            while hour < ss_h:
                sun = self._sp.calculate_sun(month, 21, hour)
                if 0 < sun.altitude < 90:
                    points.append({
                        "hour": round(hour, 2),
                        "altitude": round(sun.altitude, 2),
                        "azimuth": round(sun.azimuth % 360, 2),
                    })
                hour += 1 / 6

            points.append({
                "hour": round(ss_h, 2),
                "altitude": 0.0,
                "azimuth": round(ss_sun.azimuth % 360, 2),
            })

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
        """Tabulka délky dne přes Sunpath.calculate_sunrise_sunset().

        Metoda vrací slovník s DateTime objekty pro sunrise, noon a sunset
        na základě analytického výpočtu sluneční deklinace a rovnice času.
        Původní verze iterovala po minutách volající calculate_sun, což
        bylo jak nepřesné (grid 1 min), tak pomalé (stovky volání na měsíc).
        """
        table = []
        for month in range(1, 13):
            times = self._sp.calculate_sunrise_sunset(month, 21)
            sr_dt = times["sunrise"]
            ss_dt = times["sunset"]
            noon_dt = times["noon"]

            sr_h = self._to_hour(sr_dt)
            ss_h = self._to_hour(ss_dt)
            if sr_h is not None and ss_h is not None:
                length = ss_h - sr_h
            else:
                length = 0.0

            # Výška slunce v astronomickém poledni (zohledňuje rovnici času,
            # takže se liší od hodinového času 12:00 o desítky minut).
            noon_sun = self._sp.calculate_sun_from_date_time(noon_dt)

            table.append({
                "month": month,
                "name": MONTH_NAMES_CZ[month - 1],
                "sunrise": self._fmt(sr_dt),
                "sunset": self._fmt(ss_dt),
                "day_length_h": round(length, 2),
                "noon_altitude": round(noon_sun.altitude, 1),
            })
        return table

    @staticmethod
    def _to_hour(dt) -> Optional[float]:
        if dt is None:
            return None
        return dt.hour + dt.minute / 60.0

    @staticmethod
    def _fmt(dt) -> str:
        if dt is None:
            return "--:--"
        return f"{dt.hour:02d}:{dt.minute:02d}"