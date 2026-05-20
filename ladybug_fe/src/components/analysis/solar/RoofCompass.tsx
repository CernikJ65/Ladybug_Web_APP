import React from 'react';
import { SVG_W } from './panelMapConstants';
import { useT } from '../../../i18n/useT';

interface Props {
  compassRotateDeg: number;
}

/** Vraci pismeno svetove strany (S/V/J/Z), ktere po rotaci kompasu
 *  skonci na jeho vrcholu — tedy smer, kterym ukazuje horni hrana SVG. */
function topCardinal(rotateDeg: number): 'S' | 'V' | 'J' | 'Z' {
  const a = ((rotateDeg % 360) + 360) % 360;
  if (a < 45 || a >= 315) return 'S';
  if (a < 135) return 'Z';
  if (a < 225) return 'J';
  return 'V';
}

const RoofCompass: React.FC<Props> = ({ compassRotateDeg }) => {
  const t = useT();
  const cx = SVG_W - 22, cy = 22, r = 13;
  const top = topCardinal(compassRotateDeg);

  const HIGHLIGHT = '#ef4444';
  const MUTED = '#9ca3af';
  const colorFor = (d: 'S' | 'V' | 'J' | 'Z') => (d === top ? HIGHLIGHT : MUTED);
  const weightFor = (d: 'S' | 'V' | 'J' | 'Z') => (d === top ? 700 : 600);

  return (
    <g>
      {/* Staticky podklad — neotaci se. Sipka tim porad miri na horni hranu SVG. */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="rgba(255,255,255,0.92)"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={0.7}
      />
      <line
        x1={cx - r + 3} y1={cy} x2={cx + r - 3} y2={cy}
        stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
      />
      <line
        x1={cx} y1={cy - r + 3} x2={cx} y2={cy + r - 3}
        stroke="rgba(0,0,0,0.06)" strokeWidth={0.4}
      />

      {/* Cervena sipka vzdy nahoru — odpovida cervenemu pismeni nahore. */}
      <polygon
        points={`${cx},${cy - r + 2.5} ${cx - 2.5},${cy - 0.5} ${cx + 2.5},${cy - 0.5}`}
        fill={HIGHLIGHT}
      />
      <polygon
        points={`${cx},${cy + r - 2.5} ${cx - 2.5},${cy + 0.5} ${cx + 2.5},${cy + 0.5}`}
        fill="#cbd5e1"
      />

      {/* Pismena rotuji se svetem (S porad miri na skutecny sever),
          ale kazde se counter-rotuje, aby zustalo citelne. Pismeno
          ktere skonci nahore se obarvi cervene = "tam miri horni hrana". */}
      <g transform={`rotate(${compassRotateDeg.toFixed(2)}, ${cx}, ${cy})`}>
        <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx}, ${cy - r + 0.5})`}>
          <text
            x={cx} y={cy - r + 0.5}
            fill={colorFor('S')}
            fontSize={6.5}
            fontWeight={weightFor('S')}
            textAnchor="middle"
            fontFamily="'Sora', sans-serif"
            dominantBaseline="auto"
          >{t('S')}</text>
        </g>
        <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx}, ${cy + r + 5})`}>
          <text
            x={cx} y={cy + r + 5}
            fill={colorFor('J')}
            fontSize={6.5}
            fontWeight={weightFor('J')}
            textAnchor="middle"
            fontFamily="'Sora', sans-serif"
          >{t('J')}</text>
        </g>
        <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx + r + 4}, ${cy + 2.5})`}>
          <text
            x={cx + r + 4} y={cy + 2.5}
            fill={colorFor('V')}
            fontSize={6.5}
            fontWeight={weightFor('V')}
            textAnchor="middle"
            fontFamily="'Sora', sans-serif"
          >{t('V')}</text>
        </g>
        <g transform={`rotate(${(-compassRotateDeg).toFixed(2)}, ${cx - r - 4}, ${cy + 2.5})`}>
          <text
            x={cx - r - 4} y={cy + 2.5}
            fill={colorFor('Z')}
            fontSize={6.5}
            fontWeight={weightFor('Z')}
            textAnchor="middle"
            fontFamily="'Sora', sans-serif"
          >{t('Z')}</text>
        </g>
      </g>

      <circle cx={cx} cy={cy} r={0.8} fill="#6b7280" />
    </g>
  );
};

export default RoofCompass;