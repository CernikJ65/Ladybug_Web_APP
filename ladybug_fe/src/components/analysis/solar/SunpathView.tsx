import React, { useState } from 'react';
import { FaCompass, FaSun } from 'react-icons/fa';

/* ---------- exportované typy ---------- */
export interface SunPoint {
  hour?: number; month?: number;
  altitude: number; azimuth: number;
}
export interface DailyArc {
  month: number; name: string; day: number;
  points: SunPoint[]; max_altitude: number;
}
export interface DayLength {
  month: number; name: string; sunrise: string; sunset: string;
  day_length_h: number; noon_altitude: number;
}
export interface Analemma {
  hour: number; label: string; points: SunPoint[];
}
export interface SunpathData {
  daily_arcs: DailyArc[];
  day_length: DayLength[];
  analemmas?: Analemma[];
  location: { latitude: number; longitude: number };
}

interface Props { data: SunpathData; }

/* ---------- barvy ---------- */
const COLORS = [
  '#3b82f6', '#38bdf8', '#22d3ee', '#2dd4bf', '#4ade80', '#a3e635',
  '#facc15', '#f59e0b', '#f97316', '#ef4444', '#a855f7', '#818cf8',
];

/* ---------- chart rozměry ---------- */
const W = 720; const H = 340;
const PAD = { top: 20, right: 30, bottom: 35, left: 45 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;
const H_MIN = 3; const H_MAX = 22;
const A_MAX = 70;

const toX = (hour: number) => PAD.left + ((hour - H_MIN) / (H_MAX - H_MIN)) * CW;
const toY = (alt: number) => PAD.top + CH - (alt / A_MAX) * CH;

const arcToPath = (pts: SunPoint[]): string => {
  const visible = pts.filter(p => {
    const h = p.hour ?? 0;
    return h >= H_MIN && h <= H_MAX && p.altitude >= 0 && p.altitude < 90;
  });
  if (visible.length < 2) return '';

  const extended = [...visible];
  const [p0, p1] = [extended[0], extended[1]];
  const [pN2, pN1] = [extended[extended.length - 2], extended[extended.length - 1]];

  // Linearni extrapolace — hodina, kdy by krivka protnula alt=0
  if (p0.altitude > 0 && p1.altitude > p0.altitude) {
    const slope = (p1.altitude - p0.altitude) / ((p1.hour ?? 0) - (p0.hour ?? 0));
    const hourAtZero = (p0.hour ?? 0) - p0.altitude / slope;
    extended.unshift({ hour: hourAtZero, altitude: 0, azimuth: p0.azimuth });
  }
  if (pN1.altitude > 0 && pN2.altitude > pN1.altitude) {
    const slope = (pN1.altitude - pN2.altitude) / ((pN1.hour ?? 0) - (pN2.hour ?? 0));
    const hourAtZero = (pN1.hour ?? 0) - pN1.altitude / slope;
    extended.push({ hour: hourAtZero, altitude: 0, azimuth: pN1.azimuth });
  }

  return extended
    .map((p, i) => `${i ? 'L' : 'M'}${toX(p.hour ?? 0).toFixed(1)},${toY(Math.min(p.altitude, A_MAX)).toFixed(1)}`)
    .join(' ');
};

interface TooltipInfo { x: number; y: number; month: string; hour: number; alt: number; }

/* ---------- komponenta ---------- */
const SunpathView: React.FC<Props> = ({ data }) => {
  const { daily_arcs, day_length } = data;
  const [hovered, setHovered] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipInfo | null>(null);
  const maxLen = Math.max(...day_length.map(d => d.day_length_h), 1);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const hour = H_MIN + ((mx - PAD.left) / CW) * (H_MAX - H_MIN);
    if (hour < H_MIN || hour > H_MAX || hovered === null) {
      setTip(null); return;
    }
    const arc = daily_arcs[hovered];
    const closest = arc.points.reduce((best, p) =>
      Math.abs((p.hour ?? 0) - hour) < Math.abs((best.hour ?? 0) - hour) ? p : best
    );
    setTip({
      x: toX(closest.hour ?? 0),
      y: toY(closest.altitude),
      month: arc.name,
      hour: closest.hour ?? 0,
      alt: closest.altitude,
    });
  };

  return (
    <div className="sv">
      <h3 className="tv-title"><FaCompass />Pozice slunce 21. dne v měsíci</h3>
      <div className="sv-diagram-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="sv-svg"
          onMouseMove={handleMove}
          onMouseLeave={() => { setHovered(null); setTip(null); }}>
          <defs>
            {COLORS.map((c, i) => (
              <filter key={`g${i}`} id={`gl${i}`}>
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
          </defs>

          {/* Gridlines - horizontal */}
          {[0, 10, 20, 30, 40, 50, 60].map(a => (
            <g key={a}>
              <line x1={PAD.left} y1={toY(a)} x2={W - PAD.right} y2={toY(a)}
                stroke="rgba(94,122,148,.12)" strokeWidth={a === 0 ? 1 : 0.5}
                strokeDasharray={a === 0 ? 'none' : '4,4'} />
              <text x={PAD.left - 8} y={toY(a) + 4} textAnchor="end"
                fontSize="9" fill="rgba(94,122,148,.5)"
                fontFamily="'JetBrains Mono', monospace">{a}°</text>
            </g>
          ))}

          {/* Gridlines - vertical (hours) */}
          {Array.from({ length: H_MAX - H_MIN + 1 }, (_, i) => H_MIN + i).map(h => (
            <g key={h}>
              <line x1={toX(h)} y1={PAD.top} x2={toX(h)} y2={H - PAD.bottom}
                stroke="rgba(94,122,148,.08)" strokeWidth={0.5} />
              <text x={toX(h)} y={H - PAD.bottom + 16} textAnchor="middle"
                fontSize="8" fill="rgba(94,122,148,.5)"
                fontFamily="'JetBrains Mono', monospace">{h}:00</text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={W / 2} y={H - 2} textAnchor="middle"
            fontSize="13" fill="#ffffff"
            fontFamily="'Outfit', sans-serif">Hodina dne</text>
          <text x={12} y={H / 2} textAnchor="middle"
            fontSize="13" fill="#ffffff"
            fontFamily="'Outfit', sans-serif"
            transform={`rotate(-90, 12, ${H / 2})`}>Výška °</text>

          {/* Sun arcs */}
          {daily_arcs.map((arc, i) => (
            <path key={arc.month} d={arcToPath(arc.points)}
              fill="none" stroke={COLORS[i]}
              strokeWidth={hovered === i ? 3 : 1.8}
              strokeLinecap="round"
              opacity={hovered === null ? 0.75 : hovered === i ? 1 : 0.12}
              filter={hovered === i ? `url(#gl${i})` : undefined}
              style={{ transition: 'opacity .2s, stroke-width .2s', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
            />
          ))}

          {/* Peak dots */}
          {daily_arcs.map((arc, i) => {
            const peak = arc.points.reduce((a, b) => b.altitude > a.altitude ? b : a);
            return (
              <circle key={`p${i}`} cx={toX(peak.hour ?? 12)} cy={toY(peak.altitude)}
                r={hovered === i ? 5 : 3} fill={COLORS[i]}
                opacity={hovered === null ? 0.8 : hovered === i ? 1 : 0.1}
                style={{ transition: 'all .2s' }} />
            );
          })}

          {/* Hover crosshair + tooltip */}
          {tip && (
            <g>
              <line x1={tip.x} y1={PAD.top} x2={tip.x} y2={H - PAD.bottom}
                stroke="rgba(240,165,0,.3)" strokeWidth={1} strokeDasharray="3,3" />
              <line x1={PAD.left} y1={tip.y} x2={W - PAD.right} y2={tip.y}
                stroke="rgba(240,165,0,.3)" strokeWidth={1} strokeDasharray="3,3" />
              <circle cx={tip.x} cy={tip.y} r={6} fill="none"
                stroke="rgba(240,165,0,.8)" strokeWidth={1.5} />
              <rect x={tip.x + 10} y={tip.y - 28} width={130} height={22}
                rx={6} fill="rgba(21,29,39,.95)" stroke="rgba(240,165,0,.4)" strokeWidth={1} />
              <text x={tip.x + 16} y={tip.y - 14} fontSize="9"
                fontFamily="'JetBrains Mono', monospace" fill="#f0a500">
                {tip.month} {Math.floor(tip.hour)}:{String(Math.round((tip.hour % 1) * 60)).padStart(2, '0')} · {tip.alt.toFixed(1)}°
              </text>
            </g>
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '.3rem .7rem',
          marginTop: '.75rem', fontSize: '.72rem', fontFamily: "'Outfit', sans-serif" }}>
          {daily_arcs.map((arc, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '.25rem',
              color: hovered === null || hovered === i ? '#c9d6e3' : '#253545',
              cursor: 'pointer', transition: 'color .2s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}>
              <span style={{ width: 14, height: 3, borderRadius: 2,
                background: COLORS[i], display: 'inline-block' }} />
              {arc.name}
            </span>
          ))}
        </div>
      </div>

      {/* DÉLKA DNE – tabulka */}
      <h3 className="tv-title"><FaSun /> Východ a západ slunce a délka dne (21. den v měsíci) </h3>
      <div className="tv-table-wrap">
        <table className="tv-table">
          <thead>
            <tr><th>Měsíc</th><th>Východ</th><th>Západ</th><th>Délka dne</th><th>Max výška</th></tr>
          </thead>
          <tbody>
            {day_length.map(d => (
              <tr key={d.month}>
                <td className="td-name">{d.name}</td>
                <td>{d.sunrise}</td>
                <td>{d.sunset}</td>
                <td className="td-hl">{d.day_length_h.toFixed(1)} h</td>
                <td>{d.noon_altitude.toFixed(1)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DÉLKA DNE – bars */}
      <h3 className="tv-title"><FaSun /> Délka 21. dne v průběhu roku</h3>
      <div className="tv-bars">
        {day_length.map(d => (
          <div className="tv-bar-row" key={d.month}>
            <span className="tv-bar-lbl">{d.name.slice(0, 3)}</span>
            <div className="tv-bar-track">
              <div className="tv-bar sun" style={{ width: `${(d.day_length_h / maxLen) * 100}%` }}>
                {d.day_length_h > maxLen * 0.2 ? `${d.day_length_h.toFixed(1)} h` : ''}
              </div>
            </div>
            <span className="tv-bar-val">{d.sunrise}–{d.sunset}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SunpathView;