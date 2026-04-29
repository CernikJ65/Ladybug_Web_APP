"""
Kalibrator honeybee programu na ceske rezidencni hodnoty.

Vychazi z DOE 2019::MidriseApartment::Apartment a prepise ctyri
zatezove veliciny dle CSN 73 0331-1:2018 priloha B (RD obytne):
  - Lighting:  3.0 W/m2 peak (LED, ~4.46 kWh/m2/rok pri 1500 h)
  - Equipment: 3.5 W/m2 peak (CSN qAPP 3-5 W/m2 obytne prostory)
  - People:    0.025 os/m2 (CSU 2024 RD prumer 2.62 os/117 m2)
  - Activity:  115 W/os TOTAL metabolicky vydej. Honeybee/E+
               ocekava v activity_schedule celkovou hodnotu vc.
               latent (vodni para). Z 115 W total vyjde po
               autocalculate latent fraction ~38% cca 70 W
               sensible — odpovida CSN qOCC = 1.5 W/m2 / fOCC=0.7.

Schedules a ostatni nastaveni (infiltration, ventilation,
setpoint, service_hot_water) se NEMENI.

Soubor: ladybug_be/app/services/shared/cz_program_calibrator.py
"""
from __future__ import annotations

import logging
from typing import Optional

from honeybee.model import Model
from honeybee_energy.programtype import ProgramType
from honeybee_energy.schedule.ruleset import ScheduleRuleset
import honeybee_energy.lib.scheduletypelimits as _tl

logger = logging.getLogger(__name__)

# CSN 73 0331-1:2018 tab. B.5 - RD obytne prostory
DEFAULT_LIGHTING_W_M2 = 3.0
DEFAULT_EQUIPMENT_W_M2 = 3.5
DEFAULT_PEOPLE_PER_AREA = 0.025
# Total metabolic v Honeybee/E+; sensible ~70 W (CSN qOCC)
DEFAULT_PEOPLE_ACTIVITY_W = 115.0

CALIBRATED_PROGRAM_ID = "CZ_Residential_Apartment_Calibrated"
CZ_EQUIPMENT_SCHEDULE_ID = "CZ_Residential_Equipment_Schedule"
CZ_PEOPLE_ACTIVITY_SCHEDULE_ID = "CZ_Residential_People_Activity"

CZ_EQUIPMENT_HOURLY = [
    0.20, 0.20, 0.20, 0.20, 0.20, 0.20,
    0.40, 0.40, 0.40,
    0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18,
    0.55, 0.55, 0.55, 0.55, 0.55,
    0.30, 0.30,
]


