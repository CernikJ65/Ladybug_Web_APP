import React from 'react';
import { useT } from '../../../i18n/useT';

interface Props {
  roofId: string;
  panelsCount: number;
  tilt: number;
  orientation: string;
}

const RoofViewHeader: React.FC<Props> = ({ roofId, panelsCount, tilt, orientation }) => {
  const t = useT();
  const roofNames = roofId.split('+').map(s => s.trim()).filter(Boolean);
  const panelLabel = panelsCount === 1 ? t('panel') : panelsCount < 5 ? t('panely') : t('panelů');

  return (
    <div style={{ padding: '14px 16px 10px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {roofNames.map((name, idx) => (
              <span
                key={`${name}-${idx}`}
                title={name}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '-0.01em',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {name}
              </span>
            ))}
          </div>
          <span style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: '#6b7280',
            letterSpacing: '-0.005em',
          }}>
            {panelsCount} {panelLabel}
          </span>
        </div>
        <span style={{
          fontSize: 13,
          color: '#111827',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          textAlign: 'right',
          paddingTop: 1,
        }}>
          {tilt < 5
            ? t('plochá střecha')
            : t('sklon {{tilt}}°, orientace na {{ori}}', { tilt: tilt.toFixed(0), ori: t(orientation) })}
        </span>
      </div>
    </div>
  );
};

export default RoofViewHeader;
