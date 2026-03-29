"""
EnergyPlus simulace s reálným HVAC — OpenStudio translation.

Honeybee/Ladybug funkce:
  - to_openstudio_sim_folder() → OSM → IDF přes OpenStudio SDK
  - run_idf() / run_osw() → spuštění simulace
  - eui_from_sql() → roční end uses, plochy (E+ 25.1+)
  - data_collections_by_output_name() → hodinové kolekce
  - total_monthly() → měsíční součty

Soubor: ladybug_be/app/services/heatpump_real/real_hp_simulator.py
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Dict, Any, List, Optional

from honeybee.model import Model
from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.run import (
    to_openstudio_sim_folder,
    run_osw, run_idf, output_energyplus_files,
)
from honeybee_energy.result.err import Err
from honeybee_energy.result.eui import eui_from_sql

from ladybug.sql import SQLiteResult
from ladybug.datacollection import HourlyContinuousCollection
from ladybug.designday import DesignDay
from ladybug.epw import EPW

logger = logging.getLogger(__name__)

HEAT_OUT = "Zone Air System Sensible Heating Energy"
COOL_OUT = "Zone Air System Sensible Cooling Energy"
SKIP_ELEC = {"Zone Lights", "Zone Electric Equipment"}


class RealHPSimulator:
    """Simulace přes OpenStudio SDK — reálný HVAC."""

    def __init__(self, epw: str, dds: List[DesignDay]):
        self._epw = epw
        self._dds = dds

    def simulate(self, model: Model) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="hp_") as tmp:
            sp = self._sim_par()
            osm, osw, idf = to_openstudio_sim_folder(
                model, tmp, epw_file=self._epw,
                sim_par=sp, enforce_rooms=True,
            )
            if idf and os.path.isfile(idf):
                self._patch_idf(idf)
                sql, _, _, _, err = run_idf(idf, self._epw)
            elif osw:
                _, idf2 = run_osw(osw, measures_only=False)
                if not idf2 or not os.path.isfile(idf2):
                    raise FileNotFoundError("OS CLI: no IDF")
                self._patch_idf(idf2)
                sql, _, _, _, err = output_energyplus_files(
                    os.path.dirname(idf2))
            else:
                raise FileNotFoundError("No IDF/OSW")
            if err and os.path.isfile(err):
                eo = Err(err)
                for s in eo.severe_errors:
                    logger.error("SEVERE: %s", s)
                if eo.fatal_errors:
                    d = "\n".join(eo.severe_errors[:5])
                    raise RuntimeError(f"E+ FATAL:\n{d}")
            if not sql or not os.path.isfile(sql):
                raise FileNotFoundError("E+ SQL chybí")
            return self._parse(sql)

    def _sim_par(self) -> SimulationParameter:
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
                epw.approximate_design_day('WinterDesignDay'),
                epw.approximate_design_day('SummerDesignDay'),
            ]
        return sp

    def _parse(self, sql_path: str) -> Dict[str, Any]:
        sql = SQLiteResult(sql_path)
        avail = sql.available_outputs
        logger.info("Výstupy (%d): %s", len(avail), avail)

        # Hodinové kolekce → teplo a chlad dodané do zón
        h = self._merge_output(sql, avail, HEAT_OUT)
        c = self._merge_output(sql, avail, COOL_OUT)
        e = self._merge_hvac_elec(sql, avail)
        ht = sum(h.values) if h else 0.0
        ct = sum(c.values) if c else 0.0
        et = sum(e.values) if e else 0.0

        # eui_from_sql jako doplněk (roční souhrn)
        eui = self._try_eui(sql_path)

        logger.info("heat=%.0f cool=%.0f elec=%.0f", ht, ct, et)
        return {
            "total_heating_kwh": round(ht, 1),
            "total_cooling_kwh": round(ct, 1),
            "total_electricity_kwh": round(et, 1),
            "monthly_heating_kwh": self._mo(h),
            "monthly_cooling_kwh": self._mo(c),
            "monthly_electricity_kwh": self._mo(e),
            "eui": eui,
            "available_outputs": avail,
        }

    def _merge_output(
        self, sql: SQLiteResult, avail: list, name: str,
    ) -> Optional[HourlyContinuousCollection]:
        """Sečte kolekce všech zón pro jeden output."""
        if name not in avail:
            return None
        try:
            colls = sql.data_collections_by_output_name(name)
            if not colls:
                return None
            merged = colls[0]
            for c in colls[1:]:
                merged = merged + c
            logger.info("'%s': Σ=%.0f kWh", name, sum(merged.values))
            return merged
        except Exception as e:
            logger.warning("'%s': %s", name, e)
            return None

    def _merge_hvac_elec(
        self, sql: SQLiteResult, avail: list,
    ) -> Optional[HourlyContinuousCollection]:
        """HVAC elektřina — bez osvětlení a spotřebičů."""
        names = [
            n for n in avail
            if ("Electricity" in n or "Electric" in n)
            and not any(s in n for s in SKIP_ELEC)
        ]
        merged = None
        for name in names:
            try:
                for c in sql.data_collections_by_output_name(name):
                    merged = c if merged is None else merged + c
            except Exception:
                continue
        if merged:
            logger.info("HVAC elec: Σ=%.0f kWh", sum(merged.values))
        return merged

    @staticmethod
    def _try_eui(sql_path: str) -> Optional[Dict]:
        try:
            return eui_from_sql(sql_path)
        except Exception as e:
            logger.warning("eui_from_sql: %s", e)
            return None

    @staticmethod
    def _mo(coll: Optional[HourlyContinuousCollection]) -> List[float]:
        if coll is None:
            return [0.0] * 12
        return [round(v, 1) for v in coll.total_monthly().values]

    @staticmethod
    def _patch_idf(idf_path: str) -> None:
        """Odstraní pole nekompatibilní se starším E+."""
        with open(idf_path, "r") as f:
            lines = f.readlines()
        remove = {"Density Basis", "Type of Space Sum to Use"}
        skip = set()
        for i, line in enumerate(lines):
            if any(r in line for r in remove):
                skip.add(i)
        if not skip:
            return
        out = []
        for i, line in enumerate(lines):
            if i in skip:
                if out:
                    prev = out[-1].rstrip("\n")
                    idx = prev.rfind(",")
                    if idx >= 0:
                        out[-1] = prev[:idx] + ";" + prev[idx+1:] + "\n"
                continue
            out.append(line)
        with open(idf_path, "w") as f:
            f.writelines(out)
        logger.info("IDF patched: %d fields removed", len(skip))