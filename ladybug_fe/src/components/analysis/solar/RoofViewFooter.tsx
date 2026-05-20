import React from 'react';
import { useT } from '../../../i18n/useT';

interface Props {
  avgRadiation: number;
  totalProduction: number;
}

const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

const RoofViewFooter: React.FC<Props> = ({ avgRadiation, totalProduction }) => {
  const t = useT();
  return (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: '1px solid rgba(0,0,0,0.05)',
  }}>
    <div style={{ padding: '11px 16px' }}>
      <div style={{
        fontSize: 9,
        color: '#9ca3af',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 2,
      }}>
        {t('Solární potenciál')}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#111827',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '-0.01em',
      }}>
        {avgRadiation.toFixed(0)}
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: '#9ca3af',
          marginLeft: 4,
        }}>
          kWh/m²
        </span>
      </div>
    </div>
    <div style={{ padding: '11px 16px', textAlign: 'right' }}>
      <div style={{
        fontSize: 9,
        color: '#9ca3af',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 2,
      }}>
        {t('Roční výroba')}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#111827',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '-0.01em',
      }}>
        {fmt(totalProduction)}
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: '#9ca3af',
          marginLeft: 4,
        }}>
          kWh
        </span>
      </div>
    </div>
  </div>
  );
};

export default RoofViewFooter;
