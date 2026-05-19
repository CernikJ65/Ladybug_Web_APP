/**
 * Karty 3 variant — bez ikon, bez "best" indikátoru,
 * bez status řádku (PED %) a bez schodku.
 *
 * Soubor: ladybug_fe/src/components/analysis/ped_optimizer/PedVariantCards.tsx
 */
import React from 'react';
import type { PedVariant } from './pedTypes';
import { useT } from '../../../i18n/useT';

interface Props {
  variants: PedVariant[];
  bestIndex: number;
  selectedIndex: number;
  onSelect: (i: number) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ');
const fmtS = (n: number) => (n >= 0 ? '+' : '') + fmt(n);

const PedVariantCards: React.FC<Props> = ({
  variants, selectedIndex, onSelect,
}) => {
  const t = useT();
  return (
  <div className="ped-variants">
    {variants.map((v, i) => {
      const isSelected = i === selectedIndex;
      const cls =
        'ped-variant'
        + (isSelected ? ' selected' : '')
        + (!v.system.available ? ' unavailable' : '');

      return (
        <div
          key={v.system.key}
          className={cls}
          onClick={() => v.system.available && onSelect(i)}
        >
          <div className="ped-variant-name">{t(v.system.label)}</div>
          {v.system.num_panels > 0 && (
            <div className="ped-variant-name-sub">
              {t('{{n}} panelů', { n: v.system.num_panels })}
            </div>
          )}

          {!v.system.available
            ? <UnavailableBody reason={v.system.unavailable_reason} />
            : <AvailableBody v={v} />}
        </div>
      );
    })}
  </div>
  );
};

const UnavailableBody: React.FC<{ reason: string }> = ({ reason }) => {
  const t = useT();
  return (
  <div className="ped-variant-unavail">
    <strong>{t('Variantu nelze realizovat')}</strong>
    <small>{t(reason)}</small>
  </div>
  );
};

const AvailableBody: React.FC<{ v: PedVariant }> = ({ v }) => {
  const t = useT();
  return (
  <>
    <div className={'ped-variant-balance ' + (v.is_ped ? 'pos' : 'neg')}>
      <span className="ped-variant-balance-num">
        {fmtS(v.balance_kwh ?? 0)}
      </span>
      <span className="ped-variant-balance-unit">{t('kWh / rok')}</span>
    </div>

    <div className="ped-variant-rows">
      <Row
        label={t('Výroba FVE')}
        tone="pv"
        num={fmt(v.pv_production_kwh ?? 0)}
        unit="kWh"
      />
      <Row
        label={t('Spotřeba budovy')}
        tone="cons"
        num={fmt(v.consumption_kwh?.total ?? 0)}
        unit="kWh"
      />
    </div>

    <div className="ped-variant-cost">
      <div className="ped-variant-cost-row">
        <span className="ped-variant-cost-row-label">{t('Cena celkem')}</span>
        <span className="ped-variant-cost-row-value">
          <span className="ped-variant-cost-row-num">
            {fmt(v.system.total_cost_czk)}
          </span>
          <span className="ped-variant-cost-row-unit">{t('Kč')}</span>
        </span>
      </div>
    </div>
  </>
  );
};

interface RowProps {
  label: string;
  tone: 'pv' | 'cons' | 'deficit';
  num: string;
  unit: string;
}

const Row: React.FC<RowProps> = ({ label, tone, num, unit }) => (
  <div className="ped-variant-row">
    <span className="ped-variant-row-label">{label}</span>
    <span className={`ped-variant-row-value ${tone}`}>
      <span className="ped-variant-row-num">{num}</span>
      <span className="ped-variant-row-unit">{unit}</span>
    </span>
  </div>
);

export default PedVariantCards;