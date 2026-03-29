import React from 'react';
import { FaThermometerHalf, FaSnowflake, FaFire, FaChartBar, FaClock } from 'react-icons/fa';

/* ---------- exportované typy ---------- */
export interface MonthlyProfile {
  month: number; name: string; avg: number; min_p05: number; max_p95: number;
}
export interface DegreeDayMonth {
  month: number; name: string; hdd: number; cdd: number;
}
export interface DegreeDays {
  hdd_base: number; cdd_base: number;
  annual_hdd: number; annual_cdd: number; months: DegreeDayMonth[];
}
export interface Heatmap {
  matrix: number[][]; months: string[];
  hours: number[]; min_value: number; max_value: number;
}
export interface DiurnalProfile {
  name: string; temperatures: number[];
}
export interface AnnualSummary {
  annual_avg: number; annual_min: number; annual_max: number;
  comfort_hours: number; comfort_pct: number;
  frost_hours: number; hot_hours: number;
}
export interface TemperatureData {
  monthly_profile: MonthlyProfile[];
  degree_days: DegreeDays;
  heatmap: Heatmap;
  diurnal_profiles: { january: DiurnalProfile; july: DiurnalProfile };
  climate_zone: string;
  annual_summary: AnnualSummary;
}

interface Props { data: TemperatureData; }

/* ---------- helpers ---------- */
const tempColor = (t: number, min: number, max: number): string => {
  const r = Math.max(0, Math.min(1, (t - min) / (max - min || 1)));
  if (r < 0.15) return `hsl(220, 65%, ${18 + r * 80}%)`;
  if (r < 0.35) return `hsl(${210 - (r - 0.15) * 300}, 55%, 35%)`;
  if (r < 0.55) return `hsl(${135 - (r - 0.35) * 300}, 55%, 38%)`;
  if (r < 0.75) return `hsl(${50 - (r - 0.55) * 60}, 70%, 42%)`;
  return `hsl(${15 - (r - 0.75) * 40}, 75%, ${45 - (r - 0.75) * 30}%)`;
};
const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

/* ---------- diurnální SVG ---------- */
const DW = 640; const DH = 200;
const DP = { top: 15, right: 20, bottom: 30, left: 40 };
const dCW = DW - DP.left - DP.right;
const dCH = DH - DP.top - DP.bottom;

