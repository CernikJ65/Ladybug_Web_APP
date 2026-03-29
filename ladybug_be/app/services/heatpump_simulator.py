"""
EnergyPlus simulace tepelných zátěží pro analýzu TČ.

Honeybee-energy funkce:
  - SimulationParameter → nastavení E+ simulace
  - SimulationOutput.add_zone_energy_use() → output proměnné
  - model_to_idf() → export Model do IDF
  - run_idf() → vrací TUPLE (sql, zsz, rdd, html, err)
  - SQLiteResult → parsování výsledků

Poznámka k jednotkám:
  SQLiteResult.data_collections_by_output_name() interně
  konvertuje energie z Joulů (nativní E+ jednotka) na kWh.
  Proto NEPROVÁDÍME žádnou manuální konverzi J → kWh.
  (Na rozdíl od přímého čtení E+ CSV/ESO, kde jsou Jouly.)

Soubor: ladybug_be/app/services/heatpump_simulator.py
"""
from __future__ import annotations

import os
import tempfile
from typing import Dict, Any, List

from honeybee.model import Model

from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.run import run_idf
from honeybee_energy.writer import model_to_idf
from honeybee_energy.writer import energyplus_idf_version

from ladybug.sql import SQLiteResult
from ladybug.designday import DesignDay

HEATING_OUTPUT = (
    "Zone Ideal Loads Supply Air Total Heating Energy"
)


class HeatPumpSimulator:
    """Simulace tepelných zátěží budovy přes EnergyPlus."""

    def __init__(
        self, epw_path: str, design_days: List[DesignDay],
    ):
        self._epw_path = epw_path
        self._design_days = design_days

    def simulate(self, model: Model) -> Dict[str, Any]:
        """Spustí E+ simulaci a vrátí hodinové tepelné zátěže."""
        with tempfile.TemporaryDirectory(
            prefix="hp_sim_",
        ) as tmp_dir:
            sim_par = self._build_sim_par()

            raw_ver = energyplus_idf_version()
            raw_model = model_to_idf(model)
            raw_sim = sim_par.to_idf()

            idf_path = os.path.join(tmp_dir, "in.idf")
            with open(idf_path, "w") as f:
                f.write(self._to_string(raw_ver))
                f.write("\n\n")
                f.write(self._to_string(raw_model))
                f.write("\n\n")
                f.write(self._to_string(raw_sim))

            sql, zsz, rdd, html, err = run_idf(
                idf_path, self._epw_path,
            )

            if sql is None or not os.path.isfile(sql):
                err_msg = ""
                if err is not None and os.path.isfile(err):
                    with open(err) as ef:
                        err_msg = ef.read()[-800:]
                raise FileNotFoundError(
                    f"E+ nevytvořil SQL soubor. Chyby:\n{err_msg}"
                )

            return self._parse_results(sql, model)

    def _build_sim_par(self) -> SimulationParameter:
        """Sestaví parametry simulace.

        Pokud EPW neobsahuje design days (typické pro TMY),
        sizing se přeskočí — IdealAirSystem s no_limit
        nevyžaduje sizing pro fungování.
        """
        sim_par = SimulationParameter()
        sim_par.output.include_sqlite = True
        sim_par.output.add_zone_energy_use()

        if self._design_days:
            sim_par.sizing_parameter.design_days = (
                self._design_days
            )
        else:
            sim_par.simulation_control.do_zone_sizing = False
            sim_par.simulation_control.do_system_sizing = False
            sim_par.simulation_control.do_plant_sizing = False

        return sim_par

    def _parse_results(
        self, sql_path: str, model: Model,
    ) -> Dict[str, Any]:
        """Parsuje SQL → hodinové tepelné zátěže per room.

        Hodnoty z SQLiteResult.data_collections_by_output_name()
        jsou již v kWh — Ladybug interně konvertuje z Joulů.
        Žádná další konverze není potřeba.
        """
        sql = SQLiteResult(sql_path)

        heating_collections = (
            sql.data_collections_by_output_name(HEATING_OUTPUT)
        )

        if not heating_collections:
            raise ValueError(
                f"SQL neobsahuje '{HEATING_OUTPUT}'. "
                f"Zkontrolujte HVAC a output nastavení."
            )

        room_loads: Dict[str, List[float]] = {}
        room_ids = [r.identifier for r in model.rooms]

        for i, coll in enumerate(heating_collections):
            rid = (
                room_ids[i] if i < len(room_ids)
                else f"zone_{i}"
            )
            room_loads[rid] = list(coll.values)

        total = sum(sum(v) for v in room_loads.values())
        return {
            "success": True,
            "engine": "EnergyPlus_IdealAirSystem",
            "output_variable": HEATING_OUTPUT,
            "room_heating_loads_kwh": room_loads,
            "total_annual_heating_kwh": round(total, 1),
        }

    @staticmethod
    def _to_string(obj) -> str:
        """Převede str/tuple/list/None na IDF string."""
        if obj is None:
            return ""
        if isinstance(obj, str):
            return obj
        if isinstance(obj, (list, tuple)):
            parts = []
            for item in obj:
                if item is None:
                    continue
                if isinstance(item, (list, tuple)):
                    parts.extend(
                        str(i) for i in item if i is not None
                    )
                else:
                    parts.append(str(item))
            return "\n\n".join(parts)
        return str(obj)