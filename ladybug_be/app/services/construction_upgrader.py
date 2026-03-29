"""
Upgrade honeybee modelu na nízkoenergetický standard PED.

Honeybee-energy třídy:
  - EnergyMaterial → vrstvené materiály s λ, ρ, c
  - OpaqueConstruction → stěny, střechy, podlahy
  - WindowConstruction.from_simple_parameters() → trojskla
  - ConstructionSet, WallConstructionSet, ... → přiřazení

Výchozí generické konstrukce honeybee mají U ≈ 2–3 W/m²K.
Tento upgrader je nahradí zateplenými (U ≈ 0.12–0.21).

Soubor: ladybug_be/app/services/construction_upgrader.py
"""
from __future__ import annotations

import logging
from typing import Optional

from honeybee.model import Model
from honeybee.room import Room

from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.construction.window import WindowConstruction
from honeybee_energy.constructionset import (
    ConstructionSet,
    WallConstructionSet,
    FloorConstructionSet,
    RoofCeilingConstructionSet,
    ApertureConstructionSet,
)

logger = logging.getLogger(__name__)

# Identifikátor sady konstrukcí PED
PED_SET_ID = "PED_LowEnergy_Set"


class ConstructionUpgrader:
    """Nahradí generické konstrukce nízkoenergetickými."""

    def __init__(self):
        self._constr_set: Optional[ConstructionSet] = None

    def upgrade(self, model: Model) -> Model:
        """Přiřadí PED ConstructionSet všem rooms v modelu."""
        cs = self._build_construction_set()
        for room in model.rooms:
            room.properties.energy.construction_set = cs
        logger.info(
            "ConstructionUpgrader: přiřazeno '%s' → %d rooms",
            PED_SET_ID, len(model.rooms),
        )
        return model

    def _build_construction_set(self) -> ConstructionSet:
        """Sestaví ConstructionSet s PED konstrukcemi."""
        if self._constr_set is not None:
            return self._constr_set

        ext_wall = self._ext_wall()
        int_wall = self._int_wall()
        roof = self._roof()
        ground_floor = self._ground_floor()
        int_floor = self._int_floor()
        window = self._triple_glazing()

        wall_set = WallConstructionSet(ext_wall, int_wall)
        floor_set = FloorConstructionSet(
            ground_floor, int_floor, ground_floor,
        )
        roof_set = RoofCeilingConstructionSet(
            roof, int_floor,
        )
        aperture_set = ApertureConstructionSet(
            window, window, window, window,
        )

        self._constr_set = ConstructionSet(
            PED_SET_ID,
            wall_set, floor_set, roof_set, aperture_set,
        )
        return self._constr_set

    # ── Jednotlivé konstrukce ──

    @staticmethod
    def _ext_wall() -> OpaqueConstruction:
        """Obvodová stěna ETICS: U ≈ 0.14 W/m²K."""
        layers = [
            EnergyMaterial(
                "PED_Omitka_Ext", 0.015, 0.87,
                1800, 840, "MediumRough",
            ),
            EnergyMaterial(
                "PED_EPS_200", 0.200, 0.032,
                20, 1450, "MediumSmooth",
            ),
            EnergyMaterial(
                "PED_Zdivo_300", 0.300, 0.52,
                1400, 900, "MediumRough",
            ),
            EnergyMaterial(
                "PED_Omitka_Int", 0.015, 0.70,
                1600, 840, "MediumSmooth",
            ),
        ]
        return OpaqueConstruction("PED_Ext_Wall", layers)

    @staticmethod
    def _int_wall() -> OpaqueConstruction:
        """Interiérová příčka."""
        layers = [
            EnergyMaterial(
                "PED_IntOmitka_1", 0.015, 0.70,
                1600, 840, "MediumSmooth",
            ),
            EnergyMaterial(
                "PED_Zdivo_Int_150", 0.150, 0.52,
                1400, 900, "MediumRough",
            ),
            EnergyMaterial(
                "PED_IntOmitka_2", 0.015, 0.70,
                1600, 840, "MediumSmooth",
            ),
        ]
        return OpaqueConstruction("PED_Int_Wall", layers)

    @staticmethod
    def _roof() -> OpaqueConstruction:
        """Plochá střecha zateplená: U ≈ 0.12 W/m²K."""
        layers = [
            EnergyMaterial(
                "PED_Hydroizolace", 0.005, 0.17,
                1200, 1000, "Smooth",
            ),
            EnergyMaterial(
                "PED_EPS_250", 0.250, 0.032,
                20, 1450, "MediumSmooth",
            ),
            EnergyMaterial(
                "PED_ZB_Deska_200", 0.200, 1.58,
                2400, 920, "MediumRough",
            ),
        ]
        return OpaqueConstruction("PED_Roof", layers)

    @staticmethod
    def _ground_floor() -> OpaqueConstruction:
        """Podlaha na zemině: U ≈ 0.21 W/m²K."""
        layers = [
            EnergyMaterial(
                "PED_ZB_150", 0.150, 1.58,
                2400, 920, "MediumRough",
            ),
            EnergyMaterial(
                "PED_XPS_150", 0.150, 0.034,
                35, 1450, "MediumSmooth",
            ),
        ]
        return OpaqueConstruction("PED_Ground_Floor", layers)

    @staticmethod
    def _int_floor() -> OpaqueConstruction:
        """Mezipodlažní strop."""
        layers = [
            EnergyMaterial(
                "PED_Poter", 0.050, 1.16,
                2000, 840, "MediumSmooth",
            ),
            EnergyMaterial(
                "PED_ZB_Strop_200", 0.200, 1.58,
                2400, 920, "MediumRough",
            ),
        ]
        return OpaqueConstruction("PED_Int_Floor", layers)

    @staticmethod
    def _triple_glazing() -> WindowConstruction:
        """Izolační trojsklo: U=0.7, SHGC=0.50, VT=0.60."""
        return WindowConstruction.from_simple_parameters(
            "PED_Triple_Glazing",
            u_factor=0.7,
            shgc=0.50,
            vt=0.60,
        )