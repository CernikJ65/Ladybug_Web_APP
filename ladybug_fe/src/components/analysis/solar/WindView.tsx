import React, { useState } from 'react';
import { FaWind, FaChartBar, FaCompass } from 'react-icons/fa';

/* ---------- exportované typy ---------- */
export interface DirectionBin {
  index: number; label: string; angle: number;
  total_hours: number; frequency_pct: number;
  bins: number[]; avg_speed: number;
}
export interface DirectionFrequency {
  directions: DirectionBin[]; speed_labels: string[];
  max_hours: number;
}
export interface MonthlySpeed {
  month: number; name: string;
  avg_speed: number; max_speed: number;
}
export interface BeaufortItem {
  label: string; hours: number; pct: number;
}
export interface WindSummary {
  avg_speed: number; max_speed: number;
  calm_hours: number; calm_pct: number;
  prevailing_dir: string; prevailing_angle: number;
}
export interface WindData {
  direction_frequency: DirectionFrequency;
  monthly_speed: MonthlySpeed[];
  beaufort: BeaufortItem[];
  summary: WindSummary;
}

interface Props { data: WindData; }

const BIN_COLORS = [
  'rgba(94,122,148,.15)', '#38bdf8', '#22d3ee',
  '#4ade80', '#facc15', '#f97316', '#ef4444',
];
const CX = 200; const CY = 200; const R = 170;
const toXY = (a: number, r: number): [number, number] => {
  const rad = (a - 90) * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
};
const wedge = (
  a: number, iR: number, oR: number, hw: number,
): string => {
  const [ix1, iy1] = toXY(a - hw, iR);
  const [ox1, oy1] = toXY(a - hw, oR);
  const [ox2, oy2] = toXY(a + hw, oR);
  const [ix2, iy2] = toXY(a + hw, iR);
  return `M${ix1.toFixed(1)},${iy1.toFixed(1)} `
    + `L${ox1.toFixed(1)},${oy1.toFixed(1)} `
    + `A${oR},${oR} 0 0,1 ${ox2.toFixed(1)},${oy2.toFixed(1)} `
    + `L${ix2.toFixed(1)},${iy2.toFixed(1)} Z`;
};

interface Tip {
  x: number; y: number;
  label: string;
  pct: number; avg: number; hours: number;
}

