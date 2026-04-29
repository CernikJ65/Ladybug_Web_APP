"""
EnergyPlus simulace celkove spotreby budovy s realnym HVAC.

Pouziva se RealHPModelPreparer (heatpump_real) jako black-box pro
pripravu honeybee Modelu (ASHP nebo GSHP) — ten zustava netknuty.
Tady mame VLASTNI orchestraci s rozsirenym seznamem meteru.

Pattern E+ orchestrace (OpenStudio -> IDF -> inject metery -> run -> SQL)
je zamerne identicky s real_hp_simulator (zachovava se chovani),
ale ALL_METERS obsahuje 7 polozek vc. lights/equipment.

Soubor: ladybug_be/app/services/ped_optimizer/consumption_simulator.py
"""
from __future__ import annotations

import logging
import os
import shutil
import tempfile
import time
from typing import Dict, Any, List, Optional

from honeybee.model import Model
from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.run import to_openstudio_sim_folder, run_idf
from honeybee_energy.result.err import Err

from ladybug.designday import DesignDay
from ladybug.epw import EPW

from .consumption_results_reader import (
    ConsumptionResultsReader, ALL_METERS, HEAT_OUT,
)

logger = logging.getLogger(__name__)


class ConsumptionSimulator:
    """Spusti E+ simulaci a vrati spotrebu budovy s breakdown."""

    def __init__(
        self, epw: str, dds: List[DesignDay],
        heating_only: bool = True,
    ):
        self._epw = epw
        self._dds = dds
        self._heating_only = heating_only

    def simulate(self, model: Model) -> Dict[str, Any]:
        """Vrati {annual_kwh: {...}, monthly_kwh: {...}}."""
        with tempfile.TemporaryDirectory(prefix="ped_") as tmp:
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
            shutil.copy(idf, fr"C:\debug\ped_{ts}_pre.idf")
            self._patch_idf_for_compat(idf)
            if self._heating_only:
                self._patch_idf_doas_cooling(idf)
            self._patch_idf_doas_backup_heater(idf)
            self._inject_meters(idf)
            shutil.copy(idf, fr"C:\debug\ped_{ts}.idf")
            sql, _, _, _, err = run_idf(idf, self._epw)
            if sql and os.path.isfile(sql):
                shutil.copy(sql, fr"C:\debug\ped_{ts}.sql")
            if err and os.path.isfile(err):
                shutil.copy(err, fr"C:\debug\ped_{ts}.err")
            self._check_err(err)
            if not sql or not os.path.isfile(sql):
                raise FileNotFoundError("E+ SQL chybi")
            return ConsumptionResultsReader().read(sql)

    # ------------------------------------------------------------------
    # Privatni — priprava simulace
    # ------------------------------------------------------------------

    def _build_sim_par(self) -> SimulationParameter:
        sp = SimulationParameter()
        sp.output.include_sqlite = True
        # Tepelna dodavka do zon — pro SCOP vypocet (heat_delivered/heat_elec).
        sp.output.add_output(HEAT_OUT)
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
        """Prida Output:Meter direktivy pro 7 end-use kategorii."""
        meter_block = "\n".join(
            f"Output:Meter,{name},Hourly;" for name in ALL_METERS
        )
        with open(idf_path, "a", encoding="utf-8") as f:
            f.write(
                "\n\n!- Injected end-use meters (PED optimizer)\n"
                + meter_block + "\n",
            )
        logger.info(
            "PED IDF: %d meteru injektovano", len(ALL_METERS),
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
        """Stejny IDF kompat. patch jako real_hp_simulator (Density Basis)."""
        with open(idf_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        remove = {"Density Basis", "Type of Space Sum to Use"}
        skip = set()
        for i, line in enumerate(lines):
            if any(r in line for r in remove):
                skip.add(i)
        if not skip:
            return
        result: List[str] = []
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
        logger.info("IDF patched: %d fields removed", len(skip))

    @staticmethod
    def _patch_idf_doas_cooling(idf_path: str) -> None:
        """Patch A: prepise vsechny DOAS SAT Reset 'High Temp setpoint'
        z 15.56 C na 21.11 C. Hleda 'DOAS SAT Reset' v Name (substring)."""
        with open(idf_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        in_block = False
        patched = 0
        names_seen = []
        for i, line in enumerate(lines):
            if not in_block:
                if line.strip() == "SetpointManager:OutdoorAirReset,":
                    nxt = lines[i + 1] if i + 1 < len(lines) else ""
                    names_seen.append(nxt.strip())
                    if "DOAS SAT Reset" in nxt:
                        in_block = True
                continue
            if "Setpoint at Outdoor High Temperature" in line:
                comma = line.find(",")
                if comma > 0:
                    leading = line[:len(line) - len(line.lstrip())]
                    rest = line[comma:]
                    lines[i] = leading + "21.1111111111111" + rest
                    patched += 1
                in_block = False
                continue
            if line.rstrip().endswith(";"):
                in_block = False
        if patched == 0:
            if not names_seen:
                logger.info(
                    "Patch A: zadny SetpointManager:OutdoorAirReset "
                    "(neexistuje DOAS topology, ERV=0) - skip",
                )
                return
            raise ValueError(
                "Patch A: 'DOAS SAT Reset' SetpointManager:"
                "OutdoorAirReset not found in IDF. "
                f"All OutdoorAirReset Names seen: {names_seen}",
            )
        with open(idf_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        logger.info(
            "Patch A: %d DOAS SAT Reset -> 21.11 C konstantni",
            patched,
        )

    @staticmethod
    def _patch_idf_doas_backup_heater(idf_path: str) -> None:
        """Patch B: vypne DOAS backup elektricky topny coil
        (Coil:Heating:Electric s 'DOAS' v Name). NO-OP pokud
        nenajde — ASHP variant nema backup."""
        with open(idf_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        in_block = False
        is_doas = False
        patched = 0
        for i, line in enumerate(lines):
            if not in_block:
                if line.strip() == "Coil:Heating:Electric,":
                    in_block = True
                    is_doas = False
                continue
            if "!- Name" in line and "DOAS" in line:
                is_doas = True
            if is_doas and "!- Availability Schedule" in line:
                if "Always On Discrete" in line:
                    lines[i] = line.replace(
                        "Always On Discrete", "Always Off Discrete",
                    )
                    patched += 1
            if line.rstrip().endswith(";"):
                in_block = False
                is_doas = False
        if patched == 0:
            logger.info(
                "Patch B: DOAS backup heater not found - skip",
            )
            return
        with open(idf_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        logger.info(
            "Patch B: DOAS backup heater %d coils -> Always Off",
            patched,
        )
