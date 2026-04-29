"""
EnergyPlus simulace s realnym HVAC — orchestrator.

Pripravuje SimulationParameter, generuje IDF pres OpenStudio,
injektuje end-use metery, spousti E+ a deleguje cteni vysledku
na RealHPResultsReader.

Patch _patch_idf_for_compat resi jen kompatibilitu IDF poli
nepodporovanych cilovou E+ verzi (Density Basis, Type of Space
Sum to Use). Neni to logicky patch.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_simulator.py
"""
from __future__ import annotations

import logging
import os
import shutil
import tempfile
import time
from typing import Dict, Any, List, Optional, Callable

from honeybee.model import Model
from honeybee_energy.simulation.parameter import (
    SimulationParameter,
)
from honeybee_energy.run import (
    to_openstudio_sim_folder,
    run_idf,
)
from honeybee_energy.result.err import Err

from ladybug.designday import DesignDay
from ladybug.epw import EPW

from .real_hp_results_reader import (
    RealHPResultsReader, HEAT_OUT, COOL_OUT, ALL_METERS,
)
from ..pv_ep_runner import run_ep_with_progress

logger = logging.getLogger(__name__)


class RealHPSimulator:
    """Spusti EnergyPlus simulaci a vrati strukturovane vysledky."""

    def __init__(self, epw: str, dds: List[DesignDay]):
        self._epw = epw
        self._dds = dds

    def simulate(
        self,
        model: Model,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> Dict[str, Any]:
        with tempfile.TemporaryDirectory(prefix="hp_real_") as tmp:
            sp = self._build_sim_par()
            osm, osw, idf = to_openstudio_sim_folder(
                model, tmp, epw_file=self._epw,
                sim_par=sp, enforce_rooms=True,
            )
            if not idf or not os.path.isfile(idf):
                raise FileNotFoundError(
                    "OpenStudio nevygenerovalo IDF",
                )
            os.makedirs(r"C:\debug", exist_ok=True)
            ts = int(time.time() * 1000)
            shutil.copy(idf, fr"C:\debug\hp_real_{ts}_pre.idf")
            self._patch_idf_for_compat(idf)
            self._inject_meters(idf)
            shutil.copy(idf, fr"C:\debug\hp_real_{ts}.idf")
            if on_progress is not None:
                sql, err = run_ep_with_progress(
                    idf, self._epw, on_progress,
                )
            else:
                sql, _, _, _, err = run_idf(idf, self._epw)
            self._check_err(err)
            if not sql or not os.path.isfile(sql):
                raise FileNotFoundError("E+ SQL chybi")
            return RealHPResultsReader().read(sql)

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

    @staticmethod
    def _inject_meters(idf_path: str) -> None:
        """Prida Output:Meter direktivy na konec IDF."""
        meter_block = "\n".join(
            f"Output:Meter,{name},Hourly;"
            for name in ALL_METERS
        )
        with open(idf_path, "a", encoding="utf-8") as f:
            f.write(
                "\n\n!- Injected end-use meters\n"
                + meter_block + "\n",
            )
        logger.info(
            "IDF: %d metery injektovany", len(ALL_METERS),
        )

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

    @staticmethod
    def _patch_idf_for_compat(idf_path: str) -> None:
        """Odstrani IDF pole nepodporovana cilovou E+ verzi."""
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