const WindView: React.FC<Props> = ({ data }) => {
  const {
    direction_frequency: df, monthly_speed,
    beaufort, summary,
  } = data;
  const [hovered, setHovered] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const maxH = df.max_hours || 1;
  const halfW = 360 / 16 / 2 - 1;
  const maxBar = Math.max(
    ...monthly_speed.map(m => m.avg_speed), 1,
  );
  const maxBeau = Math.max(...beaufort.map(b => b.pct), 1);

  const onHover = (e: React.MouseEvent, d: DirectionBin) => {
    const rect = (e.currentTarget as SVGElement)
      .closest('svg')!.getBoundingClientRect();
    setHovered(d.index);
    setTip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 50,
      label: d.label, pct: d.frequency_pct,
      avg: d.avg_speed, hours: d.total_hours,
    });
  };

  return (
    <div className="sv">
      <div className="tv-stats" data-tour="wind-stats">
        {[
          { v: `${summary.avg_speed}`, l: 'Průměrná rychlost větru m/s' },
          { v: `${summary.max_speed}`, l: 'Maximální rychlost větru m/s' },
          { v: summary.prevailing_dir, l: 'Převládající směr větru' },
          {
            v: `${summary.calm_pct}%`, l: 'Kolik % času tvořilo bezvětří',
            sub: `${summary.calm_hours} h`,
          },
        ].map((c, i) => (
          <div className="tv-stat" key={i}>
            <div className="tv-stat-val">{c.v}</div>
            <div className="tv-stat-lbl">{c.l}</div>
            {'sub' in c && c.sub && (
              <div className="tv-stat-sub">{c.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* SVG WIND ROSE */}
      <h3 className="tv-title">
        <FaCompass /> Větrná růžice
      </h3>
      <div className="sv-diagram-wrap" data-tour="wind-rose">
        <div style={{
          position: 'relative', display: 'inline-block',
        }}>
          <svg viewBox="0 0 400 400" className="sv-svg"
            onMouseLeave={() => {
              setHovered(null); setTip(null);
            }}>
            {[0.25, 0.5, 0.75, 1].map(f => (
              <circle key={f} cx={CX} cy={CY} r={R * f}
                fill="none" stroke="rgba(94,122,148,.1)"
                strokeWidth={0.6} />
            ))}
            {[
              { a: 0, l: 'S' }, { a: 45, l: 'SV' },
              { a: 90, l: 'V' }, { a: 135, l: 'JV' },
              { a: 180, l: 'J' }, { a: 225, l: 'JZ' },
              { a: 270, l: 'Z' }, { a: 315, l: 'SZ' },
            ].map(({ a, l }) => {
              const [x2, y2] = toXY(a, R);
              const [lx, ly] = toXY(a, R + 14);
              return (
                <g key={a}>
                  <line x1={CX} y1={CY} x2={x2} y2={y2}
                    stroke="rgba(94,122,148,.08)"
                    strokeWidth={0.5} />
                  <text x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={a % 90 === 0 ? '11' : '8'}
                    fontWeight={a % 90 === 0 ? '800' : '600'}
                    fill="rgba(94,122,148,.5)"
                    fontFamily="'Outfit', sans-serif">
                    {l}
                  </text>
                </g>
              );
            })}
            {df.directions.map(d => {
              let cumR = 8;
              return (
                <g key={d.index}
                  onMouseMove={e => onHover(e, d)}
                  onMouseLeave={() => {
                    setHovered(null); setTip(null);
                  }}
                  style={{ cursor: 'pointer' }}>
                  {d.bins.map((count, bi) => {
                    if (count === 0 || bi === 0) {
                      cumR += (count / maxH) * R * 0.85;
                      return null;
                    }
                    const iR = cumR;
                    const oR = cumR + (count / maxH) * R * 0.85;
                    cumR = oR;
                    return (
                      <path key={bi}
                        d={wedge(d.angle, iR, oR, halfW)}
                        fill={BIN_COLORS[bi] || BIN_COLORS[6]}
                        opacity={
                          hovered === null ? 0.8
                            : hovered === d.index ? 1 : 0.2
                        }
                        stroke="rgba(12,17,23,.4)"
                        strokeWidth={0.5}
                        style={{ transition: 'opacity .2s' }}
                      />
                    );
                  })}
                </g>
              );
            })}
            {summary.calm_pct > 0 && (
              <circle cx={CX} cy={CY}
                r={Math.max(4, summary.calm_pct / 100 * 20)}
                fill="rgba(94,122,148,.2)"
                stroke="rgba(94,122,148,.3)"
                strokeWidth={0.8} />
            )}
          </svg>
          {tip && (
            <div className="sv-tooltip"
              style={{ left: tip.x, top: tip.y }}>
              <span className="sv-tooltip-month">
                {tip.label}
              </span>{' '}
              <span className="sv-tooltip-val">
                {tip.pct}% · ⌀ {tip.avg} m/s · {tip.hours} h
              </span>
            </div>
          )}
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'center', gap: '.3rem .7rem',
          marginTop: '.75rem', fontSize: '.7rem',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {df.speed_labels.slice(1).map((lbl, i) => (
            <span key={i} style={{
              display: 'flex', alignItems: 'center',
              gap: '.25rem', color: '#5e7a94',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: BIN_COLORS[i + 1],
                display: 'inline-block',
              }} />
              {lbl} m/s
            </span>
          ))}
        </div>
      </div>

      {/* MĚSÍČNÍ RYCHLOSTI */}
      <h3 className="tv-title">
        <FaWind /> Průmerná rychlost větru pro jednotlivé měsíce
      </h3>
      <div className="tv-bars" data-tour="wind-monthly">
        {monthly_speed.map(m => (
          <div className="tv-bar-row" key={m.month}>
            <span className="tv-bar-lbl">{m.name}</span>
            <div className="tv-bar-track">
              <div className="tv-bar sun" style={{
                width: `${(m.avg_speed / maxBar) * 100}%`,
              }}>
                {m.avg_speed > maxBar * 0.2
                  ? `${m.avg_speed}` : ''}
              </div>
            </div>
            <span className="tv-bar-val">
              {m.avg_speed} m/s (max {m.max_speed})
            </span>
          </div>
        ))}
      </div>

      {/* BEAUFORT */}
      <h3 className="tv-title">
        <FaChartBar /> Beaufortova stupnice
      </h3>
      <div className="tv-bars" data-tour="wind-beaufort">
        {beaufort.filter(b => b.hours > 0).map((b, i) => (
          <div className="tv-bar-row" key={i}>
            <span className="tv-bar-lbl" style={{ width: 90 }}>
              {b.label}
            </span>
            <div className="tv-bar-track">
              <div className="tv-bar sun" style={{
                width: `${(b.pct / maxBeau) * 100}%`,
              }}>
                {b.pct > maxBeau * 0.15 ? `${b.pct}%` : ''}
              </div>
            </div>
            <span className="tv-bar-val" style={{ width: 110 }}>
              {b.pct}% · {b.hours} h
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WindView;