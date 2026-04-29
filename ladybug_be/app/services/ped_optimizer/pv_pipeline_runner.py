"""
Wrapper kolem stavajicich solar trid + pvlib mesicni simulator.

Pipeline (Radiance + pvlib varianta — ne EnergyPlus):
  1. RoofDetector             — detekce strech v HBJSON
  2. SolarRadiationCalculator — SkyMatrix z EPW (Radiance)
  3. TiltOptimizer            — RadiationDome -> optimalni sklon
  4. PanelPlacer              — mrizkove umisteni panelu
  5. RadiationStudy           — radiace per panel (Radiance, vc. shadingu)
  6. PanelOptimizer           — predbezna vyroba (radiace -> kWh)
  7. PVLibMonthlySimulator    — pvlib pvwatts_dc s mesicnim breakdownem

Vrati seznam panelu serazenych desc podle rocni vyroby + mesicni
profil per panel.

Soubor: ladybug_be/app/services/ped_optimizer/pv_pipeline_runner.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ..roof_detector import RoofDetector
from ..panel_placer import PanelPlacer
from ..solar_calculator import SolarRadiationCalculator
from ..tilt_optimizer import TiltOptimizer
from ..panel_optimizer import PanelOptimizer
from .pv_lib_monthly_simulator import PVLibMonthlySimulator


class PVPipelineRunner:
    """Spusti kompletni Radiance+pvlib pipeline a vrati per-panel data."""

    def __init__(
        self,
        hbjson_path: str,
        epw_path: str,
        pv_efficiency: float = 0.20,
        system_losses: float = 0.10,
        mounting_type: str = "FixedOpenRack",
    ):
        self._hbjson = hbjson_path
        self._epw = epw_path
        self._eff = pv_efficiency
        self._losses = system_losses
        self._mounting = mounting_type

    def run(self, max_panels: int) -> Dict[str, Any]:
        """
        Vrati:
          panel_annual_kwh:  List[float]      sorted desc
          panel_monthly_kwh: List[List[float]] sorted desc, 12 hodnot
          max_available:     int              skutecny pocet vsech panelu
        """
        detector = RoofDetector(self._hbjson)
        roofs = detector.detect_roofs(max_tilt=60.0)
        if not roofs:
            return self._empty()
        context = detector.get_context_geometry()

        calc = SolarRadiationCalculator(self._epw)
        calc.load_and_prepare()
        loc = calc.get_location_info()
        latitude = loc.get("latitude", 50.0)

        tilt_opt = TiltOptimizer(calc.sky_matrix, calc.location)

        placer = PanelPlacer(
            panel_width=1.0, panel_height=1.7,
            spacing=0.3, tilt_optimizer=tilt_opt,
            latitude=latitude,
        )
        all_panels = placer.place_on_all_roofs(roofs)
        if not all_panels:
            return self._empty()

        rad_values = calc.calculate_panel_radiation(all_panels, context)
        optimizer = PanelOptimizer(self._eff, self._losses)
        optimizer.assign_radiation(all_panels, rad_values)

        # Pre-rank podle radiation-based predikce — bereme TOP-N kandidatu
        # pro pvlib (pvlib je rychly, ale stejne nema smysl pocitat panely
        # ktere se nikdy do varianty nedostanou).
        ep_count = min(
            len(all_panels),
            max(max_panels + 1, int((max_panels + 1) * 1.2)),
        )
        sorted_pre = sorted(
            all_panels,
            key=lambda p: p.annual_production_kwh,
            reverse=True,
        )
        candidates = sorted_pre[:ep_count]

        sim = PVLibMonthlySimulator(
            epw_path=self._epw,
            rated_efficiency=self._eff,
            mounting_type=self._mounting,
        )
        res = sim.simulate(candidates)

        annual = res["panel_annual_kwh"]
        monthly = res["panel_monthly_kwh"]
        panels_with_data = [
            (candidates[i], annual[i], monthly[i])
            for i in range(len(candidates))
        ]
        # Final sort podle pvlib rocni vyroby
        panels_with_data.sort(key=lambda t: t[1], reverse=True)

        return {
            "panel_annual_kwh": [t[1] for t in panels_with_data],
            "panel_monthly_kwh": [t[2] for t in panels_with_data],
            "max_available": len(all_panels),
        }

    @staticmethod
    def _empty() -> Dict[str, Any]:
        return {
            "panel_annual_kwh": [],
            "panel_monthly_kwh": [],
            "max_available": 0,
        }

    @staticmethod
    def sum_top_n(values: List[float], n: int) -> float:
        """Soucet TOP-N hodnot (predpoklada se serazene desc)."""
        if n <= 0 or not values:
            return 0.0
        return float(sum(values[:n]))

    @staticmethod
    def sum_top_n_monthly(
        monthly_per_panel: List[List[float]], n: int,
    ) -> List[float]:
        """Soucet mesicnich profilu pro TOP-N panelu -> 12 floatu."""
        if n <= 0 or not monthly_per_panel:
            return [0.0] * 12
        top = monthly_per_panel[:n]
        return [
            round(sum(p[m] for p in top), 1) for m in range(12)
        ]
