"""
Cte E+ SQL a vraci celkovou spotrebu budovy + breakdown na 7 meteru.

Metery (vsech 7, i kdyz nejake zustanou nulove):
  Heating:Electricity        — kompresor TC + el. doohrev
  Cooling:Electricity        — chlazeni (heating_only=True -> 0)
  Fans:Electricity           — ventilatory FCU/DOAS
  Pumps:Electricity          — obehova cerpadla
  HeatRejection:Electricity  — coolingtower (zde 0)
  InteriorLights:Electricity — osvetleni (z programu MidriseApartment)
  InteriorEquipment:Electricity — zasuvky (z programu MidriseApartment)

Mesicni hodnoty cteme nativne pres HourlyContinuousCollection.total_monthly().

Soubor: ladybug_be/app/services/ped_optimizer/consumption_results_reader.py
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional, Tuple

from ladybug.sql import SQLiteResult
from ladybug.datacollection import HourlyContinuousCollection

logger = logging.getLogger(__name__)

METER_HEATING = "Heating:Electricity"
METER_COOLING = "Cooling:Electricity"
METER_FANS = "Fans:Electricity"
METER_PUMPS = "Pumps:Electricity"
METER_HEAT_REJ = "HeatRejection:Electricity"
METER_LIGHTS = "InteriorLights:Electricity"
METER_EQUIPMENT = "InteriorEquipment:Electricity"

ALL_METERS: Tuple[str, ...] = (
    METER_HEATING, METER_COOLING,
    METER_FANS, METER_PUMPS, METER_HEAT_REJ,
    METER_LIGHTS, METER_EQUIPMENT,
)

# Tepelna dodavka do zon (HEAT_OUT) — neni meter, ale zone-level output.
# Sluzi pro vypocet SCOP TC (heat_delivered / heating_electricity).
HEAT_OUT = "Zone Air System Sensible Heating Energy"

BREAKDOWN_KEYS = {
    METER_HEATING: "heating",
    METER_COOLING: "cooling",
    METER_FANS: "fans",
    METER_PUMPS: "pumps",
    METER_HEAT_REJ: "heat_rejection",
    METER_LIGHTS: "lights",
    METER_EQUIPMENT: "equipment",
}


class ConsumptionResultsReader:
    """Vrati strukturovany dict {annual_kwh, monthly_kwh}."""

    def read(self, sql_path: str) -> Dict[str, Any]:
        sql = SQLiteResult(sql_path)
        avail = sql.available_outputs

        meters: Dict[str, Optional[HourlyContinuousCollection]] = {
            n: self._sum_output(sql, avail, n) for n in ALL_METERS
        }

        annual: Dict[str, float] = {}
        monthly: Dict[str, List[float]] = {}
        for name in ALL_METERS:
            key = BREAKDOWN_KEYS[name]
            coll = meters[name]
            annual[key] = round(coll.total, 1) if coll else 0.0
            monthly[key] = self._monthly(coll)

        annual["total"] = round(sum(annual.values()), 1)
        monthly["total"] = [
            round(sum(monthly[k][m] for k in BREAKDOWN_KEYS.values()), 1)
            for m in range(12)
        ]

        # Dodane teplo do zon (per-zone -> sum). Podklad pro SCOP TC.
        heat_coll = self._sum_output(sql, avail, HEAT_OUT)
        heat_delivered_annual = (
            round(heat_coll.total, 1) if heat_coll else 0.0
        )
        heat_delivered_monthly = self._monthly(heat_coll)

        self._log(annual, heat_delivered_annual)

        return {
            "annual_kwh": annual,
            "monthly_kwh": monthly,
            "heating_delivered_kwh": {
                "annual": heat_delivered_annual,
                "monthly": heat_delivered_monthly,
            },
        }

    @staticmethod
    def _sum_output(
        sql: SQLiteResult, avail: list, name: str,
    ) -> Optional[HourlyContinuousCollection]:
        if name not in avail:
            return None
        colls = sql.data_collections_by_output_name(name)
        if not colls:
            return None
        merged = colls[0]
        for c in colls[1:]:
            merged = merged + c
        return merged

    @staticmethod
    def _monthly(
        coll: Optional[HourlyContinuousCollection],
    ) -> List[float]:
        if coll is None:
            return [0.0] * 12
        return [round(v, 1) for v in coll.total_monthly().values]

    @staticmethod
    def _log(annual: Dict[str, float], heat_delivered: float) -> None:
        print(f"\n{'='*70}")
        print("PED konzumace — rocni breakdown:")
        for k in (
            "heating", "cooling", "fans", "pumps", "heat_rejection",
            "lights", "equipment",
        ):
            print(f"  {k:18s} {annual.get(k, 0.0):10.0f} kWh")
        print(f"  {'CELKEM':18s} {annual.get('total', 0.0):10.0f} kWh")
        print(f"  {'Teplo do zon':18s} {heat_delivered:10.0f} kWh")
        heat_e = annual.get("heating", 0.0)
        if heat_e > 0:
            print(
                f"  {'SCOP topeni':18s} {heat_delivered/heat_e:10.2f}",
            )
        print(f"{'='*70}\n")
