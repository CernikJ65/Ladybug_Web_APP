"""
EnergyPlus simulace s realnym HVAC.

Misto neuplneho vycitani Output:Variable pouziva EnergyPlus
end-use METERY, ktere agreguji elektrinu po funkcich:
  - Heating:Electricity     — vse pro topeni (HP, el. backup)
  - Cooling:Electricity     — vse pro chlazeni (chiller, DX)
  - Fans:Electricity        — vsechny ventilatory
  - Pumps:Electricity       — vsechna cerpadla
  - HeatRejection:Electricity — chladici veze

Honeybee neposkytuje API pro Output:Meter, proto se injektuje
primo do IDF pred spustenim run_idf(). Ladybug SQLiteResult
cte metery stejnou metodou jako variables.

Thermal dodavka ze Ladybug funkce:
  Zone Air System Sensible Heating Energy
  Zone Air System Sensible Cooling Energy

Soubor: ladybug_be/app/services/heatpump_real/real_hp_simulator.py
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Dict, Any, List, Optional, Tuple

from honeybee.model import Model
from honeybee_energy.simulation.parameter import (
    SimulationParameter,
)
from honeybee_energy.run import (
    to_openstudio_sim_folder,
    run_idf,
)
from honeybee_energy.result.err import Err

from ladybug.sql import SQLiteResult
from ladybug.datacollection import HourlyContinuousCollection
from ladybug.designday import DesignDay
from ladybug.epw import EPW

logger = logging.getLogger(__name__)

# Thermal dodavka do zon
HEAT_OUT = "Zone Air System Sensible Heating Energy"
COOL_OUT = "Zone Air System Sensible Cooling Energy"

# End-use metery (EnergyPlus standard)
METER_HEATING = "Heating:Electricity"
METER_COOLING = "Cooling:Electricity"
METER_FANS = "Fans:Electricity"
METER_PUMPS = "Pumps:Electricity"
METER_HEATREJ = "HeatRejection:Electricity"

ALL_METERS: Tuple[str, ...] = (
    METER_HEATING, METER_COOLING,
    METER_FANS, METER_PUMPS, METER_HEATREJ,
)


class RealHPSimulator:
    """Spusti EnergyPlus simulaci a vrati rocni + mesicni sumy."""

    def __init__(self, epw: str, dds: List[DesignDay]):
        self._epw = epw
        self._dds = dds

    def simulate(self, model: Model) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(
            prefix="hp_real_",
        ) as tmp:
            sp = self._build_sim_par()
            osm, osw, idf = to_openstudio_sim_folder(
                model, tmp, epw_file=self._epw,
                sim_par=sp, enforce_rooms=True,
            )
            if not idf or not os.path.isfile(idf):
                raise FileNotFoundError(
                    "OpenStudio nevygenerovalo IDF"
                )
            self._patch_idf_for_compat(idf)
            self._inject_meters(idf)
            sql, _, _, _, err = run_idf(idf, self._epw)
            self._check_err(err)
            if not sql or not os.path.isfile(sql):
                raise FileNotFoundError("E+ SQL chybi")
            return self._read_results(sql)

    # -- SimulationParameter --

    def _build_sim_par(self) -> SimulationParameter:
        sp = SimulationParameter()
        sp.output.include_sqlite = True
        sp.output.add_output(HEAT_OUT)
        sp.output.add_output(COOL_OUT)
        if self._dds:
            sp.sizing_parameter.design_days = self._dds
        else:
            epw = EPW(self._epw)
            sp.sizing_parameter.design_days = [
                epw.approximate_design_day("WinterDesignDay"),
                epw.approximate_design_day("SummerDesignDay"),
            ]
        return sp

    # -- IDF meter injection --

    @staticmethod
    def _inject_meters(idf_path: str) -> None:
        """Prida Output:Meter direktivy na konec IDF.

        EnergyPlus uklada meter data do SQL ReportDataDictionary
        a Ladybug je cte stejnou cestou jako Output:Variable.
        """
        meter_block = "\n".join(
            f"Output:Meter,{name},Hourly;"
            for name in ALL_METERS
        )
        with open(idf_path, "a", encoding="utf-8") as f:
            f.write(
                "\n\n!- Injected end-use meters\n"
                + meter_block + "\n",
            )
        logger.info("IDF: %d metery injektovany", len(ALL_METERS))

    # -- Cteni vysledku --

    def _read_results(self, sql_path: str) -> Dict[str, Any]:
        sql = SQLiteResult(sql_path)
        avail = sql.available_outputs

        heating = self._sum_output(sql, avail, HEAT_OUT)
        cooling = self._sum_output(sql, avail, COOL_OUT)

        meters = {
            name: self._sum_output(sql, avail, name)
            for name in ALL_METERS
        }
        total_elec = self._sum_collections(list(meters.values()))

        ht = heating.total if heating else 0.0
        ct = cooling.total if cooling else 0.0
        total_e = total_elec.total if total_elec else 0.0
        heat_e = meters[METER_HEATING].total if meters[METER_HEATING] else 0.0
        cool_e = meters[METER_COOLING].total if meters[METER_COOLING] else 0.0
        fan_e = meters[METER_FANS].total if meters[METER_FANS] else 0.0
        pump_e = meters[METER_PUMPS].total if meters[METER_PUMPS] else 0.0
        hr_e = meters[METER_HEATREJ].total if meters[METER_HEATREJ] else 0.0

        self._log_summary(
            ht, ct, heat_e, cool_e, fan_e, pump_e, hr_e, total_e,
        )

        return {
            "annual_heating_kwh": round(ht, 1),
            "annual_cooling_kwh": round(ct, 1),
            "annual_electricity_kwh": round(total_e, 1),
            "annual_heat_elec_kwh": round(heat_e, 1),
            "annual_cool_elec_kwh": round(cool_e, 1),
            "annual_fan_elec_kwh": round(fan_e, 1),
            "annual_pump_elec_kwh": round(pump_e, 1),
            "annual_heatrej_elec_kwh": round(hr_e, 1),
            "monthly_heating_kwh": self._monthly(heating),
            "monthly_cooling_kwh": self._monthly(cooling),
            "monthly_electricity_kwh": self._monthly(total_elec),
            "monthly_heat_elec_kwh": self._monthly(
                meters[METER_HEATING],
            ),
            "monthly_cool_elec_kwh": self._monthly(
                meters[METER_COOLING],
            ),
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

    # -- Diagnostika --

    @staticmethod
    def _log_summary(
        ht: float, ct: float,
        heat_e: float, cool_e: float,
        fan_e: float, pump_e: float, hr_e: float,
        total_e: float,
    ) -> None:
        print(f"\n{'='*70}")
        print("VYSLEDKY SIMULACE (end-use metery):")
        print(f"  Teplo dodane:          {ht:10.0f} kWh")
        print(f"  Chlad dodany:          {ct:10.0f} kWh")
        print(f"  -- Elektrina po meterech --")
        print(f"  Heating:Electricity    {heat_e:10.0f} kWh  (kompresor + backup topeni)")
        print(f"  Cooling:Electricity    {cool_e:10.0f} kWh  (chiller/DX chlazeni)")
        print(f"  Fans:Electricity       {fan_e:10.0f} kWh  (ventilatory)")
        print(f"  Pumps:Electricity      {pump_e:10.0f} kWh  (cerpadla)")
        print(f"  HeatRejection:Elec     {hr_e:10.0f} kWh  (chladici vez)")
        print(f"  CELKEM:                {total_e:10.0f} kWh")
        if total_e > 0:
            print(f"  COP celorocni:         {(ht+ct)/total_e:.2f}")
        if heat_e > 0:
            print(f"  COP topeni:            {ht/heat_e:.2f}")
        if cool_e > 0:
            print(f"  COP chlazeni (EER):    {ct/cool_e:.2f}")
        print(f"{'='*70}\n")

    # -- Error handling --

    @staticmethod
    def _check_err(err_path: Optional[str]) -> None:
        if not err_path or not os.path.isfile(err_path):
            return
        eo = Err(err_path)
        for s in eo.severe_errors:
            logger.error("E+ SEVERE: %s", s)
        if eo.fatal_errors:
            detail = "\n".join(eo.severe_errors[:5])
            raise RuntimeError(f"E+ FATAL:\n{detail}")

    # -- IDF kompatibilita --

    @staticmethod
    def _patch_idf_for_compat(idf_path: str) -> None:
        with open(idf_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        remove = {"Density Basis", "Type of Space Sum to Use"}
        skip = set()
        for i, line in enumerate(lines):
            if any(r in line for r in remove):
                skip.add(i)
        if not skip:
            return
        result = []
        for i, line in enumerate(lines):
            if i in skip:
                if result:
                    prev = result[-1].rstrip("\n")
                    comma = prev.rfind(",")
                    if comma >= 0:
                        rest = prev[comma + 1:]
                        result[-1] = (
                            prev[:comma] + ";" + rest + "\n"
                        )
                continue
            result.append(line)
        with open(idf_path, "w", encoding="utf-8") as f:
            f.writelines(result)
        logger.info(
            "IDF patched: %d fields removed", len(skip),
        )