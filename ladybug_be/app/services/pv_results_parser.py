"""
Parser EnergyPlus SQL výstupu pro PV simulaci.

Ladybug `SQLiteResult` (sql.py:331) automaticky převádí jednotky z "J" na "kWh"
v header. Pro Annual reporting vrací scalar float, pro Hourly/Monthly
DataCollection — obojí už v kWh.
"""
from __future__ import annotations

from typing import List, Dict, Any

from ladybug.sql import SQLiteResult

from .panel_placer import PanelPosition


def parse_panel_results(
    sql_path: str, panels: List[PanelPosition]
) -> Dict[str, Any]:
    """
    Parsuje per-panel PV výrobu + shaded POA z SQL a vrátí dict ve formátu
    kompatibilním s `PVSimulator.simulate()` konzumenty (panel_optimizer).

    `panel_results[i].ep_solar_potential_kwh_m2` = EP reálná POA se shadingem
    (vytaženo z `Surface Outside Face Incident Solar Radiation Rate per Area`).
    """
    sql = SQLiteResult(sql_path)
    all_data = sql.data_collections_by_output_name(
        "Generator Produced DC Electricity Energy"
    )
    if not all_data:
        raise RuntimeError(
            "EnergyPlus SQL neobsahuje 'Generator Produced DC Electricity Energy'.\n"
            "Dostupné výstupy: " + str(sql.available_outputs)
        )

    poa_by_shade = _parse_incident_solar_by_shade(sql)

    panel_results = []
    total = 0.0
    for i, panel in enumerate(panels):
        item = all_data[i] if i < len(all_data) else 0.0
        annual_kwh = _kwh_from_item(item)
        total += annual_kwh
        panel_results.append({
            "panel_id": panel.id,
            "shade_id": panel.shade.identifier,
            "annual_production_kwh": round(annual_kwh, 2),
            "ep_solar_potential_kwh_m2": round(
                poa_by_shade.get(panel.shade.identifier.upper(), 0.0), 2
            ),
        })

    return {
        "annual_production_kwh": round(total, 2),
        "panel_results": panel_results,
        "simulation_engine": "EnergyPlus_PVWatts",
        "hourly_available": False,
    }


def _parse_incident_solar_by_shade(sql: SQLiteResult) -> Dict[str, float]:
    """
    Sečte `Surface Outside Face Incident Solar Radiation Rate per Area`
    (hodinové W/m²) přes rok → roční POA v kWh/m² per surface.

    EP tuhle hodnotu počítá s vlastním polygon-clipping shadingem, takže
    obsahuje reálné stínění budovy + sousedních shadů.
    """
    data = sql.data_collections_by_output_name(
        "Surface Outside Face Incident Solar Radiation Rate per Area"
    )
    result: Dict[str, float] = {}
    for dc in data:
        meta = getattr(dc, "header", None)
        if meta is None:
            continue
        # Header.metadata obsahuje {'type': ..., 'Surface': <SURFACE_NAME>}
        surface_name = meta.metadata.get("Surface") if hasattr(meta, "metadata") else None
        if not surface_name:
            continue
        # Sum W/m² × 1h → Wh/m², /1000 → kWh/m²
        total_wh_m2 = sum(v for v in dc.values if v is not None)
        result[surface_name.upper()] = total_wh_m2 / 1000.0
    return result


def _kwh_from_item(item) -> float:
    """
    Annual scalar (float) → už v kWh.
    DataCollection → sum(.values); pokud je unit "J", přepočti /3_600_000.
    """
    if isinstance(item, (int, float)):
        return float(item)
    header = getattr(item, "header", None)
    unit = getattr(header, "unit", None) if header else None
    total = sum(item.values)
    if unit == "J":
        return total / 3_600_000
    return total
