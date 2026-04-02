"""
Větrná analýza z EPW — WindRose + WindProfile, žádné fallbacky.

  - WindRose(direction, speed, 16) → histogram_data, prevailing_direction
  - WindProfile(terrain, 10) → calculate_wind(speed, height)
  - collection.average_monthly(), filter_by_analysis_period()

Soubor: ladybug_be/app/services/wind_analyzer_advanced.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.epw import EPW
from ladybug.analysisperiod import AnalysisPeriod
from ladybug.windrose import WindRose

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
BEAUFORT = [
    (0.5, "0 Bezvětří"), (1.6, "1 Vánek"), (3.4, "2 Slabý"),
    (5.5, "3 Mírný"), (8.0, "4 Čerstvý"), (10.8, "5 Silný"),
    (13.9, "6 Prudký"), (17.2, "7 Bouřlivý"), (999, "8+ Vichřice"),
]

# Power law exponent α pro různé terény (EN 1991-1-4)
TERRAIN_ALPHA = {
    "Vodní plocha": 0.10,
    "Otevřená rovina": 0.14,
    "Předměstí": 0.22,
    "Město": 0.33,
}


def _fl(v: object) -> float:
    return float(v[0]) if isinstance(v, (list, tuple)) else float(v)


class WindAnalyzerAdvanced:

    def __init__(self, epw: EPW):
        self._ws_coll = epw.wind_speed
        self._wd_coll = epw.wind_direction
        self._ws = list(self._ws_coll.values)
        self._wd = list(self._wd_coll.values)
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
                "index": i, "label": DIR_16[i],
                "angle": round(i * sector, 1),
                "total_hours": total,
                "frequency_pct": round(
                    total / self._n * 100, 2,
                ),
                "bins": bins, "avg_speed": avg,
            })
        return {
            "directions": dirs,
            "speed_labels": SP_LABELS,
            "max_hours": mx,
        }

    def _monthly_speed(self) -> List[Dict[str, Any]]:
        avg = self._ws_coll.average_monthly()
        result = []
        for i in range(12):
            ap = AnalysisPeriod(i + 1, 1, 0, i + 1, 31, 23)
            vals = list(
                self._ws_coll.filter_by_analysis_period(ap).values,
            )
            result.append({
                "month": i + 1,
                "name": MONTH_NAMES_CZ[i],
                "avg_speed": round(_fl(avg[i]), 2),
                "max_speed": round(max(vals), 1) if vals else 0,
            })
        return result

    def _beaufort(self) -> List[Dict[str, Any]]:
        """Beaufortova stupnice — počet hodin a procenta.

        Každá hodina spadne právě do jednoho binu,
        takže součet procent je vždy 100 %.
        """
        counts = [0] * len(BEAUFORT)
        for ws in self._ws:
            for bi, (thr, _) in enumerate(BEAUFORT):
                if ws < thr:
                    counts[bi] += 1
                    break

        total = sum(counts)
        if total == 0:
            total = 1

        return [
            {
                "label": BEAUFORT[i][1],
                "hours": counts[i],
                "pct": round(counts[i] / total * 100, 1),
            }
            for i in range(len(BEAUFORT))
        ]

    def _wind_heights(self) -> Dict[str, Any]:
        """Větrný profil — power law: v(h) = v_ref × (h/h_ref)^α

        EPW = 10 m na letišti. α závisí na terénu (EN 1991-1-4).
        """
        avg10 = sum(self._ws) / self._n
        h_ref = 10.0
        heights = [2, 5, 10, 20]

        terrains = []
        for name, alpha in TERRAIN_ALPHA.items():
            speeds = {
                f"{h}m": round(avg10 * (h / h_ref) ** alpha, 2)
                for h in heights
            }
            terrains.append({"name": name, "speeds": speeds})

        return {
            "heights": heights,
            "terrains": terrains,
        }

    def _summary(self) -> Dict[str, Any]:
        pd = _fl(self._rose.prevailing_direction)
        idx = int(round(pd / 22.5)) % 16
        calm = int(_fl(self._rose.zero_count))
        return {
            "avg_speed": round(sum(self._ws) / self._n, 2),
            "max_speed": round(max(self._ws), 1),
            "calm_hours": calm,
            "calm_pct": round(calm / self._n * 100, 1),
            "prevailing_dir": DIR_16[idx],
            "prevailing_angle": round(pd, 1),
        }