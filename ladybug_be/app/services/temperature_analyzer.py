"""
Teplotní analýza z EPW — nativní Ladybug metody, žádné fallbacky.

  - collection.average_monthly(), percentile_monthly()
  - collection.average_monthly_per_hour()
  - collection.filter_by_conditional_statement()
  - collection.filter_by_analysis_period()
  - collection.group_by_month()
  - EPW.ashrae_climate_zone
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.epw import EPW
from ladybug.analysisperiod import AnalysisPeriod

MONTH_NAMES_CZ = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
]


class TemperatureAnalyzer:

    def __init__(self, epw: EPW):
        self._epw = epw
        self._temp = epw.dry_bulb_temperature

    def analyze(self) -> Dict[str, Any]:
        return {
            "monthly_profile": self._monthly_profile(),
            "degree_days": self._degree_days(),
            "heatmap": self._heatmap(),
            "diurnal_profiles": self._diurnal_profiles(),
            "climate_zone": self._climate_zone(),
            "annual_summary": self._annual_summary(),
        }

    def _monthly_profile(self) -> List[Dict[str, Any]]:
        avg = self._temp.average_monthly()
        p05 = self._temp.percentile_monthly(5)
        p95 = self._temp.percentile_monthly(95)
        return [
            {"month": i + 1, "name": MONTH_NAMES_CZ[i],
             "avg": round(avg[i], 1),
             "min_p05": round(p05[i], 1),
             "max_p95": round(p95[i], 1)}
            for i in range(12)
        ]

    def _degree_days(self) -> Dict[str, Any]:
        """group_by_month() + vektorizovaný HDD/CDD."""
        hdd_base, cdd_base = 18.0, 21.0
        vals = list(self._temp.values)
        grouped = self._temp.group_by_month()

        months = []
        idx = 0
        for i in range(12):
            n = len(grouped[i + 1])
            chunk = vals[idx:idx + n]
            hdd = sum(max(0.0, hdd_base - t) for t in chunk) / 24.0
            cdd = sum(max(0.0, t - cdd_base) for t in chunk) / 24.0
            months.append({
                "month": i + 1, "name": MONTH_NAMES_CZ[i],
                "hdd": round(hdd, 1), "cdd": round(cdd, 1),
            })
            idx += n

        return {
            "hdd_base": hdd_base, "cdd_base": cdd_base,
            "annual_hdd": round(sum(m["hdd"] for m in months), 1),
            "annual_cdd": round(sum(m["cdd"] for m in months), 1),
            "months": months,
        }

    def _heatmap(self) -> Dict[str, Any]:
        grouped = self._temp.average_monthly_per_hour()
        matrix = [
            [round(grouped[mi * 24 + h], 1) for h in range(24)]
            for mi in range(12)
        ]
        flat = [v for row in matrix for v in row]
        return {
            "matrix": matrix, "months": MONTH_NAMES_CZ,
            "hours": list(range(24)),
            "min_value": round(min(flat), 1),
            "max_value": round(max(flat), 1),
        }

    def _diurnal_profiles(self) -> Dict[str, Any]:
        """Typický den leden vs červenec — filter + průměr per hodina."""
        profiles = {}
        for month, key in [(1, "january"), (7, "july")]:
            ap = AnalysisPeriod(month, 1, 0, month, 31, 23)
            data = list(self._temp.filter_by_analysis_period(ap).values)
            days = len(data) // 24
            hourly = [
                round(sum(data[d * 24 + h] for d in range(days) if d * 24 + h < len(data)) / days, 1)
                for h in range(24)
            ]
            profiles[key] = {
                "name": MONTH_NAMES_CZ[month - 1],
                "temperatures": hourly,
            }
        return profiles

    def _climate_zone(self) -> str:
        return self._epw.ashrae_climate_zone

    def _annual_summary(self) -> Dict[str, Any]:
        vals = list(self._temp.values)
        n = len(vals)
        comfort = len(list(self._temp.filter_by_conditional_statement('a >= 18 and a <= 26').values))
        frost = len(list(self._temp.filter_by_conditional_statement('a < 0').values))
        hot = len(list(self._temp.filter_by_conditional_statement('a > 30').values))
        return {
            "annual_avg": round(sum(vals) / n, 1),
            "annual_min": round(min(vals), 1),
            "annual_max": round(max(vals), 1),
            "comfort_hours": comfort,
            "comfort_pct": round(comfort / n * 100, 1),
            "frost_hours": frost,
            "hot_hours": hot,
        }