"""
Větrná analýza z EPW — maximální využití Ladybug API, bez fallbacků.

Použité moduly a funkce:
  - ladybug.epw.EPW
  - ladybug.windrose.WindRose
        konstrukce růžice, histogram_data, prevailing_direction
  - ladybug.windprofile.WindProfile
        mocninový profil rychlosti větru s korektním zohledněním rozdílu
        mezi meteorologickým (EPW = country, 10 m) a cílovým terénem
  - HourlyContinuousCollection
        group_by_month(), properties .average, .max, .values

Soubor: ladybug_be/app/services/wind_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List, Tuple

from ladybug.epw import EPW
from ladybug.windrose import WindRose
from ladybug.windprofile import WindProfile

MONTH_NAMES_CZ = [
    "Led", "Úno", "Bře", "Dub", "Kvě", "Čvn",
    "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro",
]
DIR_16 = [
    "S", "SSV", "SV", "VSV", "V", "VJV", "JV", "JJV",
    "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ",
]
SP_BINS = [0, 0.5, 2, 4, 6, 8, 10, 999]
SP_LABELS = ["Klid", "0.5–2", "2–4", "4–6", "6–8", "8–10", "10+"]

BEAUFORT_EDGES = [0, 0.5, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 999]
BEAUFORT_LABELS = [
    "0 Bezvětří", "1 Vánek", "2 Slabý", "3 Mírný",
    "4 Čerstvý", "5 Silný", "6 Prudký", "7 Bouřlivý",
    "8+ Vichřice",
]

TERRAIN_MAP: List[Tuple[str, str]] = [
    ("Vodní plocha", "water"),
    ("Otevřená rovina", "country"),
    ("Předměstí", "suburban"),
    ("Město", "city"),
]

MET_TERRAIN = "country"
MET_HEIGHT_M = 10.0
CALM_THRESHOLD = 0.5


def _fl(v: object) -> float:
    return float(v[0]) if isinstance(v, (list, tuple)) else float(v)


class WindAnalyzerAdvanced:

    def __init__(self, epw: EPW):
        self._ws_coll = epw.wind_speed
        self._wd_coll = epw.wind_direction
        self._ws = list(self._ws_coll.values)
        self._n = len(self._ws)
        self._rose = WindRose(self._wd_coll, self._ws_coll, 16)

    def analyze(self) -> Dict[str, Any]:
        return {
            "direction_frequency": self._direction_freq(),
            "monthly_speed": self._monthly_speed(),
            "beaufort": self._beaufort(),
            "wind_profile": self._wind_heights(),
            "summary": self._summary(),
        }

    def _direction_freq(self) -> Dict[str, Any]:
        hist = self._rose.histogram_data
        sector = 22.5
        nb = len(SP_BINS) - 1
        dirs = []
        mx = 0
        for i, speeds in enumerate(hist):
            bins = [0] * nb
            for s in speeds:
                v = _fl(s)
                for bi in range(nb):
                    if SP_BINS[bi] <= v < SP_BINS[bi + 1]:
                        bins[bi] += 1
                        break
            total = len(speeds)
            mx = max(mx, total)
            avg = round(
                sum(_fl(s) for s in speeds) / total, 2,
            ) if total else 0
            dirs.append({
                "index": i,
                "label": DIR_16[i],
                "angle": round(i * sector, 1),
                "total_hours": total,
                "frequency_pct": round(total / self._n * 100, 2),
                "bins": bins,
                "avg_speed": avg,
            })
        return {
            "directions": dirs,
            "speed_labels": SP_LABELS,
            "max_hours": mx,
        }

    def _monthly_speed(self) -> List[Dict[str, Any]]:
        grouped = self._ws_coll.group_by_month()
        result = []
        for i in range(12):
            vals = list(grouped[i + 1])
            result.append({
                "month": i + 1,
                "name": MONTH_NAMES_CZ[i],
                "avg_speed": round(sum(vals) / len(vals), 2),
                "max_speed": round(max(vals), 1),
            })
        return result

    def _beaufort(self) -> List[Dict[str, Any]]:
        """Beaufortova stupnice iterací hodnot kolekce.

        Pozn.: filter_by_conditional_statement se zde nepoužívá, protože
        nejvyšší třída (8+ Vichřice, >= 17.2 m/s) je ve většině lokalit
        prázdná a Ladybug odmítne sestavit prázdnou DiscontinuousCollection.
        """
        result = []
        for i in range(len(BEAUFORT_LABELS)):
            lo, hi = BEAUFORT_EDGES[i], BEAUFORT_EDGES[i + 1]
            hours = sum(1 for v in self._ws if lo <= v < hi)
            result.append({
                "label": BEAUFORT_LABELS[i],
                "hours": hours,
                "pct": round(hours / self._n * 100, 1),
            })
        return result

    def _wind_heights(self) -> Dict[str, Any]:
        """Výškový profil rychlosti přes ladybug.windprofile.WindProfile.

        Vzorec (mocninový zákon se dvěma terény):
            V(h) = V_met · (δ_met / z_met)^α_met · (h / δ)^α
        kde index _met patří meteorologické stanici (EPW = country, 10 m)
        a parametry bez indexu patří cílovému terénu.
        """
        avg10 = self._ws_coll.average
        heights = [2, 5, 10, 20]
        terrains = []
        for cz_name, lb_terrain in TERRAIN_MAP:
            profile = WindProfile(
                terrain=lb_terrain,
                meteorological_terrain=MET_TERRAIN,
                meteorological_height=MET_HEIGHT_M,
                log_law=False,
            )
            speeds = {
                f"{h}m": round(profile.calculate_wind(avg10, height=h), 2)
                for h in heights
            }
            terrains.append({"name": cz_name, "speeds": speeds})
        return {
            "heights": heights,
            "terrains": terrains,
        }

    def _summary(self) -> Dict[str, Any]:
        """Shrnující statistiky.

        calm_hours je definováno jako rychlost pod 0.5 m/s (Beaufort 0).
        Počítá se iterací ze stejného důvodu jako Beaufort: některé lokality
        nemají ani jednu takovou hodinu a filtrace kolekce by selhala.
        """
        pd = _fl(self._rose.prevailing_direction)
        idx = int(round(pd / 22.5)) % 16
        calm = sum(1 for v in self._ws if v < CALM_THRESHOLD)
        return {
            "avg_speed": round(self._ws_coll.average, 2),
            "max_speed": round(self._ws_coll.max, 1),
            "calm_hours": calm,
            "calm_pct": round(calm / self._n * 100, 1),
            "prevailing_dir": DIR_16[idx],
            "prevailing_angle": round(pd, 1),
        }