"""
Extrakce klimatických dat z EPW pro analýzu tepelných čerpadel.

Ladybug funkce:
  - EPW → dry_bulb_temperature, monthly_ground_temperature
  - EPW → annual_heating_design_day_996, annual_cooling_design_day_004
  - HourlyContinuousCollection, MonthlyCollection

Soubor: ladybug_be/app/services/epw_climate_extractor.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.epw import EPW
from ladybug.location import Location
from ladybug.header import Header
from ladybug.analysisperiod import AnalysisPeriod
from ladybug.datacollection import HourlyContinuousCollection
from ladybug.datacollection import MonthlyCollection
from ladybug.datatype.temperature import Temperature

HOURS_PER_MONTH = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744]


class EPWClimateExtractor:
    """Extrahuje klimatická data z EPW pro analýzu TČ."""

    def __init__(self, epw_path: str):
        self._epw = EPW(epw_path)
        self._location: Location = self._epw.location

    @property
    def location(self) -> Location:
        return self._location

    @property
    def epw(self) -> EPW:
        return self._epw

    def get_hourly_air_temps(self) -> HourlyContinuousCollection:
        """Hodinové teploty venkovního vzduchu (°C) — zdroj ASHP."""
        return self._epw.dry_bulb_temperature

    def get_design_days(self) -> list:
        """Návrhové dny z EPW pro dimenzování HVAC v EnergyPlus."""
        dds = []
        heat_dd = self._epw.annual_heating_design_day_996
        cool_dd = self._epw.annual_cooling_design_day_004
        if heat_dd is not None:
            dds.append(heat_dd)
        if cool_dd is not None:
            dds.append(cool_dd)
        return dds

    def get_ground_temp_depths(self) -> List[float]:
        """Hloubky půdních teplot v EPW (typicky 0.5, 2.0, 4.0 m)."""
        return sorted(self._epw.monthly_ground_temperature.keys())

    def get_hourly_ground_temps(
        self, depth_m: float,
    ) -> HourlyContinuousCollection:
        """Hodinové půdní teploty (expandované z měsíčních) — zdroj GSHP."""
        monthly = self._get_monthly_ground(depth_m)
        monthly_vals = list(monthly.values)

        hourly_vals: List[float] = []
        for mi, mt in enumerate(monthly_vals):
            hourly_vals.extend([mt] * HOURS_PER_MONTH[mi])

        header = Header(
            data_type=Temperature(), unit="C",
            analysis_period=AnalysisPeriod(),
            metadata={"source": "EPW Ground", "depth_m": str(depth_m)},
        )
        return HourlyContinuousCollection(header, hourly_vals)

    def get_location_info(self) -> Dict[str, Any]:
        loc = self._location
        return {
            "city": loc.city,
            "country": getattr(loc, "country", ""),
            "latitude": round(loc.latitude, 3),
            "longitude": round(loc.longitude, 3),
            "elevation": round(loc.elevation, 1),
            "timezone": loc.time_zone,
        }

    def get_climate_summary(self) -> Dict[str, Any]:
        air = self.get_hourly_air_temps()
        air_monthly = air.average_monthly()

        ground_data: Dict[str, List[float]] = {}
        for depth in self.get_ground_temp_depths():
            monthly = self._get_monthly_ground(depth)
            ground_data[str(depth)] = [round(v, 1) for v in monthly.values]

        hdd = sum(max(0, 18.0 - t) / 24.0 for t in air.values)

        # Ladybug filter_by_conditional_statement — mrazové hodiny
        frost = air.filter_by_conditional_statement("a < 0")
        frost_hours = len(list(frost.values))

        # EPW.ashrae_climate_zone — klimatická zóna ASHRAE
        climate_zone = self._epw.ashrae_climate_zone

        return {
            "annual_avg_temp_c": round(
                sum(air.values) / len(air.values), 1,
            ),
            "min_temp_c": round(min(air.values), 1),
            "max_temp_c": round(max(air.values), 1),
            "heating_degree_days": round(hdd, 0),
            "monthly_avg_temp_c": [round(v, 1) for v in air_monthly.values],
            "ground_temps_by_depth": ground_data,
            "frost_hours": frost_hours,
            "ashrae_climate_zone": climate_zone,
        }

    # ------------------------------------------------------------------

    def _get_monthly_ground(self, depth_m: float) -> MonthlyCollection:
        temps = self._epw.monthly_ground_temperature
        if depth_m in temps:
            return temps[depth_m]
        return self._interpolate_depth(depth_m)

    def _interpolate_depth(self, target: float) -> MonthlyCollection:
        depths = self.get_ground_temp_depths()
        if not depths:
            raise ValueError("EPW neobsahuje data o teplotě půdy.")
        lower = max((d for d in depths if d <= target), default=depths[0])
        upper = min((d for d in depths if d >= target), default=depths[-1])
        temps = self._epw.monthly_ground_temperature

        if lower == upper:
            return temps[lower]

        ratio = (target - lower) / (upper - lower)
        lv = list(temps[lower].values)
        uv = list(temps[upper].values)
        interp = [round(l + ratio * (u - l), 2) for l, u in zip(lv, uv)]

        header = Header(
            data_type=Temperature(), unit="C",
            analysis_period=AnalysisPeriod(),
            metadata={"source": "EPW Ground Interpolated"},
        )
        return MonthlyCollection(header, interp, list(range(1, 13)))