class CZResidentialCalibrator:
    """Prepise loads na vsech rooms modelu na ceske rezidencni hodnoty.

    Vyrobi JEDEN sdileny ProgramType (duplikat z prvniho roomu)
    s upravenymi watts_per_area pro lighting/equipment, people_per_area
    pro people a activity_schedule pro metabolicky vydej. Tento
    sdileny program priradi vsem rooms.
    """

    def __init__(
        self,
        model: Model,
        lighting_w_m2: float = DEFAULT_LIGHTING_W_M2,
        equipment_w_m2: float = DEFAULT_EQUIPMENT_W_M2,
        people_per_area: float = DEFAULT_PEOPLE_PER_AREA,
        people_activity_w: float = DEFAULT_PEOPLE_ACTIVITY_W,
    ):
        self._model = model
        self._lighting_w = lighting_w_m2
        self._equipment_w = equipment_w_m2
        self._people_per_area = people_per_area
        self._people_activity_w = people_activity_w

    def calibrate(self) -> Model:
        """Aplikuje CZ kalibraci na vsechny rooms modelu."""
        if not self._model.rooms:
            logger.warning("CZ kalibrator: model nema zadne rooms")
            return self._model

        source_program = self._extract_source_program()
        old_light = source_program.lighting.watts_per_area
        old_equip = source_program.electric_equipment.watts_per_area
        old_people = source_program.people.people_per_area
        old_activity = self._read_activity_avg(source_program.people)

        calibrated = self._build_calibrated_program(source_program)
        for room in self._model.rooms:
            room.properties.energy.program_type = calibrated

        self._log_changes(
            old_light, old_equip, old_people, old_activity,
        )
        return self._model

    def _log_changes(self, ol, oe, op, oa) -> None:
        n = len(self._model.rooms)
        print(f"[CZ KALIBRACE] Aplikovana na {n} rooms:")
        print(f"  Lighting:  {ol:.2f} -> {self._lighting_w:.2f} W/m2 (CSN 4.46 kWh/m2/rok)")
        print(f"  Equipment: {oe:.2f} -> {self._equipment_w:.2f} W/m2 (CSN qAPP 3-5)")
        print(f"  People:    {op:.4f} -> {self._people_per_area:.4f} os/m2 (CSU 2024)")
        print(f"  Activity:  {oa:.0f} -> {self._people_activity_w:.0f} W/os total (~70 W sensible)")
        logger.info(
            "CZ kalibrace: %d rooms, lights=%.2f, equip=%.2f, "
            "people=%.4f, activity=%.0f W total",
            n, self._lighting_w, self._equipment_w,
            self._people_per_area, self._people_activity_w,
        )

    def _extract_source_program(self) -> ProgramType:
        """Vrati program prvniho roomu jako vzor (po reset_loads)."""
        first_room = self._model.rooms[0]
        prog = first_room.properties.energy.program_type
        if prog is None:
            raise ValueError(
                "CZ kalibrator: prvni room nema priradeny program_type. "
                "Volej calibrate() az po RealHPModelPreparer.prepare_*()."
            )
        return prog

    def _build_calibrated_program(
        self, source: ProgramType,
    ) -> ProgramType:
        """Duplikuje source program a prepise ctyri zatezove veliciny."""
        prog = source.duplicate()
        prog.identifier = CALIBRATED_PROGRAM_ID
        prog.lighting = self._calibrate_lighting(prog.lighting)
        prog.electric_equipment = self._calibrate_equipment(
            prog.electric_equipment,
        )
        prog.people = self._calibrate_people(prog.people)
        return prog

    def _calibrate_lighting(self, lighting):
        if lighting is None:
            raise ValueError(
                "CZ kalibrator: source program nema Lighting load.",
            )
        new_light = lighting.duplicate()
        new_light.identifier = f"{CALIBRATED_PROGRAM_ID}_Lights"
        new_light.watts_per_area = self._lighting_w
        return new_light

    def _calibrate_equipment(self, equipment):
        if equipment is None:
            raise ValueError(
                "CZ kalibrator: source program nema ElectricEquipment.",
            )
        new_eq = equipment.duplicate()
        new_eq.identifier = f"{CALIBRATED_PROGRAM_ID}_Equip"
        new_eq.watts_per_area = self._equipment_w
        new_eq.schedule = self._cz_equipment_schedule()
        return new_eq

    @staticmethod
    def _cz_equipment_schedule() -> ScheduleRuleset:
        return ScheduleRuleset.from_daily_values(
            CZ_EQUIPMENT_SCHEDULE_ID, CZ_EQUIPMENT_HOURLY,
            timestep=1, schedule_type_limit=_tl.fractional,
        )

    def _calibrate_people(self, people):
        """Activity_schedule v Honeybee/E+ je TOTAL metabolic vydej.
        Z 115 W total -> ~70 W sensible (CSN qOCC) po odecteni
        latentniho tepla (autocalculate fraction ~0.38)."""
        if people is None:
            raise ValueError(
                "CZ kalibrator: source program nema People load.",
            )
        new_people = people.duplicate()
        new_people.identifier = f"{CALIBRATED_PROGRAM_ID}_People"
        new_people.people_per_area = self._people_per_area
        new_people.activity_schedule = self._cz_activity_schedule()
        return new_people

    def _cz_activity_schedule(self) -> ScheduleRuleset:
        return ScheduleRuleset.from_constant_value(
            CZ_PEOPLE_ACTIVITY_SCHEDULE_ID,
            self._people_activity_w,
            _tl.activity_level,
        )

    @staticmethod
    def _read_activity_avg(people) -> float:
        if people is None or people.activity_schedule is None:
            return 0.0
        try:
            sch = people.activity_schedule.default_day_schedule
            vals = sch.values
            return sum(vals) / len(vals) if vals else 0.0
        except Exception:
            return 0.0