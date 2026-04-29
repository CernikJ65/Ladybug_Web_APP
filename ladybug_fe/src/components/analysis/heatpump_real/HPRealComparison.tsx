/**
 * Porovnani TC — tab switcher mezi Porovnanim a detaily.
 *
 * Tab "Porovnani" zobrazuje obe TC vedle sebe s diff procenty,
 * taby "ASHP" a "GSHP" zobrazuji detail jednoho systemu pres
 * komponentu HPRealSection.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealComparison.tsx
 */
import React, { useState } from 'react';
import {
  FaWind, FaMountain, FaBalanceScale, FaFire,
  FaSnowflake, FaBolt,
} from 'react-icons/fa';
import HPRealSection from './HPRealSection';
import type { HPSystemResult, RoomDemand } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props {
  ashp: HPSystemResult;
  gshp: HPSystemResult;
  rooms: RoomDemand[];
  heatingOnly?: boolean;
}

type Tab = 'compare' | 'ashp' | 'gshp';

const HPRealComparison: React.FC<Props> = ({
  ashp, gshp, rooms, heatingOnly = false,
}) => {
  const [tab, setTab] = useState<Tab>('compare');

  return (
    <section className="hp-card hp-compare-wrap">
      <div className="hp-compare-tabs" role="tablist">
        <button type="button"
          className={`hp-compare-tab ${tab === 'compare' ? 'active' : ''}`}
          onClick={() => setTab('compare')}>
          <FaBalanceScale /> Porovnání
        </button>
        <button type="button"
          className={`hp-compare-tab ${tab === 'ashp' ? 'active' : ''}`}
          onClick={() => setTab('ashp')}>
          <FaWind /> ASHP
        </button>
        <button type="button"
          className={`hp-compare-tab ${tab === 'gshp' ? 'active' : ''}`}
          onClick={() => setTab('gshp')}>
          <FaMountain /> GSHP
        </button>
      </div>

      {tab === 'compare' && (
        <CompareView ashp={ashp} gshp={gshp}
          heatingOnly={heatingOnly} />
      )}
      {tab === 'ashp' && (
        <HPRealSection data={ashp}
          rooms={rooms} heatingOnly={heatingOnly} />
      )}
      {tab === 'gshp' && (
        <HPRealSection data={gshp}
          rooms={rooms} heatingOnly={heatingOnly} />
      )}
    </section>
  );
};

interface CompareProps {
  ashp: HPSystemResult;
  gshp: HPSystemResult;
  heatingOnly: boolean;
}

const CompareView: React.FC<CompareProps> = ({
  ashp, gshp, heatingOnly,
}) => {
  const rows: Array<{
    icon: React.ReactNode; label: string; unit: string;
    a: number; g: number; betterIsLower?: boolean;
  }> = [
    {
      icon: <FaFire />, label: 'COP topení', unit: '',
      a: ashp.cop_heating, g: gshp.cop_heating,
    },
    ...(heatingOnly ? [] : [{
      icon: <FaSnowflake />, label: 'COP chlazení', unit: '',
      a: ashp.cop_cooling, g: gshp.cop_cooling,
    }]),
    {
      icon: <FaBalanceScale />, label: 'COP celoroční', unit: '',
      a: ashp.cop_annual, g: gshp.cop_annual,
    },
    {
      icon: <FaBolt />, label: 'Spotřeba elektřiny',
      unit: 'kWh',
      a: ashp.annual_electricity_kwh,
      g: gshp.annual_electricity_kwh,
      betterIsLower: true,
    },
  ];

  return (
    <>
      <div className="hp-compare-heroes">
        <CompareHero label="ASHP Vzduch-voda" icon={<FaWind />}
          color="ashp" cop={ashp.cop_annual} />
        <CompareHero label="GSHP Země-voda" icon={<FaMountain />}
          color="gshp" cop={gshp.cop_annual} />
      </div>

      <div className="hp-compare-rows">
        {rows.map((r, i) => {
          const aBetter = r.betterIsLower
            ? r.a < r.g
            : r.a > r.g;
          const diff = r.a === 0 ? 0
            : ((r.g - r.a) / r.a) * 100;
          return (
            <div key={i} className="hp-compare-row">
              <span className={`hp-comp-val ${aBetter ? 'best' : ''}`}>
                {r.unit ? fmt(r.a) : r.a.toFixed(2)}
              </span>
              <div className="hp-comp-mid">
                <span className="hp-comp-icon">{r.icon}</span>
                <span className="hp-comp-label">{r.label}</span>
                {r.unit && (
                  <span className="hp-comp-unit">{r.unit}</span>
                )}
              </div>
              <span className={`hp-comp-val ${!aBetter ? 'best' : ''}`}>
                {r.unit ? fmt(r.g) : r.g.toFixed(2)}
              </span>
              <span className="hp-comp-diff">
                {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
};

const CompareHero: React.FC<{
  label: string; icon: React.ReactNode;
  color: 'ashp' | 'gshp'; cop: number;
}> = ({ label, icon, color, cop }) => (
  <div className={`hp-compare-hero hp-compare-hero--${color}`}>
    <span className="hp-compare-hero-icon">{icon}</span>
    <span className="hp-compare-hero-name">{label}</span>
    <span className="hp-compare-hero-cop">{cop.toFixed(2)}</span>
    <span className="hp-compare-hero-lbl">COP celoroční</span>
  </div>
);

export default HPRealComparison;