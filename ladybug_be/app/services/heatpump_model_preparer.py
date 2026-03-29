"""
Příprava honeybee modelu pro simulaci tepelných čerpadel.

Honeybee-energy třídy:
  - IdealAirSystem → simulace tepelných zátěží
  - IdealAirSystem.sensible_heat_recovery → rekuperace
  - Setpoint, ScheduleRuleset → teplotní požadavky
  - program_type_by_identifier → space-level profily (ASHRAE)
  - Infiltration → netěsnost obálky
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
from honeybee_energy.load.infiltration import Infiltration
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _type_lib

from .construction_upgrader import ConstructionUpgrader

logger = logging.getLogger(__name__)

DEFAULT_COOLING_SP = 26.0

# PED vzduchotěsnost: 0.0001 m³/s·m² fasády (tight building)
# ASHRAE výchozí: 0.0003 (average) až 0.0006 (leaky)
PED_INFILTRATION = 0.0001

# Mapování UI typů → ASHRAE 2019 space-level program type.
# Každý typ reprezentuje hlavní užitný prostor dané budovy.
BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "2019::MidriseApartment::Apartment",
    "Office": "2019::MediumOffice::OpenOffice",
    "Retail": "2019::Retail::Retail",
    "School": "2019::SecondarySchool::Classroom",
    "Hotel": "2019::SmallHotel::GuestRoom",
    "Hospital": "2019::Hospital::PatRoom",
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
          3. Infiltrace → PED vzduchotěsnost (přepíše ASHRAE)
          4. Setpoint → uživatelova teplota
          5. IdealAirSystem → no_limit + volitelná rekuperace
        """
        if self._model is None:
            self.load_model()

        self._applied_programs.clear()

        # PED konstrukce (nahradí generické)
        upgrader = ConstructionUpgrader()
        upgrader.upgrade(self._model)

        for room in self._model.rooms:
            self._apply_program_type(room, self._building_type)
            self._apply_ped_infiltration(room)
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
        """Přiřadí ASHRAE 2019 space-level program type.

        Raises:
            ValueError: Pokud se nepodaří najít program type
                v honeybee-energy standardech.
        """
        pt_id = BUILDING_TYPE_MAP.get(building_type)
        if pt_id is None:
            pt_id = building_type

        try:
            pt = program_type_by_identifier(pt_id)
            room.properties.energy.program_type = pt
            self._applied_programs[room.identifier] = (
                pt.identifier
            )
        except Exception as e:
            raise ValueError(
                f"Program type '{pt_id}' pro typ budovy "
                f"'{building_type}' nenalezen v honeybee-energy "
                f"standardech. Podporované typy: "
                f"{list(BUILDING_TYPE_MAP.keys())}. Chyba: {e}"
            )

    @staticmethod
    def _apply_ped_infiltration(room: Room) -> None:
        """Přepíše ASHRAE infiltraci na PED standard.

        ASHRAE profily předpokládají běžnou netěsnost obálky
        (0.0003 m³/s·m²). PED budovy vyžadují vzduchotěsnost
        ověřenou Blower door testem (n50 ≤ 0.6 h⁻¹),
        odpovídající 0.0001 m³/s·m² fasády (tight building).
        """
        infil = Infiltration(
            f"{room.identifier}_PED_Infiltration",
            PED_INFILTRATION,
        )
        room.properties.energy.infiltration = infil

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