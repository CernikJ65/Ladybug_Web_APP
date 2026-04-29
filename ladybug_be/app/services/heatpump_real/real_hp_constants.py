"""
Konstanty pro Real HP simulaci — vintage, mapa typu budov,
HVAC konfigurace ASHP/GSHP (plain + DOAS varianty).

Soubor: ladybug_be/app/services/heatpump_real/real_hp_constants.py
"""
from __future__ import annotations

from typing import Dict, Tuple

from honeybee_energy.hvac.heatcool.fcu import FCU
from honeybee_energy.hvac.heatcool.wshp import WSHP
from honeybee_energy.hvac.doas.fcu import FCUwithDOAS
from honeybee_energy.hvac.doas.wshp import WSHPwithDOAS

VINTAGE = "ASHRAE_2019"
CZ_BUILDING_TYPE = "Residential"

# UI hodnoty -> Ladybug program identifier
BUILDING_TYPE_MAP: Dict[str, str] = {
    "Residential": "MidriseApartment",
    "Office": "MediumOffice",
    "Retail": "Retail",
    "School": "SecondarySchool",
    "Hotel": "SmallHotel",
    "Hospital": "Hospital",
}

# (DOAS class, sys id, eq), (plain class, sys id, eq)
HVAC_CONFIGS: Dict[str, Dict[str, Tuple]] = {
    "ASHP": {
        "doas": (
            FCUwithDOAS, "ASHP_FCUwithDOAS_System",
            "DOAS_FCU_ACChiller_ASHP",
        ),
        "plain": (
            FCU, "ASHP_FCU_System", "FCU_ACChiller_ASHP",
        ),
    },
    "GSHP": {
        "doas": (
            WSHPwithDOAS, "GSHP_WSHPwithDOAS_System",
            "DOAS_WSHP_GSHP",
        ),
        "plain": (
            WSHP, "GSHP_WSHP_System", "WSHP_GSHP",
        ),
    },
}