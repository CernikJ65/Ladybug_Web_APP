/**
 * Detailní výsledky jednoho typu TČ (ASHP nebo GSHP).
 *
 * Duo karty (vyrobeno / spotřebováno), měsíční grafy,
 * COP řada a tabulka výroby per místnost.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump/HPSection.tsx
 */
import React, { useState } from 'react';
import {
  FaLeaf, FaBolt, FaChevronDown, FaChevronUp,
  FaWind, FaMountain,
} from 'react-icons/fa';
import type { HPTypeResult } from './hpUtils';
import { fmt } from './hpUtils';

interface Props {
  data: HPTypeResult;
  color: 'ashp' | 'gshp';
  totalHeating: number;
  roomCount: number;
}

const MO = [
  'Led','Úno','Bře','Dub','Kvě','Čvn',
  'Čvc','Srp','Zář','Říj','Lis','Pro',
];

const HPSection: React.FC<Props> = ({
  data, color, totalHeating, roomCount,
}) => {
  const [showRooms, setShowRooms] = useState(false);
  const m = data.energy_metrics;
  const maxM = Math.max(...data.monthly_renewable_kwh, 1);
  const isAir = color === 'ashp';
  const source = isAir ? 'venkovního vzduchu' : 'zemního tepla';

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        {isAir
          ? <FaWind className="hp-card-icon" />
          : <FaMountain className="hp-card-icon" />
        }
        <div>
          <h2>{data.label}</h2>
          <p className="hp-card-sub">
            {roomCount} jedn. · {fmt(totalHeating)} kWh
            celkové potřeby
          </p>
        </div>
      </div>

      {/* ── Duo karty ── */}
      <div className="hp-duo">
        <div className={`hp-duo-card duo-produced ${color}`}>
          <div className="hp-duo-head">
            <span className="hp-duo-pill"><FaLeaf /> Vyrobeno</span>
            <span className="hp-duo-from">z {source}</span>
          </div>
          <div className="hp-duo-big">
            {fmt(data.annual_renewable_kwh)}
          </div>
          <span className="hp-duo-unit">kWh / rok</span>
          <p className="hp-duo-note">
            Obnovitelná energie získaná zdarma a dodaná
            do budovy jako teplo
          </p>
        </div>
        <div className={`hp-duo-card duo-consumed ${color}`}>
          <div className="hp-duo-head">
            <span className="hp-duo-pill consumed">
              <FaBolt /> Spotřeba
            </span>
            <span className="hp-duo-from">elektřiny</span>
          </div>
          <div className="hp-duo-big">
            {fmt(m.electricity_kwh)}
          </div>
          <span className="hp-duo-unit">kWh / rok</span>
          <p className="hp-duo-note">
            Pohon kompresoru · {fmt(m.annual_cost_hp_czk)} CZK/rok
          </p>
        </div>
      </div>

      {/* ── Klíčové parametry ── */}
      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-kpi-val">{data.annual_avg_cop}</span>
          <span className="hp-kpi-lbl">Roční COP</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">{m.peak_heating_kw} kW</span>
          <span className="hp-kpi-lbl">Špičkový výkon</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {fmt(m.co2_savings_kg)} kg
          </span>
          <span className="hp-kpi-lbl">Úspora CO₂</span>
        </div>
      </div>

      <div className="hp-context">
        Z 1 kWh elektřiny TČ vyrobí {data.annual_avg_cop} kWh
        tepla — {fmt(totalHeating)} kWh celkové potřeby pokryje
        s pouhými {fmt(m.electricity_kwh)} kWh elektřiny.
      </div>

      {/* ── Měsíční výroba ── */}
      <h3 className="hp-sub-title">Měsíční obnovitelná výroba</h3>
      <div className="hp-bars">
        {data.monthly_renewable_kwh.map((v, i) => (
          <div key={i} className="hp-bar-col">
            <div className={`hp-bar ${color}`}
              style={{ height: `${(v / maxM) * 100}%` }}
              title={`${MO[i]}: ${fmt(v)} kWh`} />
            <span className="hp-bar-lbl">{MO[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Měsíční COP ── */}
      <h3 className="hp-sub-title">Měsíční COP</h3>
      <div className="hp-cop-strip">
        {data.monthly_avg_cop.map((c, i) => (
          <div key={i} className="hp-cop-chip">
            <span className="hp-cop-v">{c.toFixed(1)}</span>
            <span className="hp-cop-m">{MO[i]}</span>
          </div>
        ))}
      </div>

      {/* ── Per místnost — kolapsovatelné ── */}
      <button className="hp-rooms-toggle"
        onClick={() => setShowRooms(!showRooms)}>
        {showRooms ? <FaChevronUp /> : <FaChevronDown />}
        {showRooms ? 'Skrýt' : 'Zobrazit'} výrobu per místnost
        ({data.rooms.length})
      </button>

      {showRooms && (
        <table className="hp-rooms-tbl">
          <thead>
            <tr>
              <th>Místnost</th>
              <th>m²</th>
              <th>OZE (kWh/rok)</th>
            </tr>
          </thead>
          <tbody>
            {data.rooms.map(rm => (
              <tr key={rm.id}>
                <td>{rm.name}</td>
                <td>{rm.floor_area_m2}</td>
                <td className="hp-tbl-hl">
                  {fmt(rm.annual_renewable_kwh)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default HPSection;