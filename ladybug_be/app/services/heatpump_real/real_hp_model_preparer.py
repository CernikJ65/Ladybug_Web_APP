"""
Příprava honeybee modelu s reálným HVAC (VRF / WSHP).

Honeybee-energy HVAC třídy:
  - VRFwithDOAS → vzduch-voda TČ s řízeným větráním (DOAS)
  - WSHPwithDOAS → země-voda TČ (GSHP) s řízeným větráním
  - sensible_heat_recovery → rekuperace tepla v DOAS

Na rozdíl od IdealAirSystem mají realistické výkonové
křivky a EnergyPlus sám počítá COP i spotřebu elektřiny.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_model_preparer.py
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List

from honeybee.model import Model
from honeybee.room import Room

from honeybee_energy.hvac.doas.vrf import VRFwithDOAS
from honeybee_energy.hvac.doas.wshp import WSHPwithDOAS
from honeybee_energy.load.setpoint import Setpoint
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    building_program_type_by_identifier,
    program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _type_lib

from ..construction_upgrader import ConstructionUpgrader

logger = logging.getLogger(__name__)

BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "Residential",
    "Office": "LargeOffice",
    "Retail": "Retail",
    "School": "PrimarySchool",
    "Hotel": "LargeHotel",
    "Hospital": "Hospital",
}

VINTAGE = "ASHRAE_2019"


class RealHPModelPreparer:
    """Připraví honeybee Model s reálným HVAC pro E+."""

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

    def prepare_vrf(self) -> Model:
        """Model s VRFwithDOAS (vzduch-voda TČ + DOAS)."""
        model = self._load_fresh()
        ConstructionUpgrader().upgrade(model)
        hvac = VRFwithDOAS(
            "DOAS_VRF_System", vintage=VINTAGE,
            sensible_heat_recovery=self._hr,
        )
        for room in model.rooms:
            self._apply_program(room)
            self._apply_setpoint(room)
            room.properties.energy.hvac = hvac
        logger.info("VRFwithDOAS → %d rooms", len(model.rooms))
        return model

    def prepare_wshp(self) -> Model:
        """Model s WSHPwithDOAS GSHP (země-voda TČ + DOAS)."""
        model = self._load_fresh()
        ConstructionUpgrader().upgrade(model)
        hvac = WSHPwithDOAS(
            "DOAS_WSHP_System", vintage=VINTAGE,
            equipment_type="DOAS_WSHP_GSHP",
            sensible_heat_recovery=self._hr,
        )
        for room in model.rooms:
            self._apply_program(room)
            self._apply_setpoint(room)
            room.properties.energy.hvac = hvac
        logger.info("WSHPwithDOAS GSHP → %d rooms", len(model.rooms))
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

    # ── interní ──

    def _load_fresh(self) -> Model:
        with open(self._path, "r", encoding="utf-8") as f:
            return Model.from_dict(json.load(f))

    def _apply_program(self, room: Room) -> None:
        mix = BUILDING_TYPE_MAP.get(self._btype)
        try:
            pt = (
                building_program_type_by_identifier(mix)
                if mix
                else program_type_by_identifier(self._btype)
            )
            room.properties.energy.program_type = pt
        except Exception:
            try:
                fb = program_type_by_identifier(
                    "Generic Office Program",
                )
                room.properties.energy.program_type = fb
            except Exception:
                pass

    def _apply_setpoint(self, room: Room) -> None:
        h = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_HtgSP",
            self._heat_sp, _type_lib.temperature,
        )
        c = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_ClgSP",
            self._cool_sp, _type_lib.temperature,
        )
        room.properties.energy.setpoint = Setpoint(
            f"{room.identifier}_SP", h, c,
        )