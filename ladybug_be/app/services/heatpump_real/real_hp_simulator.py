"""
EnergyPlus simulace s realnym HVAC — FCU ASHP / WSHP GSHP.

Honeybee/Ladybug funkce:
  - to_openstudio_sim_folder() -> IDF pres OpenStudio
  - run_idf() -> spusteni E+ simulace
  - SimulationOutput.add_hvac_energy_use()
      -> presny seznam HVAC outputu
  - SQLiteResult + data_collections_by_output_name()
      -> hodinove kolekce (uz v kWh!)
  - HourlyContinuousCollection + operator -> soucet zon
  - collection.total_monthly() -> mesicni soucty
  - Err() -> parsovani E+ error logu

Soubor: ladybug_be/app/services/heatpump_real/real_hp_simulator.py
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Dict, Any, List, Optional

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
from ladybug.datacollection import (
    HourlyContinuousCollection,
)
from ladybug.designday import DesignDay
from ladybug.epw import EPW

logger = logging.getLogger(__name__)

HEAT_OUT = "Zone Air System Sensible Heating Energy"
COOL_OUT = "Zone Air System Sensible Cooling Energy"

# Outputy specificky pro tepelne cerpadlo
HP_ELEC_OUTPUTS = [
    "Hot_Water_Loop_Central_Air_Source_Heat_Pump"
    " Electricity Consumption",
    "Cooling Coil Electricity Energy",
    "Heating Coil Electricity Energy",
    "VRF Heat Pump Cooling Electricity Energy",
    "VRF Heat Pump Heating Electricity Energy",
    "VRF Heat Pump Defrost Electricity Energy",
    "VRF Heat Pump Crankcase Heater Electricity"
    " Energy",
    "Zone VRF Air Terminal Cooling Electricity"
    " Energy",
    "Zone VRF Air Terminal Heating Electricity"
    " Energy",
    "Chiller Electricity Energy",
    "Chiller Heater System Cooling Electricity"
    " Energy",
    "Chiller Heater System Heating Electricity"
    " Energy",
]

# Pomocne HVAC (ventilatory, cerpadla, backup)
AUX_ELEC_OUTPUTS = [
    "Fan Electricity Energy",
    "Pump Electricity Energy",
    "Cooling Tower Fan Electricity Energy",
    "Baseboard Electricity Energy",
    "Humidifier Electricity Energy",
    "Evaporative Cooler Electricity Energy",
    "Boiler Electricity Energy",
]


class RealHPSimulator:
    """Simulace pres OpenStudio — ASHP/GSHP."""

    def __init__(self, epw: str, dds: List[DesignDay]):
        self._epw = epw
        self._dds = dds

    def simulate(self, model: Model) -> Dict[str, Any]:
        """Spusti E+ a vrati vysledky s rozpadem."""
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
            sql, _, _, _, err = run_idf(
                idf, self._epw,
            )
            self._check_err(err)
            if not sql or not os.path.isfile(sql):
                raise FileNotFoundError("E+ SQL chybi")
            return self._read_results(sql)

    # -- SimulationParameter --

    def _build_sim_par(self) -> SimulationParameter:
        sp = SimulationParameter()
        sp.output.include_sqlite = True
        sp.output.add_hvac_energy_use()
        sp.output.add_zone_energy_use()
        sp.output.add_output(HEAT_OUT)
        sp.output.add_output(COOL_OUT)
        if self._dds:
            sp.sizing_parameter.design_days = self._dds
        else:
            epw = EPW(self._epw)
            sp.sizing_parameter.design_days = [
                epw.approximate_design_day(
                    "WinterDesignDay",
                ),
                epw.approximate_design_day(
                    "SummerDesignDay",
                ),
            ]
        return sp

    # -- Cteni vysledku --

    def _read_results(
        self, sql_path: str,
    ) -> Dict[str, Any]:
        """Precte SQL a vrati vysledky s rozpadem."""
        sql = SQLiteResult(sql_path)
        avail = sql.available_outputs

        # DIAGNOSTIKA — print do terminalu
        print(f"\n{'='*70}")
        print(f"E+ OUTPUTS ({len(avail)}):")
        print(f"{'='*70}")
        for o in sorted(avail):
            try:
                colls = (
                    sql.data_collections_by_output_name(o)
                )
                total = sum(
                    sum(c.values) for c in colls
                )
                z = len(colls)
                print(
                    f"  {o:55s} "
                    f"{z:2d}z {total:10.0f} kWh"
                )
            except Exception:
                print(f"  {o:55s}  (error)")
        print(f"{'='*70}")

        heating = self._sum_zones(sql, avail, HEAT_OUT)
        cooling = self._sum_zones(sql, avail, COOL_OUT)
        hp_elec, hp_bkd = self._sum_outputs(
            sql, avail, HP_ELEC_OUTPUTS, "HP",
        )
        aux_elec, aux_bkd = self._sum_outputs(
            sql, avail, AUX_ELEC_OUTPUTS, "AUX",
        )

        ht = sum(heating.values) if heating else 0.0
        ct = sum(cooling.values) if cooling else 0.0
        hp_e = (
            sum(hp_elec.values) if hp_elec else 0.0
        )
        ax_e = (
            sum(aux_elec.values) if aux_elec else 0.0
        )
        total_e = hp_e + ax_e

        # DIAGNOSTIKA — souhrn
        print(f"\nRESULT:")
        print(f"  Heating:   {ht:10.0f} kWh")
        print(f"  Cooling:   {ct:10.0f} kWh")
        print(f"  HP elec:   {hp_e:10.0f} kWh")
        print(f"  AUX elec:  {ax_e:10.0f} kWh")
        print(f"  Total:     {total_e:10.0f} kWh")
        thermal = ht + ct
        if total_e > 0:
            print(f"  Sys COP:   {thermal/total_e:.2f}")
        if hp_e > 0:
            print(f"  HP COP:    {thermal/hp_e:.2f}")
        print()

        return {
            "total_heating_kwh": round(ht, 1),
            "total_cooling_kwh": round(ct, 1),
            "total_electricity_kwh": round(
                total_e, 1,
            ),
            "hp_electricity_kwh": round(hp_e, 1),
            "aux_electricity_kwh": round(ax_e, 1),
            "monthly_heating_kwh": self._monthly(
                heating,
            ),
            "monthly_cooling_kwh": self._monthly(
                cooling,
            ),
            "monthly_electricity_kwh": (
                self._monthly_sum(hp_elec, aux_elec)
            ),
            "monthly_hp_elec_kwh": self._monthly(
                hp_elec,
            ),
            "monthly_aux_elec_kwh": self._monthly(
                aux_elec,
            ),
            "available_outputs": avail,
            "hp_breakdown": hp_bkd,
            "aux_breakdown": aux_bkd,
        }

    def _sum_zones(
        self, sql: SQLiteResult, avail: list,
        name: str,
    ) -> Optional[HourlyContinuousCollection]:
        """Secte kolekce vsech zon pro output."""
        if name not in avail:
            return None
        colls = sql.data_collections_by_output_name(
            name,
        )
        if not colls:
            return None
        merged = colls[0]
        for c in colls[1:]:
            merged = merged + c
        return merged

    def _sum_outputs(
        self,
        sql: SQLiteResult,
        avail: list,
        output_list: list,
        label: str,
    ) -> tuple:
        """Secte vice outputu + vrati breakdown."""
        merged = None
        breakdown = {}
        for name in output_list:
            if name not in avail:
                continue
            colls = sql.data_collections_by_output_name(
                name,
            )
            sub = 0.0
            for c in colls:
                sub += sum(c.values)
                if merged is None:
                    merged = c
                else:
                    merged = merged + c
            breakdown[name] = round(sub, 1)
            print(
                f"  {label}: {name:45s} "
                f"= {sub:10.0f} kWh"
            )
        return merged, breakdown

    @staticmethod
    def _monthly(
        coll: Optional[HourlyContinuousCollection],
    ) -> List[float]:
        if coll is None:
            return [0.0] * 12
        monthly = coll.total_monthly()
        return [round(v, 1) for v in monthly.values]

    @staticmethod
    def _monthly_sum(
        a: Optional[HourlyContinuousCollection],
        b: Optional[HourlyContinuousCollection],
    ) -> List[float]:
        if a is None and b is None:
            return [0.0] * 12
        if a is None:
            return RealHPSimulator._monthly(b)
        if b is None:
            return RealHPSimulator._monthly(a)
        total = a + b
        monthly = total.total_monthly()
        return [round(v, 1) for v in monthly.values]

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
        """Odstrani pole pro novejsi E+ verze."""
        with open(
            idf_path, "r", encoding="utf-8",
        ) as f:
            lines = f.readlines()
        remove = {
            "Density Basis",
            "Type of Space Sum to Use",
        }
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
                            prev[:comma] + ";" + rest
                            + "\n"
                        )
                continue
            result.append(line)
        with open(
            idf_path, "w", encoding="utf-8",
        ) as f:
            f.writelines(result)
        logger.info(
            "IDF patched: %d fields removed",
            len(skip),
        )