const diurnalPath = (temps: number[], tMin: number, tMax: number): string =>
  temps.map((t, i) => {
    const x = DP.left + (i / 23) * dCW;
    const y = DP.top + dCH - ((t - tMin) / (tMax - tMin || 1)) * dCH;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

/* ---------- komponenta ---------- */
const TemperatureView: React.FC<Props> = ({ data }) => {
  const { monthly_profile, degree_days: dd, heatmap, diurnal_profiles, climate_zone, annual_summary: s } = data;
  const maxDD = Math.max(...dd.months.map(m => Math.max(m.hdd, m.cdd)), 1);

  const jan = diurnal_profiles?.january;
  const jul = diurnal_profiles?.july;
  const allDiurnal = [...(jan?.temperatures || []), ...(jul?.temperatures || [])];
  const dMin = allDiurnal.length ? Math.floor(Math.min(...allDiurnal)) - 2 : -10;
  const dMax = allDiurnal.length ? Math.ceil(Math.max(...allDiurnal)) + 2 : 30;

  return (
    <div className="tv">
      <div className="tv-stats">
        {[
          { v: `${s.annual_avg}°`, l: 'Průměr roku' },
          { v: `${s.annual_min}°`, l: 'Minimum' },
          { v: `${s.annual_max}°`, l: 'Maximum' },
          { v: `${s.comfort_pct}%`, l: 'Komfort 18–26 °C', sub: `${fmt(s.comfort_hours)} h` },
          { v: `${fmt(s.frost_hours)}`, l: 'Mrazových hodin', sub: '< 0 °C' },
          { v: climate_zone, l: 'ASHRAE zóna' },
        ].map((c, i) => (
          <div className="tv-stat" key={i}>
            <div className="tv-stat-val">{c.v}</div>
            <div className="tv-stat-lbl">{c.l}</div>
            {'sub' in c && c.sub && <div className="tv-stat-sub">{c.sub}</div>}
          </div>
        ))}
      </div>

      <h3 className="tv-title"><FaThermometerHalf /> Měsíční teplotní profil</h3>
      <div className="tv-table-wrap">
        <table className="tv-table">
          <thead><tr><th>Měsíc</th><th>Min (P5)</th><th>Průměr</th><th>Max (P95)</th><th>Rozpětí</th></tr></thead>
          <tbody>
            {monthly_profile.map(m => (
              <tr key={m.month}>
                <td className="td-name">{m.name}</td>
                <td className="td-cool">{m.min_p05}°C</td>
                <td className="td-hl">{m.avg}°C</td>
                <td className="td-warm">{m.max_p95}°C</td>
                <td>{(m.max_p95 - m.min_p05).toFixed(1)}°C</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="tv-title"><FaChartBar /> Topné a chladicí denostupně</h3>
      <div className="tv-dd-summary">
        <div className="tv-stat">
          <div className="tv-stat-val" style={{ color: '#38bdf8' }}>{fmt(dd.annual_hdd)}</div>
          <div className="tv-stat-lbl"><FaSnowflake color="#38bdf8" /> HDD ({dd.hdd_base}°C)</div>
        </div>
        <div className="tv-stat">
          <div className="tv-stat-val" style={{ color: '#f87171' }}>{fmt(dd.annual_cdd)}</div>
          <div className="tv-stat-lbl"><FaFire color="#f87171" /> CDD ({dd.cdd_base}°C)</div>
        </div>
      </div>
      <div className="tv-bars">
        {dd.months.map(m => {
          const short = m.name === 'Červen' ? 'Čvn' : m.name === 'Červenec' ? 'Čvc' : m.name.slice(0, 3);
          return (
            <div className="tv-bar-row" key={m.month}>
              <span className="tv-bar-lbl">{short}</span>
              <div className="tv-bar-track">
                {m.hdd >= 1 && <div className="tv-bar cool" style={{ width: `${Math.max(m.hdd / maxDD * 100, 5)}%` }}>{fmt(m.hdd)}</div>}
              </div>
              <div className="tv-bar-track">
                {m.cdd >= 1 && <div className="tv-bar warm" style={{ width: `${Math.max(m.cdd / maxDD * 100, 5)}%` }}>{fmt(m.cdd)}</div>}
              </div>
            </div>
          );
        })}
        <div className="tv-bar-legend"><span>← HDD (vytápění)</span><span>CDD (chlazení) →</span></div>
      </div>

      {/* DIURNÁLNÍ PROFILY */}
      {jan && jul && (
        <>
          <h3 className="tv-title"><FaClock /> Typický den — leden vs červenec</h3>
          <div className="sv-diagram-wrap">
            <svg viewBox={`0 0 ${DW} ${DH}`} className="sv-svg">
              {/* Grid */}
              {Array.from({ length: 7 }, (_, i) => dMin + i * Math.ceil((dMax - dMin) / 6)).map(t => (
                <g key={t}>
                  <line x1={DP.left} y1={DP.top + dCH - ((t - dMin) / (dMax - dMin)) * dCH}
                    x2={DW - DP.right} y2={DP.top + dCH - ((t - dMin) / (dMax - dMin)) * dCH}
                    stroke="rgba(94,122,148,.1)" strokeWidth={0.5} strokeDasharray="4,4" />
                  <text x={DP.left - 6} y={DP.top + dCH - ((t - dMin) / (dMax - dMin)) * dCH + 4}
                    textAnchor="end" fontSize="8" fill="rgba(94,122,148,.5)"
                    fontFamily="'JetBrains Mono', monospace">{t}°</text>
                </g>
              ))}
              {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                <text key={h} x={DP.left + (h / 23) * dCW} y={DH - DP.bottom + 14}
                  textAnchor="middle" fontSize="8" fill="rgba(94,122,148,.5)"
                  fontFamily="'JetBrains Mono', monospace">{h}:00</text>
              ))}
              {/* Křivky */}
              <path d={diurnalPath(jan.temperatures, dMin, dMax)}
                fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeLinecap="round" />
              <path d={diurnalPath(jul.temperatures, dMin, dMax)}
                fill="none" stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
              {/* Legenda */}
              <rect x={DP.left + 10} y={DP.top + 2} width={10} height={3} rx={1} fill="#38bdf8" />
              <text x={DP.left + 24} y={DP.top + 6} fontSize="8" fill="#38bdf8" fontWeight="600">{jan.name}</text>
              <rect x={DP.left + 70} y={DP.top + 2} width={10} height={3} rx={1} fill="#f97316" />
              <text x={DP.left + 84} y={DP.top + 6} fontSize="8" fill="#f97316" fontWeight="600">{jul.name}</text>
            </svg>
          </div>
        </>
      )}

      <h3 className="tv-title"><FaThermometerHalf /> Teplotní heatmapa</h3>
      <div className="tv-heatmap-wrap">
        <table className="tv-heatmap">
          <thead><tr><th />{heatmap.hours.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {heatmap.matrix.map((row, mi) => (
              <tr key={mi}>
                <td className="tv-hm-lbl">{heatmap.months[mi].slice(0, 3)}</td>
                {row.map((v, hi) => (
                  <td key={hi} style={{
                    background: tempColor(v, heatmap.min_value, heatmap.max_value),
                    color: v > (heatmap.max_value + heatmap.min_value) * 0.45 ? 'rgba(255,255,255,.9)' : 'rgba(200,220,240,.6)',
                  }} title={`${heatmap.months[mi]} ${hi}:00 — ${v}°C`}>{Math.round(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TemperatureView;