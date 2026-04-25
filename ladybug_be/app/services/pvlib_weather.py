"priprava klimaticyhch dat do pvlib"
from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd
import pvlib
from ladybug.epw import EPW

from .panel_placer import PanelPosition


def load_epw_weather(epw_path: str) -> Tuple[pd.DataFrame, float, float]:
    """EPW → (hodinový DataFrame s ghi/dni/dhi/temp_air/wind_speed, lat, lon)."""
    epw = EPW(epw_path)
    idx = pd.date_range("2001-01-01", periods=8760, freq="h")
    df = pd.DataFrame({
        "ghi": list(epw.global_horizontal_radiation.values),
        "dni": list(epw.direct_normal_radiation.values),
        "dhi": list(epw.diffuse_horizontal_radiation.values),
        "temp_air": list(epw.dry_bulb_temperature.values),
        "wind_speed": list(epw.wind_speed.values),
    }, index=idx)
    return df, float(epw.location.latitude), float(epw.location.longitude)


def poa_hourly_shape(
    weather: pd.DataFrame,
    latitude: float,
    longitude: float,
    reference_panel: PanelPosition,
) -> np.ndarray:
    """
    Normalizovaný hodinový tvar POA na referenčním panelu (součet = 1.0).

    Slouží jako distribuce pro rozložení Radiance ročního POA [kWh/m²]
    na hodinové hodnoty [W/m²]. Tvar respektuje EPW sluneční profil,
    absolutní hodnota (roční integrál) zůstává z Radiance se shadingem.
    """
    solar_position = pvlib.solarposition.get_solarposition(
        weather.index, latitude=latitude, longitude=longitude,
    )
    tilt = max(0.0, min(90.0, float(reference_panel.tilt)))
    azimuth = float(reference_panel.azimuth) % 360.0

    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        solar_zenith=solar_position["apparent_zenith"],
        solar_azimuth=solar_position["azimuth"],
        dni=weather["dni"],
        ghi=weather["ghi"],
        dhi=weather["dhi"],
    )["poa_global"].fillna(0.0).clip(lower=0.0).to_numpy()

    total = poa.sum()
    if total <= 0:
        return np.zeros(8760)
    return poa / total
