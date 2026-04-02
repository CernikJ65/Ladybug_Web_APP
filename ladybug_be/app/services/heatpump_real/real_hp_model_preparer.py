"""
Priprava honeybee modelu s realnym HVAC pro PED.

ASHP (vzduch-voda):
  FCUwithDOAS s equipment_type='DOAS_FCU_Chiller_ASHP'
  - Centralni ASHP vyrabi teplou vodu 49 C
  - Fancoily rozvadeji teplo do zon
  - Chiller resi chlazeni
  - DOAS zajistuje vetrani s volitelnou rekuperaci

GSHP (zeme-voda):
  WSHPwithDOAS s equipment_type='DOAS_WSHP_GSHP'
  - Zonove WSHP terminaly na zemnim okruhu
  - DOAS zajistuje vetrani s volitelnou rekuperaci
  - Zemni smycka udrzuje stabilni teplotu

Honeybee-energy funkce:
  - FCUwithDOAS(id, vintage, equipment_type, ...)
  - WSHPwithDOAS(id, vintage, equipment_type, ...)
  - sensible_heat_recovery -> rekuperace v DOAS
  - program_type_by_identifier() -> ASHRAE profily
  - Setpoint + ScheduleRuleset -> teplotni pozadavky
  - Infiltration -> PED vzduchotesnost

Soubor: ladybug_be/app/services/heatpump_real/real_hp_model_preparer.py
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List

from honeybee.model import Model
from honeybee.room import Room

from honeybee_energy.hvac.doas.fcu import FCUwithDOAS
from honeybee_energy.hvac.doas.wshp import WSHPwithDOAS
from honeybee_energy.load.setpoint import Setpoint
from honeybee_energy.load.infiltration import Infiltration
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _tl

from ..construction_upgrader import ConstructionUpgrader

logger = logging.getLogger(__name__)

PED_INFILTRATION = 0.0001

# Space-level ASHRAE 2019 — shodne s heatpump_model_preparer
BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "2019::MidriseApartment::Apartment",
    "Office": "2019::MediumOffice::OpenOffice",
    "Retail": "2019::Retail::Retail",
    "School": "2019::SecondarySchool::Classroom",
    "Hotel": "2019::SmallHotel::GuestRoom",
    "Hospital": "2019::Hospital::PatRoom",
}

VINTAGE = "ASHRAE_2019"


class RealHPModelPreparer:
    """Pripravi honeybee Model s ASHP/GSHP HVAC."""

    def __init__(
        self,
        hbjson_path: str,
        building_type: str = "Office",
        heating_setpoint_c: float = 20.0,
        cooling_setpoint_c: float = 26.0,
        heat_recovery: float = 0.0,
    ):
        self._path = hbjson_path
        self._btype = building_type
        self._heat_sp = heating_setpoint_c
        self._cool_sp = cooling_setpoint_c
        self._hr = heat_recovery

    def prepare_ashp(self) -> Model:
        """FCUwithDOAS + centralni ASHP (vzduch-voda).

        Equipment: DOAS_FCU_Chiller_ASHP
        - ASHP vyrabi teplou vodu 49 C pro FCU
        - Chiller resi chlazeni pres chilled water
        - DOAS s rekuperaci pro vetrani
        """
        model = self._load_and_prepare()
        hvac = FCUwithDOAS(
            "DOAS_FCU_ASHP_System",
            vintage=VINTAGE,
            equipment_type="DOAS_FCU_Chiller_ASHP",
            sensible_heat_recovery=self._hr,
        )
        for room in model.rooms:
            room.properties.energy.hvac = hvac
        logger.info(
            "FCU+ASHP -> %d rooms", len(model.rooms),
        )
        return model

    def prepare_gshp(self) -> Model:
        """WSHPwithDOAS + zemni smycka (zeme-voda).

        Equipment: DOAS_WSHP_GSHP
        - Zonove WSHP na zemnim okruhu
        - DX coils v DOAS (ne boiler)
        - DOAS s rekuperaci pro vetrani
        """
        model = self._load_and_prepare()
        hvac = WSHPwithDOAS(
            "DOAS_WSHP_GSHP_System",
            vintage=VINTAGE,
            equipment_type="DOAS_WSHP_GSHP",
            sensible_heat_recovery=self._hr,
        )
        for room in model.rooms:
            room.properties.energy.hvac = hvac
        logger.info(
            "WSHP+GSHP -> %d rooms", len(model.rooms),
        )
        return model

    def get_rooms_info(self) -> List[Dict[str, Any]]:
        model = self._load_fresh()
        return [
            {
                "identifier": r.identifier,
                "display_name": r.display_name,
                "floor_area_m2": round(r.floor_area, 2),
            }
            for r in model.rooms if r.floor_area >= 0.1
        ]

    def get_total_floor_area(self) -> float:
        model = self._load_fresh()
        return sum(
            r.floor_area for r in model.rooms
            if r.floor_area >= 0.1
        )

    # -- interni --

    def _load_and_prepare(self) -> Model:
        """Nacte a aplikuje program/setpoint/infiltraci."""
        model = self._load_fresh()
        ConstructionUpgrader().upgrade(model)
        for room in model.rooms:
            self._apply_program(room)
            self._apply_setpoint(room)
            self._apply_ped_infiltration(room)
        return model

    def _load_fresh(self) -> Model:
        with open(self._path, "r", encoding="utf-8") as f:
            return Model.from_dict(json.load(f))

    def _apply_program(self, room: Room) -> None:
        pt_id = BUILDING_TYPE_MAP.get(self._btype)
        if pt_id is None:
            pt_id = self._btype
        try:
            pt = program_type_by_identifier(pt_id)
            room.properties.energy.program_type = pt
        except Exception:
            pt = program_type_by_identifier(
                "Generic Office Program",
            )
            room.properties.energy.program_type = pt

    def _apply_setpoint(self, room: Room) -> None:
        h = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_HtgSP",
            self._heat_sp, _tl.temperature,
        )
        c = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_ClgSP",
            self._cool_sp, _tl.temperature,
        )
        room.properties.energy.setpoint = Setpoint(
            f"{room.identifier}_SP", h, c,
        )

    @staticmethod
    def _apply_ped_infiltration(room: Room) -> None:
        infil = Infiltration(
            f"{room.identifier}_PED_Infiltration",
            PED_INFILTRATION,
        )
        room.properties.energy.infiltration = infil