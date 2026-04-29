/**
 * Karty 3 variant — vyber varianty + zobrazeni dostupnosti / PED stavu.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedVariantCards.tsx
 */
import React from 'react';
import { FaStar, FaBan, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import type { PedVariant } from './pedTypes';

interface Props {
  variants: PedVariant[];
  bestIndex: number;
  selectedIndex: number;
  onSelect: (i: number) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
const fmtS = (n: number) => (n >= 0 ? '+' : '') + fmt(n);
const pct = (r: number) => Math.round(r * 100);

const PedVariantCards: React.FC<Props> = ({
  variants, bestIndex, selectedIndex, onSelect,
}) => (
  <div className="ped-variants">
    {variants.map((v, i) => {
      const isBest = i === bestIndex && v.system.available;
      const isSelected = i === selectedIndex;
      const cls =
        'ped-variant'
        + (isBest ? ' best' : '')
        + (isSelected ? ' selected' : '')
        + (!v.system.available ? ' unavailable' : '');

      return (
        <div
          key={v.system.key}
          className={cls}
          onClick={() => v.system.available && onSelect(i)}
        >
          {isBest && (
            <span className="ped-variant-badge">
              <FaStar style={{ fontSize: 8, marginRight: 4 }} />
              Nejlepší PED
            </span>
          )}
          <div className="ped-variant-name">
            {v.system.label}
            {v.system.num_panels > 0 && (
              <> + {v.system.num_panels} panelů</>
            )}
          </div>
          {!v.system.available ? (
            <UnavailableBody reason={v.system.unavailable_reason} />
          ) : (
            <AvailableBody v={v} />
          )}
        </div>
      );
    })}
  </div>
);

const UnavailableBody: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="ped-variant-unavail">
    <FaBan className="ped-icon-ban" />
    <p>Variantu nelze realizovat</p>
    <small>{reason}</small>
  </div>
);

const AvailableBody: React.FC<{ v: PedVariant }> = ({ v }) => (
  <>
    <div className={`ped-variant-balance ${v.is_ped ? 'pos' : 'neg'}`}>
      {v.is_ped ? <FaCheckCircle /> : <FaTimesCircle />}
      <span>
        {fmtS(v.balance_kwh ?? 0)} kWh
      </span>
    </div>
    <div className="ped-variant-sub">
      PED {pct(v.ped_ratio ?? 0)} %
      {v.heating_uncovered && ' · vytápění nepokryto'}
    </div>

    <div className="ped-vr">
      <span>FVE výroba</span>
      <span className="pv">{fmt(v.pv_production_kwh ?? 0)} kWh</span>
    </div>
    <div className="ped-vr">
      <span>Spotřeba budovy</span>
      <span className="cons">
        {fmt(v.consumption_kwh?.total ?? 0)} kWh
        {(v.consumption_per_m2_kwh ?? 0) > 0 && (
          <small> ({v.consumption_per_m2_kwh?.toFixed(1)} kWh/m²)</small>
        )}
      </span>
    </div>
    {(v.deficit_kwh ?? 0) > 0 && (
      <div className="ped-vr">
        <span>Schodek</span>
        <span className="deficit">{fmt(v.deficit_kwh ?? 0)} kWh</span>
      </div>
    )}

    <div className="ped-variant-cost">
      {v.system.has_hp && (
        <>{v.system.hp_label} {fmt(v.system.hp_cost_czk)} Kč</>
      )}
      {v.system.has_hp && v.system.num_panels > 0 && ' + '}
      {v.system.num_panels > 0 && (
        <>{v.system.num_panels}× panel {fmt(v.system.pv_cost_czk)} Kč</>
      )}
      {' = '}
      {fmt(v.system.total_cost_czk)} Kč
      {v.system.remaining_czk > 0 && (
        <> (zbývá {fmt(v.system.remaining_czk)} Kč)</>
      )}
    </div>
  </>
);

export default PedVariantCards;
