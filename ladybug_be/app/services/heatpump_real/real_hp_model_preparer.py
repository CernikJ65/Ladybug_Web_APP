"""
Priprava honeybee modelu s realnym HVAC.

Scenar: 1 TC na misnost (per-zone terminaly).

Dva rezimy podle toho, jestli je zapla rekuperace (ERV):

heat_recovery == 0  -> BEZ ventilace, cisty vykon kompresoru
  ASHP: honeybee_energy.hvac.heatcool.VRF
  GSHP: honeybee_energy.hvac.heatcool.WSHP + 'WSHP_GSHP'

heat_recovery > 0  -> S ventilaci a ERV, realisticky dum
  ASHP: honeybee_energy.hvac.doas.VRFwithDOAS + sensible_heat_recovery
  GSHP: honeybee_energy.hvac.doas.WSHPwithDOAS + 'DOAS_WSHP_GSHP'
        + sensible_heat_recovery

  DULEZITE: DOAS by defaultne v Ladybug jel 24/7 (doas_availability
  None -> always on, cit. doas/_base.py). Proto ho napojujeme na
  occupancy schedule z Ladybug programu (people.occupancy_schedule)
  + zapineme demand_controlled_ventilation, aby prutok sel podle
  obsazenosti. Bez toho by ventilatory zrali i kdyz nikdo neni doma.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_model_preparer.py
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional

from honeybee.model import Model
from honeybee.room import Room

from honeybee_energy.hvac.heatcool.vrf import VRF
from honeybee_energy.hvac.heatcool.wshp import WSHP
from honeybee_energy.hvac.doas.vrf import VRFwithDOAS
from honeybee_energy.hvac.doas.wshp import WSHPwithDOAS
from honeybee_energy.load.setpoint import Setpoint
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    building_program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _tl

logger = logging.getLogger(__name__)

VINTAGE = "ASHRAE_2019"

# UI hodnoty -> Ladybug program identifier
BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "MidriseApartment",
    "Office": "MediumOffice",
    "Retail": "Retail",
    "School": "SecondarySchool",
    "Hotel": "SmallHotel",
    "Hospital": "Hospital",
}


class RealHPModelPreparer:
    """Pripravi honeybee Model s ASHP/GSHP HVAC + Ladybug programem."""

    def __init__(
        self,
        hbjson_path: str,
        building_type: str = "Office",
        heating_setpoint_c: Optional[float] = None,
        cooling_setpoint_c: Optional[float] = None,
        heat_recovery: float = 0.0,
        heating_only: bool = False,
    ):
        self._path = hbjson_path
        self._btype = building_type
        self._heating_sp = heating_setpoint_c
        # Heating-only rezim: cooling setpoint 80 C -> E+ nikdy
        # nespusti chlazeni (vnitrni teploty se nepriblizi 80 C).
        self._cooling_sp = 80.0 if heating_only else cooling_setpoint_c
        self._heating_only = heating_only
        self._hr = max(0.0, min(0.95, heat_recovery))
        self._program = self._load_program()

    def prepare_ashp(self) -> Model:
        """VRF — bez HR cisty inverter (bez DOAS),
        s HR VRFwithDOAS (inverter + DOAS napojeny na occupancy)."""
        model = self._load_and_prepare()
        if self._hr > 0:
            hvac = VRFwithDOAS(
                "ASHP_VRFwithDOAS_System",
                vintage=VINTAGE,
                equipment_type="DOAS_VRF",
                sensible_heat_recovery=self._hr,
                latent_heat_recovery=self._hr * 0.9,
                demand_controlled_ventilation=True,
                doas_availability_schedule=self._doas_schedule(),
            )
            tag = f"VRFwithDOAS, ERV={self._hr:.2f} (occ-sched)"
        else:
            hvac = VRF(
                "ASHP_VRF_System",
                vintage=VINTAGE,
                equipment_type="VRF",
            )
            tag = "VRF (bez DOAS)"
        for room in model.rooms:
            room.properties.energy.hvac = hvac
        logger.info("ASHP -> %s (%d rooms)", tag, len(model.rooms))
        return model

    def prepare_gshp(self) -> Model:
        """WSHP_GSHP — bez HR cisty inverter (bez DOAS),
        s HR WSHPwithDOAS (DOAS napojeny na occupancy schedule)."""
        model = self._load_and_prepare()
        if self._hr > 0:
            hvac = WSHPwithDOAS(
                "GSHP_WSHPwithDOAS_System",
                vintage=VINTAGE,
                equipment_type="DOAS_WSHP_GSHP",
                sensible_heat_recovery=self._hr,
                latent_heat_recovery=self._hr * 0.9,
                demand_controlled_ventilation=True,
                doas_availability_schedule=self._doas_schedule(),
            )
            tag = f"WSHPwithDOAS, ERV={self._hr:.2f} (occ-sched)"
        else:
            hvac = WSHP(
                "GSHP_WSHP_System",
                vintage=VINTAGE,
                equipment_type="WSHP_GSHP",
            )
            tag = "WSHP/GSHP (bez DOAS)"
        for room in model.rooms:
            room.properties.energy.hvac = hvac
        logger.info("GSHP -> %s (%d rooms)", tag, len(model.rooms))
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

    def get_program_setpoints(self) -> Dict[str, float]:
        """Vychozi setpointy Ladybug programu (pro info v UI)."""
        sp = self._program.setpoint
        return {
            "heating_setpoint_c": round(sp.heating_setpoint, 1),
            "cooling_setpoint_c": round(sp.cooling_setpoint, 1),
        }

    def get_program_name(self) -> str:
        return self._program.identifier

    def get_applied_setpoints(self) -> Dict[str, float]:
        """Setpointy skutecne pouzite v simulaci."""
        prog = self._program.setpoint
        return {
            "heating_setpoint_c": (
                self._heating_sp
                if self._heating_sp is not None
                else round(prog.heating_setpoint, 1)
            ),
            "cooling_setpoint_c": (
                self._cooling_sp
                if self._cooling_sp is not None
                else round(prog.cooling_setpoint, 1)
            ),
        }

    # -- interni --

    def _load_program(self):
        pt_id = BUILDING_TYPE_MAP.get(self._btype, self._btype)
        return building_program_type_by_identifier(pt_id)

    def _doas_schedule(self):
        """Occupancy schedule z Ladybug programu pro DOAS availability.

        EnergyPlus bere non-zero hodnoty jako "on" -> v noci kdy
        occupancy == 0 se DOAS (vc. ventilatoru) vypne.
        """
        if self._program.people is not None:
            return self._program.people.occupancy_schedule
        return None

    def _load_and_prepare(self) -> Model:
        model = self._load_fresh()
        for room in model.rooms:
            room.properties.energy.program_type = self._program
            if self._has_setpoint_override():
                self._apply_setpoint_override(room)
        return model

    def _has_setpoint_override(self) -> bool:
        return (
            self._heating_sp is not None
            or self._cooling_sp is not None
        )

    def _apply_setpoint_override(self, room: Room) -> None:
        """Prepise setpointy z programu konstantni hodnotou."""
        prog = self._program.setpoint
        h_val = (
            self._heating_sp
            if self._heating_sp is not None
            else prog.heating_setpoint
        )
        c_val = (
            self._cooling_sp
            if self._cooling_sp is not None
            else prog.cooling_setpoint
        )
        h = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_HtgSP", h_val, _tl.temperature,
        )
        c = ScheduleRuleset.from_constant_value(
            f"{room.identifier}_ClgSP", c_val, _tl.temperature,
        )
        room.properties.energy.setpoint = Setpoint(
            f"{room.identifier}_SP", h, c,
        )

    def _load_fresh(self) -> Model:
        with open(self._path, "r", encoding="utf-8") as f:
            return Model.from_dict(json.load(f))
