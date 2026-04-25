"""
Sestavení IDF pro PV simulaci.

honeybee-energy defaultně zapíše `Generator:PVWatts` s
`array geometry type = Surface` a odkazem na PV Shade. EP tím zahrne
vlastní shading výpočet (polygon clipping proti ostatním shadám a budově)
do POA generátoru — přesně to, co chceme.
"""
from __future__ import annotations

import os
from typing import List

from honeybee.model import Model
from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.writer import model_to_idf, energyplus_idf_version

from .panel_placer import PanelPosition


def build_simulation_model(
    building_model: Model, panels: List[PanelPosition]
) -> Model:
    """Vytvoří kopii modelu s PV shadami přidanými jako orphaned shades."""
    pv_shades = [p.shade for p in panels]
    existing_shades = list(building_model.orphaned_shades)
    return Model(
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


def write_idf(simulation_model: Model, tmp_dir: str) -> str:
    """Vygeneruje kompletní IDF (version + model + sim params) a vrátí cestu."""
    sim_par = SimulationParameter()
    sim_par.output.include_sqlite = True
    sim_par.output.reporting_frequency = "Annual"
    sim_par.output.add_electricity_generation()

    idf_path = os.path.join(tmp_dir, "in.idf")
    with open(idf_path, "w") as f:
        f.write(_flatten_idf(energyplus_idf_version()) + "\n\n")
        f.write(_flatten_idf(model_to_idf(simulation_model)) + "\n\n")
        f.write(_flatten_idf(sim_par.to_idf()))
        # Explicit request na hodinový incident solar per shade surface —
        # tuto hodnotu EP počítá s vlastním polygon-clipping shadingem.
        # Defaultně v annual reportu není, proto ji sem přidáváme ručně.
        # Frekvence Hourly aby šlo sečíst přes rok na kWh/m².
        f.write(
            "\n\nOutput:Variable,*,"
            "Surface Outside Face Incident Solar Radiation Rate per Area,"
            "Hourly;\n"
        )
    return idf_path


def _flatten_idf(obj) -> str:
    """Rekurzivně převede výstup honeybee writerů (str|list|tuple) na plain text."""
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, (list, tuple)):
        return "\n\n".join(
            _flatten_idf(i) for i in obj if i is not None
        )
    return str(obj)
