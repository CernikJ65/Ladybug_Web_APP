"""
Priprava honeybee modelu s realnym HVAC (ASHP / GSHP).

Vyber sablony:
  - ERV=0 -> plain FCU/WSHP (bez ventilace)
  - ERV>0 -> FCUwithDOAS / WSHPwithDOAS (s ventilaci a rekuperaci)

V heating-only rezimu nastavime cooling setpoint zony na 50 C.
Tim vypneme zonove FCU/WSHP cooling coily v jednotlivych mistnostech.
Centralni DOAS unit dal funguje normalne — udrzi supply vzduch
v komfortnich 15-21 C podle venkovni teploty.

Nucene vetrani: pro fair porovnani s/bez rekuperace nastavujeme
mistnostem konstantni vetraci 0.3 l/s/m2 (0.0003 m3/s/m2) dle
CSN 73 0540-2, doporuceni pro nucene vetrani rezidencnich budov.
Bez teto upravy by hbjson hodnoty (jen flow_per_person) davaly
~110 m3/h pro cely dum, coz je pro vzduchotesny plast s rekuperaci
podventilovani — DOAS by parazitne zral elektrinu na fans, ale
rekuperace by nemela co recyklovat.

CZ kalibrace pres building_type='Residential' + apply_cz=True.

Soubor: ladybug_be/app/services/heatpump_real/real_hp_model_preparer.py
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional, Tuple

from honeybee.model import Model
from honeybee.room import Room

from honeybee_energy.load.setpoint import Setpoint
from honeybee_energy.load.ventilation import Ventilation
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.lib.programtypes import (
    building_program_type_by_identifier,
)
import honeybee_energy.lib.scheduletypelimits as _tl

from .real_hp_constants import (
    VINTAGE, CZ_BUILDING_TYPE,
    BUILDING_TYPE_MAP, HVAC_CONFIGS,
)

logger = logging.getLogger(__name__)

# CSN 73 0540-2: 0.3 l/s/m2 konstantni vetrani pro RD s rekuperaci
FORCED_VENT_M3S_PER_M2 = 0.0003


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
        apply_cz_calibration: bool = True,
    ):
        self._path = hbjson_path
        self._btype = building_type
        self._heating_sp = heating_setpoint_c
        self._cooling_sp = 50.0 if heating_only else cooling_setpoint_c
        self._heating_only = heating_only
        self._hr = max(0.0, min(0.95, heat_recovery))
        self._apply_cz = apply_cz_calibration
        self._program = self._load_program()

    def prepare_ashp(self) -> Model:
        """ASHP — plain FCU (bez ERV) / FCUwithDOAS (s ERV)."""
        return self._prepare("ASHP", *self._build_hvac("ASHP"))

    def prepare_gshp(self) -> Model:
        """GSHP — plain WSHP (bez ERV) / WSHPwithDOAS (s ERV)."""
        return self._prepare("GSHP", *self._build_hvac("GSHP"))

    def get_rooms_info(self) -> List[Dict[str, Any]]:
        rooms = []
        for r in self._load_fresh().rooms:
            if r.floor_area < 0.1:
                continue
            bb_min, bb_max = r.geometry.min, r.geometry.max
            rooms.append({
                "identifier": r.identifier,
                "display_name": r.display_name,
                "floor_area_m2": round(r.floor_area, 2),
                "dim_x_m": round(bb_max.x - bb_min.x, 2),
                "dim_y_m": round(bb_max.y - bb_min.y, 2),
            })
        return rooms

    def get_total_floor_area(self) -> float:
        m = self._load_fresh()
        return sum(r.floor_area for r in m.rooms if r.floor_area >= 0.1)

    def get_program_setpoints(self) -> Dict[str, float]:
        sp = self._program.setpoint
        return {"heating_setpoint_c": round(sp.heating_setpoint, 1),
                "cooling_setpoint_c": round(sp.cooling_setpoint, 1)}

    def get_program_name(self) -> str:
        return self._program.identifier

    def get_applied_setpoints(self) -> Dict[str, float]:
        p = self._program.setpoint
        h = self._heating_sp if self._heating_sp is not None else round(p.heating_setpoint, 1)
        c = self._cooling_sp if self._cooling_sp is not None else round(p.cooling_setpoint, 1)
        return {"heating_setpoint_c": h, "cooling_setpoint_c": c}

    def _build_hvac(self, system: str) -> Tuple[Any, str]:
        """Vrati (hvac, log_tag). DOAS pri ERV>0, jinak plain.

        DCV=False: DOAS bezi konstantne, nikoli podle obsazenosti.
        Nucene vetrani s rekuperaci v rezidenci ma jet 24/7.
        """
        cfg = HVAC_CONFIGS[system]
        if self._hr > 0:
            cls, ident, eq = cfg["doas"]
            hvac = cls(
                ident, vintage=VINTAGE, equipment_type=eq,
                sensible_heat_recovery=self._hr,
                latent_heat_recovery=self._hr * 0.9,
                demand_controlled_ventilation=False,
                doas_availability_schedule=None,
            )
            mode = "heating-only" if self._heating_only else "topeni+chlaz"
            return hvac, (
                f"{cls.__name__} + {eq}, ERV={self._hr:.2f} ({mode})"
            )
        cls, ident, eq = cfg["plain"]
        hvac = cls(ident, vintage=VINTAGE, equipment_type=eq)
        return hvac, f"{cls.__name__} + {eq} (bez DOAS)"

    def _prepare(self, label: str, hvac: Any, tag: str) -> Model:
        model = self._load_and_prepare()
        for room in model.rooms:
            room.properties.energy.hvac = hvac
        logger.info("%s -> %s (%d rooms)", label, tag, len(model.rooms))
        return model

    def _load_program(self):
        pt_id = BUILDING_TYPE_MAP.get(self._btype, self._btype)
        return building_program_type_by_identifier(pt_id)

    def _load_and_prepare(self) -> Model:
        model = self._load_fresh()
        for room in model.rooms:
            re = room.properties.energy
            saved_infil = re._infiltration
            re.program_type = self._program
            re.reset_loads_to_program()
            if saved_infil is not None:
                re.infiltration = saved_infil
            # Nucene vetrani 0.3 l/s/m2 dle CSN 73 0540-2 (vzdy).
            # Hbjson flow_per_person je nedostatecne pro rekuperaci.
            re.ventilation = Ventilation(
                identifier=f"{room.identifier}_ForcedVent",
                flow_per_person=0.0,
                flow_per_area=FORCED_VENT_M3S_PER_M2,
                flow_per_zone=0.0,
                air_changes_per_hour=0.0,
                schedule=None,  # always_on default
            )
            if self._has_setpoint_override():
                self._apply_setpoint_override(room)
        if self._apply_cz and self._btype == CZ_BUILDING_TYPE:
            from app.services.shared.cz_program_calibrator \
                import CZResidentialCalibrator
            model = CZResidentialCalibrator(model).calibrate()
        total_area = sum(r.floor_area for r in model.rooms)
        total_flow = total_area * FORCED_VENT_M3S_PER_M2 * 3600
        logger.info(
            "Nucene vetrani: %.1f m3/h (%.1f m2 x 0.3 l/s/m2)",
            total_flow, total_area,
        )
        return model

    def _has_setpoint_override(self) -> bool:
        return self._heating_sp is not None or self._cooling_sp is not None

    def _apply_setpoint_override(self, room: Room) -> None:
        prog = self._program.setpoint
        h = self._heating_sp if self._heating_sp is not None else prog.heating_setpoint
        c = self._cooling_sp if self._cooling_sp is not None else prog.cooling_setpoint
        rid = room.identifier
        mk = lambda s, v: ScheduleRuleset.from_constant_value(s, v, _tl.temperature)
        room.properties.energy.setpoint = Setpoint(
            f"{rid}_SP", mk(f"{rid}_HtgSP", h), mk(f"{rid}_ClgSP", c),
        )

    def _load_fresh(self) -> Model:
        with open(self._path, "r", encoding="utf-8") as f:
            return Model.from_dict(json.load(f))