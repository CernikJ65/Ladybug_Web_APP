"""
Cteni vysledku z EnergyPlus SQL pro Real HP simulaci.

Agreguje:
  - Thermal dodavku do zon (HEAT_OUT, COOL_OUT) — celkem + per-zone
  - End-use elektrinu HVAC (Heating/Cooling/Fans/Pumps/HeatRejection)
  - Aux elektrinu (InteriorLights/InteriorEquipment/WaterSystems)
  - Kontrolni soucet Electricity:Facility

Per-zone hodnoty se mapuji pres metadata.System (ASHRAE konvence
v EnergyPlus output schemata).

Soubor: ladybug_be/app/services/heatpump_real/real_hp_results_reader.py
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional, Tuple

from ladybug.sql import SQLiteResult
from ladybug.datacollection import HourlyContinuousCollection

logger = logging.getLogger(__name__)

HEAT_OUT = "Zone Air System Sensible Heating Energy"
COOL_OUT = "Zone Air System Sensible Cooling Energy"

METER_HEATING = "Heating:Electricity"
METER_COOLING = "Cooling:Electricity"
METER_FANS = "Fans:Electricity"
METER_PUMPS = "Pumps:Electricity"
METER_HEATREJ = "HeatRejection:Electricity"
METER_LIGHTS = "InteriorLights:Electricity"
METER_EQUIPMENT = "InteriorEquipment:Electricity"
METER_WATER = "WaterSystems:Electricity"
METER_FACILITY = "Electricity:Facility"

HVAC_METERS: Tuple[str, ...] = (
    METER_HEATING, METER_COOLING,
    METER_FANS, METER_PUMPS, METER_HEATREJ,
)
AUX_METERS: Tuple[str, ...] = (
    METER_LIGHTS, METER_EQUIPMENT, METER_WATER,
    METER_FACILITY,
)
ALL_METERS: Tuple[str, ...] = HVAC_METERS + AUX_METERS


class RealHPResultsReader:
    """Cte E+ SQL a sestavuje strukturovany dict pro analyzer."""

    def read(self, sql_path: str) -> Dict[str, Any]:
        sql = SQLiteResult(sql_path)
        avail = sql.available_outputs

        heating = self._sum_output(sql, avail, HEAT_OUT)
        cooling = self._sum_output(sql, avail, COOL_OUT)
        heat_per_zone = self._per_zone_totals(sql, avail, HEAT_OUT)
        cool_per_zone = self._per_zone_totals(sql, avail, COOL_OUT)

        meters = {n: self._sum_output(sql, avail, n) for n in ALL_METERS}
        hvac_total = self._sum_collections(
            [meters[n] for n in HVAC_METERS],
        )
        elec = {
            n: (meters[n].total if meters[n] else 0.0)
            for n in ALL_METERS
        }

        ht = heating.total if heating else 0.0
        ct = cooling.total if cooling else 0.0
        hvac_e = hvac_total.total if hvac_total else 0.0

        self._log(ht, ct, elec, hvac_e)

        return {
            "annual_heating_kwh": round(ht, 1),
            "annual_cooling_kwh": round(ct, 1),
            "annual_electricity_kwh": round(hvac_e, 1),
            "annual_heat_elec_kwh": round(elec[METER_HEATING], 1),
            "annual_cool_elec_kwh": round(elec[METER_COOLING], 1),
            "annual_fans_elec_kwh": round(elec[METER_FANS], 1),
            "annual_pumps_elec_kwh": round(elec[METER_PUMPS], 1),
            "annual_heatrej_elec_kwh": round(elec[METER_HEATREJ], 1),
            "annual_lights_elec_kwh": round(elec[METER_LIGHTS], 1),
            "annual_equipment_elec_kwh": round(elec[METER_EQUIPMENT], 1),
            "annual_water_elec_kwh": round(elec[METER_WATER], 1),
            "annual_facility_elec_kwh": round(elec[METER_FACILITY], 1),
            "monthly_heating_kwh": self._monthly(heating),
            "monthly_cooling_kwh": self._monthly(cooling),
            "monthly_electricity_kwh": self._monthly(hvac_total),
            "monthly_heat_elec_kwh": self._monthly(meters[METER_HEATING]),
            "monthly_cool_elec_kwh": self._monthly(meters[METER_COOLING]),
            "heating_per_zone_kwh": heat_per_zone,
            "cooling_per_zone_kwh": cool_per_zone,
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
    def _per_zone_totals(
        sql: SQLiteResult, avail: list, name: str,
    ) -> Dict[str, float]:
        if name not in avail:
            return {}
        colls = sql.data_collections_by_output_name(name)
        out: Dict[str, float] = {}
        for c in colls:
            meta = c.header.metadata or {}
            zone = (
                meta.get('System')
                or meta.get('Zone')
                or meta.get('name', '')
            )
            if not zone:
                continue
            out[str(zone).upper()] = round(c.total, 1)
        return out

    @staticmethod
    def _sum_collections(
        colls: List[Optional[HourlyContinuousCollection]],
    ) -> Optional[HourlyContinuousCollection]:
        merged = None
        for c in colls:
            if c is None:
                continue
            merged = c if merged is None else merged + c
        return merged

    @staticmethod
    def _monthly(
        coll: Optional[HourlyContinuousCollection],
    ) -> List[float]:
        if coll is None:
            return [0.0] * 12
        return [round(v, 1) for v in coll.total_monthly().values]

    @staticmethod
    def _log(
        ht: float, ct: float, elec: Dict[str, float], hvac_e: float,
    ) -> None:
        print(f"\n{'='*70}")
        print("VYSLEDKY SIMULACE — breakdown elektriny:")
        print(f"  Teplo dodane:          {ht:10.0f} kWh")
        print(f"  Chlad dodany:          {ct:10.0f} kWh")
        print(f"  -- HVAC elektrina --")
        print(f"  Heating:Electricity    {elec[METER_HEATING]:10.0f} kWh")
        print(f"  Cooling:Electricity    {elec[METER_COOLING]:10.0f} kWh")
        print(f"  Fans:Electricity       {elec[METER_FANS]:10.0f} kWh")
        print(f"  Pumps:Electricity      {elec[METER_PUMPS]:10.0f} kWh")
        print(f"  HeatRejection:Elec     {elec[METER_HEATREJ]:10.0f} kWh")
        print(f"  HVAC CELKEM:           {hvac_e:10.0f} kWh")
        print(f"  -- AUX (mimo HVAC scope) --")
        print(f"  InteriorLights         {elec[METER_LIGHTS]:10.0f} kWh")
        print(f"  InteriorEquipment      {elec[METER_EQUIPMENT]:10.0f} kWh")
        print(f"  WaterSystems           {elec[METER_WATER]:10.0f} kWh")
        print(f"  Electricity:Facility   {elec[METER_FACILITY]:10.0f} kWh")
        if hvac_e > 0:
            print(f"  COP HVAC celorocni:    {(ht+ct)/hvac_e:.2f}")
        if elec[METER_HEATING] > 0:
            print(f"  COP topeni:            {ht/elec[METER_HEATING]:.2f}")
        if elec[METER_COOLING] > 0:
            print(f"  COP chlazeni (EER):    {ct/elec[METER_COOLING]:.2f}")
        print(f"{'='*70}\n")
