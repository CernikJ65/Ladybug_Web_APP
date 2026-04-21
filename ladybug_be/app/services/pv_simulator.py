"""
PV simulace přes EnergyPlus s honeybee-energy PVProperties.

Klíčové:
  - sim_par.output.add_electricity_generation() přidá PV výstupy do IDF
  - reporting_frequency = 'Annual' → data_collections_by_output_name
    vrátí List[float] (roční součet v J), ne List[DataCollection]
  - reporting_frequency = 'Hourly' → vrátí List[DataCollection] s .values

Oba případy jsou ošetřeny v _kwh_from_item().
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import List, Dict, Any, Callable, Optional

from honeybee.model import Model
from honeybee_energy.generator.pv import PVProperties
from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.run import (
    run_idf, prepare_idf_for_simulation, output_energyplus_files, folders,
)
from honeybee_energy.writer import model_to_idf
from honeybee_energy.writer import energyplus_idf_version
from ladybug.sql import SQLiteResult

from .panel_placer import PanelPosition


_EP_PROGRESS_RE = re.compile(
    r'(Starting|Continuing)\s+Simulation\s+at', re.IGNORECASE
)
# EnergyPlus typicky pošle 1× "Starting Simulation at 01/01" + 12× "Continuing
# Simulation at MM/DD" pro roční run. Pokud přijde víc, cappujeme na 0.97.
_EP_EXPECTED_EVENTS = 13


class PVSimulator:
    """Simulace FV výroby přes EnergyPlus s PVProperties."""

    def __init__(
        self,
        epw_path: str,
        rated_efficiency: float = 0.20,
        module_type: str = "Standard",
        mounting_type: str = "FixedOpenRack",
        active_area_fraction: float = 0.9,
    ):
        self.epw_path = epw_path
        self.rated_efficiency = rated_efficiency
        self.module_type = module_type
        self.mounting_type = mounting_type
        self.active_area_fraction = active_area_fraction
        self._system_loss = PVProperties.loss_fraction_from_components()

    def assign_pv_properties(self, panels: List[PanelPosition]) -> None:
        """Přiřadí PVProperties ke každému Shade panelu."""
        for panel in panels:
            pv = PVProperties(
                identifier=f"PV_{panel.shade.identifier}",
                rated_efficiency=self.rated_efficiency,
                active_area_fraction=self.active_area_fraction,
                module_type=self.module_type,
                mounting_type=self.mounting_type,
                system_loss_fraction=self._system_loss,
            )
            panel.shade.properties.energy.pv_properties = pv

    def simulate(
        self,
        panels: List[PanelPosition],
        building_model: Model,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> Dict[str, Any]:
        """
        Spustí EnergyPlus simulaci a vrátí výsledky.

        `on_progress(fraction)` — volitelný callback, dostává 0.0–1.0 podle
        počtu dokončených měsíců (parsuje se ze stdoutu EP). Když není
        zadán, spadne se na běžné `run_idf`.
        """
        if not building_model.rooms:
            raise RuntimeError(
                "building_model neobsahuje žádné rooms. "
                "EnergyPlus vyžaduje alespoň jednu tepelnou zónu."
            )

        pv_shades = [p.shade for p in panels]
        existing_shades = list(building_model.orphaned_shades)

        simulation_model = Model(
            identifier=building_model.identifier,
            rooms=list(building_model.rooms),
            orphaned_faces=list(building_model.orphaned_faces),
            orphaned_apertures=list(building_model.orphaned_apertures),
            orphaned_doors=list(building_model.orphaned_doors),
            orphaned_shades=existing_shades + pv_shades,
            units=building_model.units,
            tolerance=building_model.tolerance,
            angle_tolerance=building_model.angle_tolerance,
        )

        tmp_dir = tempfile.mkdtemp()
        try:
            raw_idf = model_to_idf(simulation_model)
            idf_str = self._to_string(raw_idf)

            sim_par = SimulationParameter()
            sim_par.output.include_sqlite = True
            sim_par.output.reporting_frequency = 'Annual'
            sim_par.output.add_electricity_generation()
            raw_sim = sim_par.to_idf()
            sim_str = self._to_string(raw_sim)

            raw_ver = energyplus_idf_version()
            ver_str = self._to_string(raw_ver)

            idf_path = os.path.join(tmp_dir, "in.idf")
            with open(idf_path, "w") as f:
                f.write(ver_str + "\n\n")
                f.write(idf_str + "\n\n")
                f.write(sim_str)

            if on_progress is not None:
                directory = self._run_ep_with_progress(
                    idf_path, self.epw_path, on_progress
                )
                sql_path, _zsz, _rdd, _html, err_path = \
                    output_energyplus_files(directory)
            else:
                result = run_idf(idf_path, self.epw_path)
                sql_path = result[0] if isinstance(result, tuple) else None
                err_path = (
                    result[4]
                    if isinstance(result, tuple) and len(result) > 4
                    else None
                )

            if not sql_path or not os.path.isfile(sql_path):
                raise RuntimeError(
                    f"EnergyPlus nedodal SQL soubor.\n"
                    f"eplusout.err:\n{self._read_file(err_path)}"
                )

            return self._parse_results(sql_path, panels)

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    @staticmethod
    def _run_ep_with_progress(
        idf_path: str,
        epw_path: str,
        on_progress: Callable[[float], None],
    ) -> str:
        """
        Spustí EnergyPlus přímo přes subprocess, zachytí stdout a volá
        `on_progress(fraction)` při každém ukončeném měsíci.

        Vrací adresář, kde EP běžel (stejný kontrakt jako interní helpery
        v honeybee_energy.run).
        """
        directory = prepare_idf_for_simulation(idf_path, epw_path)

        # Stejný trick jako v run_idf — přejmenovat .stat soubor, aby ho
        # EP nenašel a nehazardoval warningem.
        stat_file, renamed_stat = None, None
        if epw_path is not None:
            epw_folder = os.path.dirname(epw_path)
            try:
                for wf in os.listdir(epw_folder):
                    if wf.endswith('.stat'):
                        stat_file = os.path.join(epw_folder, wf)
                        renamed_stat = os.path.join(
                            epw_folder, wf.replace('.stat', '.hide')
                        )
                        try:
                            os.rename(stat_file, renamed_stat)
                        except Exception:
                            stat_file = None
                        break
            except Exception:
                stat_file = None

        try:
            cmds = [folders.energyplus_exe, '-i', folders.energyplus_idd_path]
            if epw_path is not None:
                cmds.extend(['-w', os.path.abspath(epw_path)])
            cmds.append('-x')  # expand objects

            popen_kwargs: Dict[str, Any] = {
                'cwd': directory,
                'stdout': subprocess.PIPE,
                'stderr': subprocess.STDOUT,
                'text': True,
                'bufsize': 1,
            }
            if os.name == 'nt':
                popen_kwargs['creationflags'] = 0x08000000  # CREATE_NO_WINDOW

            process = subprocess.Popen(cmds, **popen_kwargs)

            counter = 0
            try:
                assert process.stdout is not None
                for line in process.stdout:
                    # Přeposlat EP výstup do naší konzole, ať je viditelný
                    # stejně jako před zapojením progress parseru.
                    sys.stdout.write(line)
                    sys.stdout.flush()

                    if _EP_PROGRESS_RE.search(line):
                        counter += 1
                        frac = min(counter / _EP_EXPECTED_EVENTS, 0.97)
                        try:
                            on_progress(frac)
                        except Exception:
                            pass
            finally:
                process.wait()

            try:
                on_progress(1.0)
            except Exception:
                pass

        finally:
            if stat_file is not None and renamed_stat is not None:
                try:
                    os.rename(renamed_stat, stat_file)
                except Exception:
                    pass

        return directory

    def _parse_results(
        self, sql_path: str, panels: List[PanelPosition]
    ) -> Dict[str, Any]:
        """
        Parsuje per-panel výrobu z SQL.

        Při 'Annual' reporting: data_collections_by_output_name vrátí
        List[float] — každý float je roční součet ve wattsekundách (J).

        Při 'Hourly' reporting: vrátí List[DataCollection] s .values.

        _kwh_from_item() ošetří obě varianty.
        """
        sql = SQLiteResult(sql_path)

        all_data = sql.data_collections_by_output_name(
            "Generator Produced DC Electricity Energy"
        )

        if not all_data:
            raise RuntimeError(
                "EnergyPlus SQL neobsahuje 'Generator Produced DC Electricity Energy'.\n"
                "Dostupné výstupy: " + str(sql.available_outputs)
            )

        panel_results = []
        total = 0.0
        for i, panel in enumerate(panels):
            item = all_data[i] if i < len(all_data) else 0.0
            annual_kwh = self._kwh_from_item(item)
            total += annual_kwh
            panel_results.append({
                "panel_id": panel.id,
                "shade_id": panel.shade.identifier,
                "annual_production_kwh": round(annual_kwh, 2),
            })

        return {
            "annual_production_kwh": round(total, 2),
            "panel_results": panel_results,
            "simulation_engine": "EnergyPlus_PVWatts",
            "hourly_available": False,
        }

    @staticmethod
    def _kwh_from_item(item) -> float:
        """
        Převede položku z data_collections_by_output_name na kWh.

        Annual frequency → item je float (J) → dělíme 3_600_000
        Hourly frequency → item je DataCollection → sum(.values) / 3_600_000
        """
        if isinstance(item, (int, float)):
            # Annual: hodnota je roční součet v J
            return float(item) / 3_600_000
        else:
            # Hourly/Monthly: DataCollection s .values v J
            return sum(item.values) / 3_600_000

    @staticmethod
    def _read_file(path: str) -> str:
        if not path or not os.path.exists(path):
            return "(soubor nenalezen)"
        with open(path, "r", errors="replace") as f:
            lines = f.readlines()
        important = [l.rstrip() for l in lines if "Fatal" in l or "Severe" in l]
        return "\n".join(important[:30]) if important else "".join(lines[-20:])

    @staticmethod
    def _to_string(obj) -> str:
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
                    parts.extend(str(i) for i in item if i is not None)
                else:
                    parts.append(str(item))
            return "\n\n".join(parts)
        return str(obj)

    def get_loss_breakdown(self) -> Dict[str, float]:
        return {
            "soiling": 0.02, "snow": 0.0, "wiring": 0.02,
            "electrical_connection": 0.005, "manufacturer_mismatch": 0.02,
            "age_degradation": 0.045, "light_induced_degradation": 0.015,
            "grid_availability": 0.015,
            "total": round(self._system_loss, 3),
        }