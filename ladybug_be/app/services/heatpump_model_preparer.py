"""
Příprava honeybee modelu pro simulaci tepelných čerpadel.

Honeybee-energy třídy:
  - IdealAirSystem → simulace tepelných zátěží
  - IdealAirSystem.sensible_heat_recovery → rekuperace
  - Setpoint, ScheduleRuleset → teplotní požadavky
  - construction_set_by_identifier → výchozí obálka budovy
  - building_program_type_by_identifier → vnitřní zisky
  - no_limit → bez omezení výkonu

Soubor: ladybug_be/app/services/heatpump_model_preparer.py
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional

from honeybee.model import Model
from honeybee.room import Room
from honeybee.altnumber import no_limit

from honeybee_energy.hvac.idealair import IdealAirSystem
from honeybee_energy.load.setpoint import Setpoint
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    program_type_by_identifier,
    building_program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _type_lib

from .construction_upgrader import ConstructionUpgrader

logger = logging.getLogger(__name__)

DEFAULT_COOLING_SP = 26.0

BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "Residential",
    "Office": "LargeOffice",
    "Retail": "Retail",
    "School": "PrimarySchool",
    "Hotel": "LargeHotel",
    "Hospital": "Hospital",
}


class HeatPumpModelPreparer:
    """Připraví honeybee Model s HVAC pro E+ simulaci."""

    def __init__(
        self,
        hbjson_path: str,
        building_type: str = "Office",
        heating_setpoint_c: float = 20.0,
        heat_recovery: float = 0.0,
    ):
        self._hbjson_path = hbjson_path
        self._building_type = building_type
        self._heating_sp = heating_setpoint_c
        self._heat_recovery = heat_recovery
        self._model: Optional[Model] = None
        self._applied_programs: Dict[str, str] = {}

    def load_model(self) -> Model:
        with open(self._hbjson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self._model = Model.from_dict(data)
        return self._model

    def prepare_for_simulation(self) -> Model:
        """Kompletní příprava modelu.

        Pořadí:
          1. Konstrukce → PED nízkoenergetický standard
          2. Program type → dle zvoleného typu budovy
          3. Setpoint → uživatelova teplota
          4. IdealAirSystem → no_limit + volitelná rekuperace
        """
        if self._model is None:
            self.load_model()

        self._applied_programs.clear()

        # PED konstrukce (nahradí generické)
        upgrader = ConstructionUpgrader()
        upgrader.upgrade(self._model)

        for room in self._model.rooms:
            self._apply_program_type(room, self._building_type)
            self._apply_setpoint(room, self._heating_sp)
            self._assign_ideal_air(room, self._heat_recovery)

        return self._model

    def get_rooms_info(self) -> List[Dict[str, Any]]:
        if self._model is None:
            self.load_model()
        return [
            {
                "identifier": r.identifier,
                "display_name": r.display_name,
                "floor_area_m2": round(r.floor_area, 2),
                "volume_m3": round(r.volume, 2),
            }
            for r in self._model.rooms if r.floor_area >= 0.1
        ]

    def get_total_floor_area(self) -> float:
        if self._model is None:
            self.load_model()
        return sum(
            r.floor_area for r in self._model.rooms
            if r.floor_area >= 0.1
        )

    def get_applied_programs(self) -> Dict[str, str]:
        return dict(self._applied_programs)

    # ------------------------------------------------------------------

    @staticmethod
    def _assign_ideal_air(
        room: Room, heat_recovery: float,
    ) -> None:
        """Přiřadí IdealAirSystem s no_limit a rekuperací."""
        ideal = IdealAirSystem(
            f"IdealAir_{room.identifier[:40]}",
            economizer_type="NoEconomizer",
            sensible_heat_recovery=heat_recovery,
        )
        ideal.heating_limit = no_limit
        ideal.cooling_limit = no_limit
        room.properties.energy.hvac = ideal

    def _apply_program_type(
        self, room: Room, building_type: str,
    ) -> None:
        """Přiřadí program type dle zvoleného typu budovy."""
        mix_key = BUILDING_TYPE_MAP.get(building_type)
        if mix_key is not None:
            applied = self._try_building_mix(room, mix_key)
        else:
            applied = self._try_direct(room, building_type)
        self._applied_programs[room.identifier] = applied

    def _try_building_mix(
        self, room: Room, mix_key: str,
    ) -> str:
        try:
            pt = building_program_type_by_identifier(mix_key)
            room.properties.energy.program_type = pt
            return pt.identifier
        except Exception:
            return self._try_direct(room, mix_key)

    def _try_direct(
        self, room: Room, identifier: str,
    ) -> str:
        try:
            pt = program_type_by_identifier(identifier)
            room.properties.energy.program_type = pt
            return pt.identifier
        except Exception:
            try:
                fb = program_type_by_identifier(
                    "Generic Office Program",
                )
                room.properties.energy.program_type = fb
                return fb.identifier
            except Exception:
                return "FALLBACK_FAILED"

    @staticmethod
    def _apply_setpoint(room: Room, heating_sp: float) -> None:
        heat_sch = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_HtgSP",
            heating_sp,
            _type_lib.temperature,
        )
        cool_sch = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_ClgSP",
            DEFAULT_COOLING_SP,
            _type_lib.temperature,
        )
        room.properties.energy.setpoint = Setpoint(
            f"{room.identifier}_Setpoint", heat_sch, cool_sch,
        )