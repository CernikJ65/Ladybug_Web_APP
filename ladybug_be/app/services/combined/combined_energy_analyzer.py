"""
PED analyzátor — volá SKUTEČNÉ existující simulace.

Solární pipeline (plná EnergyPlus PV simulace):
  RoofDetector → PanelPlacer → SolarRadiationCalculator
  → TiltOptimizer → PanelOptimizer → PVSimulator (E+)

TČ pipeline (plná EnergyPlus tepelná simulace):
  HeatPumpPotentialAnalyzer → E+ heating → COP → metriky

Měsíční distribuce FVE výroby:
  E+ dá roční součet per panel. Měsíční rozložení odvodíme
  z GHI profilu v EPW souboru (proporcionálně).

Soubor: ladybug_be/app/services/combined/combined_energy_analyzer.py
"""
from __future__ import annotations

from typing import Dict, Any, List

from ladybug.epw import EPW

from .cost_config import CostConfig
from .budget_allocator import BudgetAllocator, SystemVariant

MONTH_NAMES = [
    "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
]
HOURS_PER_MONTH = [
    744, 672, 744, 720, 744, 720,
    744, 744, 720, 744, 720, 744,
]


class CombinedEnergyAnalyzer:
    """PED analyzátor — obě E+ simulace + rozpočet."""

    def __init__(
        self,
        hp_result: Dict[str, Any],
        hbjson_path: str,
        epw_path: str,
        budget_czk: float,
        pv_efficiency: float = 0.20,
        system_losses: float = 0.10,
        config: CostConfig | None = None,
    ):
        self._hp = hp_result
        self._hbjson = hbjson_path
        self._epw = epw_path
        self._budget = budget_czk
        self._eff = pv_efficiency
        self._losses = system_losses
        self._cfg = config or CostConfig()

    def analyze(self) -> Dict[str, Any]:
        """Kompletní PED analýza — všechny varianty."""
        alloc = BudgetAllocator(self._cfg)
        variants = alloc.generate_variants(self._budget)
        heating = self._hp["simulation"]["total_heating_kwh"]

        # Měsíční GHI profil z EPW (pro rozložení E+ ročního součtu)
        monthly_ghi_frac = self._monthly_ghi_fractions()

        # Solární simulace — spustí se jednou pro max panelů
        max_panels = max(
            (v.num_panels for v in variants), default=0,
        )
        solar_result = None
        if max_panels > 0:
            solar_result = self._run_solar_pipeline(max_panels)

        results = []
        for v in variants:
            r = self._evaluate_variant(
                v, heating, solar_result,
                monthly_ghi_frac,
            )
            results.append(r)

        results.sort(
            key=lambda x: x["ped_balance_kwh"], reverse=True,
        )
        return {
            "heating_demand_kwh": round(heating, 1),
            "variants": results,
            "best_index": 0,
        }

    # ----------------------------------------------------------
    # Solární pipeline — volá STÁVAJÍCÍ třídy
    # ----------------------------------------------------------

    def _run_solar_pipeline(
        self, num_panels: int,
    ) -> Dict[str, Any]:
        """
        Plná solární pipeline přes existující služby.

        Vrací sorted (desc) seznam roční výroby per panel — combined
        analyzer si pak pro každou rozpočtovou variantu sečte TOP-N.
        """
        from ..roof_detector import RoofDetector
        from ..panel_placer import PanelPlacer
        from ..solar_calculator import SolarRadiationCalculator
        from ..panel_optimizer import PanelOptimizer
        from ..tilt_optimizer import TiltOptimizer
        from ..pv_simulator import PVSimulator

        # 1. Detekce střech
        detector = RoofDetector(self._hbjson)
        roofs = detector.detect_roofs(max_tilt=60.0)
        if not roofs:
            return {"panel_productions_kwh": [], "max_available": 0}
        context = detector.get_context_geometry()

        # 2. Klimatická data + optimální sklon
        calc = SolarRadiationCalculator(self._epw)
        calc.load_and_prepare()
        loc = calc.get_location_info()
        latitude = loc.get("latitude", 50.0)

        tilt_opt = TiltOptimizer(calc.sky_matrix, calc.location)

        # 3. Umístění panelů
        placer = PanelPlacer(
            panel_width=1.0, panel_height=1.7,
            spacing=0.3, tilt_optimizer=tilt_opt,
            latitude=latitude,
        )
        all_panels = placer.place_on_all_roofs(roofs)
        if not all_panels:
            return {"panel_productions_kwh": [], "max_available": 0}

        # 4. RadiationStudy → radiace
        rad_values = calc.calculate_panel_radiation(
            all_panels, context,
        )

        # 5. Optimizer — přiřazení radiace
        optimizer = PanelOptimizer(self._eff, self._losses)
        optimizer.assign_radiation(all_panels, rad_values)

        # 6. EnergyPlus PV simulace (TOP kandidáti)
        ep_count = min(
            len(all_panels),
            max(num_panels + 1, int((num_panels + 1) * 1.2)),
        )
        sorted_panels = sorted(
            all_panels,
            key=lambda p: p.annual_production_kwh,
            reverse=True,
        )
        ep_candidates = sorted_panels[:ep_count]

        pv_sim = PVSimulator(
            epw_path=self._epw,
            rated_efficiency=self._eff,
        )
        pv_sim.assign_pv_properties(ep_candidates)
        ep_results = pv_sim.simulate(
            ep_candidates, detector.model,
        )

        # 7. Aplikuj E+ výsledky a seřaď podle finální výroby
        optimizer.apply_energyplus_production(
            ep_candidates, ep_results,
        )
        sorted_with_prod = sorted(
            ep_candidates,
            key=lambda p: p.annual_production_kwh,
            reverse=True,
        )
        panel_productions = [
            p.annual_production_kwh for p in sorted_with_prod
        ]

        return {
            "panel_productions_kwh": panel_productions,
            "max_available": len(all_panels),
        }

    # ----------------------------------------------------------
    # Vyhodnocení jedné varianty
    # ----------------------------------------------------------

    def _evaluate_variant(
        self,
        v: SystemVariant,
        heating: float,
        solar: Dict[str, Any] | None,
        ghi_frac: List[float],
    ) -> Dict[str, Any]:
        """Vyhodnotí jednu variantu z rozpočtu."""
        # TČ data
        hp_data = self._get_hp_data(v.hp_type)
        hp_elec = hp_data["electricity_kwh"]
        hp_renewable = hp_data["renewable_kwh"]
        hp_scop = hp_data["scop"]
        monthly_hp_elec = hp_data["monthly_elec"]

        # FVE data — z reálné E+ simulace.
        # Sečti TOP-N panelů (sorted desc) pro tuto rozpočtovou variantu.
        annual_pv = 0.0
        if solar and v.num_panels > 0:
            prods = solar.get("panel_productions_kwh", [])
            annual_pv = sum(prods[:v.num_panels])

        # Měsíční FVE distribuce z GHI profilu
        monthly_pv = [
            round(annual_pv * f, 1) for f in ghi_frac
        ]

        # Měsíční bilance
        monthly = []
        heat_weights = [
            1.4, 1.3, 1.0, 0.6, 0.1, 0, 0, 0, 0.1, 0.7, 1.2, 1.6,
        ]
        w_sum = sum(heat_weights)
        for m in range(12):
            pv_m = monthly_pv[m]
            hp_m = monthly_hp_elec[m]
            heat_m = heating * heat_weights[m] / w_sum
            renew_m = max(heat_m - hp_m, 0)
            bal = pv_m - hp_m
            monthly.append({
                "month": MONTH_NAMES[m],
                "pv_kwh": round(pv_m, 1),
                "hp_elec_kwh": round(hp_m, 1),
                "hp_renewable_kwh": round(renew_m, 1),
                "elec_balance_kwh": round(bal, 1),
                "is_positive": bal >= 0,
            })

        ped_balance = annual_pv - hp_elec
        pos_months = sum(1 for m in monthly if m["is_positive"])

        return {
            "system": BudgetAllocator.variant_to_dict(v),
            "pv_production_kwh": round(annual_pv, 1),
            "hp_electricity_kwh": round(hp_elec, 1),
            "hp_renewable_kwh": round(hp_renewable, 1),
            "hp_scop": round(hp_scop, 2),
            "total_renewable_kwh": round(
                annual_pv + hp_renewable, 1,
            ),
            "ped_balance_kwh": round(ped_balance, 1),
            "is_ped": ped_balance >= 0,
            "positive_months": pos_months,
            "monthly": monthly,
        }

    # ----------------------------------------------------------
    # Pomocné metody
    # ----------------------------------------------------------

    def _get_hp_data(self, hp_type: str) -> Dict[str, Any]:
        """Extrahuje TČ data ze stávajícího HP výsledku."""
        heating = self._hp["simulation"]["total_heating_kwh"]

        if hp_type == "none":
            # Bez TČ → přímotop (COP=1): spotřeba = celé teplo
            heat_w = [
                1.4, 1.3, 1.0, 0.6, 0.1, 0,
                0, 0, 0.1, 0.7, 1.2, 1.6,
            ]
            w_sum = sum(heat_w)
            monthly = [
                round(heating * w / w_sum, 1) for w in heat_w
            ]
            return {
                "electricity_kwh": heating,
                "renewable_kwh": 0,
                "scop": 1.0,
                "monthly_elec": monthly,
            }

        key = "ashp" if hp_type == "ashp" else "gshp"
        hp = self._hp.get(key, {})
        metrics = hp.get("energy_metrics", {})
        elec = metrics.get("electricity_kwh", 0)
        monthly = metrics.get(
            "monthly_electricity_kwh", [0] * 12,
        )
        renewable = max(heating - elec, 0)
        scop = hp.get("annual_avg_cop", 0)
        return {
            "electricity_kwh": elec,
            "renewable_kwh": renewable,
            "scop": scop,
            "monthly_elec": monthly,
        }

    def _monthly_ghi_fractions(self) -> List[float]:
        """Měsíční podíl GHI — pro rozložení E+ ročního součtu."""
        epw = EPW(self._epw)
        ghi = list(epw.global_horizontal_radiation.values)
        monthly_sums = []
        idx = 0
        for hours in HOURS_PER_MONTH:
            monthly_sums.append(sum(ghi[idx:idx + hours]))
            idx += hours
        total = sum(monthly_sums)
        if total <= 0:
            return [1 / 12] * 12
        return [s / total for s in monthly_sums]