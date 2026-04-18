"""
Teplotní analýza z EPW — maximální využití Ladybug API, bez fallbacků.

Použité moduly a funkce:
  - ladybug.epw.EPW (dry_bulb_temperature, ashrae_climate_zone)
  - HourlyContinuousCollection
        average_monthly(), percentile_monthly()
        average_monthly_per_hour()
        group_by_month()
        properties .average, .min, .max, .values

Soubor: ladybug_be/app/services/temperature_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.epw import EPW

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
            {
                "month": i + 1,
                "name": MONTH_NAMES_CZ[i],
                "avg": round(avg[i], 1),
                "min_p05": round(p05[i], 1),
                "max_p95": round(p95[i], 1),
            }
            for i in range(12)
        ]

    def _degree_days(self) -> Dict[str, Any]:
        """HDD a CDD za každý měsíc přes group_by_month().

        group_by_month() vrací slovník {1: [hodnoty ledna], 2: [hodnoty února], ...},
        takže odpadá manuální krájení plochého listu podle velikostí bloků.
        """
        hdd_base, cdd_base = 18.0, 21.0
        grouped = self._temp.group_by_month()

        months = []
        for i in range(12):
            chunk = list(grouped[i + 1])
            hdd = sum(max(0.0, hdd_base - t) for t in chunk) / 24.0
            cdd = sum(max(0.0, t - cdd_base) for t in chunk) / 24.0
            months.append({
                "month": i + 1,
                "name": MONTH_NAMES_CZ[i],
                "hdd": round(hdd, 1),
                "cdd": round(cdd, 1),
            })

        return {
            "hdd_base": hdd_base,
            "cdd_base": cdd_base,
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
            "matrix": matrix,
            "months": MONTH_NAMES_CZ,
            "hours": list(range(24)),
            "min_value": round(min(flat), 1),
            "max_value": round(max(flat), 1),
        }

    def _diurnal_profiles(self) -> Dict[str, Any]:
        """Typický den leden vs červenec přes average_monthly_per_hour().

        Metoda vrací 12 * 24 = 288 hodnot uspořádaných jako
        [led 0h, led 1h, ..., led 23h, úno 0h, ..., pro 23h].
        Leden = indexy 0..23, červenec = indexy 144..167.
        Původní verze filtrovala přes AnalysisPeriod a ručně průměrovala —
        to je přesně to, co average_monthly_per_hour dělá interně za nás.
        """
        per_hour = list(self._temp.average_monthly_per_hour())
        return {
            "january": {
                "name": MONTH_NAMES_CZ[0],
                "temperatures": [round(v, 1) for v in per_hour[0:24]],
            },
            "july": {
                "name": MONTH_NAMES_CZ[6],
                "temperatures": [round(v, 1) for v in per_hour[144:168]],
            },
        }

    def _climate_zone(self) -> str:
        return self._epw.ashrae_climate_zone

    def _annual_summary(self) -> Dict[str, Any]:
        """Roční souhrn.

        Průměr/minimum/maximum přes nativní properties kolekce
        (.average, .min, .max), které Ladybug počítá interně
        nad celou analysis_period. Počty komfortních, mrazových
        a horkých hodin přes jednu iteraci hodnot, aby se
        zabránilo potenciálně prázdným filtrovaným kolekcím
        (filter_by_conditional_statement vyhodí výjimku,
        pokud žádná hodina podmínku nesplňuje).
        """
        vals = list(self._temp.values)
        n = len(vals)
        comfort = sum(1 for t in vals if 18 <= t <= 26)
        frost = sum(1 for t in vals if t < 0)
        hot = sum(1 for t in vals if t > 30)
        return {
            "annual_avg": round(self._temp.average, 1),
            "annual_min": round(self._temp.min, 1),
            "annual_max": round(self._temp.max, 1),
            "comfort_hours": comfort,
            "comfort_pct": round(comfort / n * 100, 1),
            "frost_hours": frost,
            "hot_hours": hot,
        }