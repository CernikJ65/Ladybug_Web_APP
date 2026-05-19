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
import { useT } from '../../../i18n/useT';

interface Props {
  data: HPTypeResult;
  color: 'ashp' | 'gshp';
  totalHeating: number;
  roomCount: number;
}

const HPSection: React.FC<Props> = ({
  data, color, totalHeating, roomCount,
}) => {
  const t = useT();
  const MO = [
    t('Led'), t('Úno'), t('Bře'), t('Dub'), t('Kvě'), t('Čvn'),
    t('Čvc'), t('Srp'), t('Zář'), t('Říj'), t('Lis'), t('Pro'),
  ];
  const [showRooms, setShowRooms] = useState(false);
  const m = data.energy_metrics;
  const maxM = Math.max(...data.monthly_renewable_kwh, 1);
  const isAir = color === 'ashp';
  const source = isAir ? t('venkovního vzduchu') : t('zemního tepla');

  return (
    <section className="hp-card">
      <div className="hp-card-head">
        {isAir
          ? <FaWind className="hp-card-icon" />
          : <FaMountain className="hp-card-icon" />
        }
        <div>
          <h2>{t(data.label)}</h2>
          <p className="hp-card-sub">
            {t('{{n}} jedn. · {{kwh}} kWh celkové potřeby', { n: roomCount, kwh: fmt(totalHeating) })}
          </p>
        </div>
      </div>

      {/* ── Duo karty ── */}
      <div className="hp-duo">
        <div className={`hp-duo-card duo-produced ${color}`}>
          <div className="hp-duo-head">
            <span className="hp-duo-pill"><FaLeaf /> {t('Vyrobeno')}</span>
            <span className="hp-duo-from">{t('z {{src}}', { src: source })}</span>
          </div>
          <div className="hp-duo-big">
            {fmt(data.annual_renewable_kwh)}
          </div>
          <span className="hp-duo-unit">{t('kWh / rok')}</span>
          <p className="hp-duo-note">
            {t('Obnovitelná energie získaná zdarma a dodaná do budovy jako teplo')}
          </p>
        </div>
        <div className={`hp-duo-card duo-consumed ${color}`}>
          <div className="hp-duo-head">
            <span className="hp-duo-pill consumed">
              <FaBolt /> {t('Spotřeba')}
            </span>
            <span className="hp-duo-from">{t('elektřiny')}</span>
          </div>
          <div className="hp-duo-big">
            {fmt(m.electricity_kwh)}
          </div>
          <span className="hp-duo-unit">{t('kWh / rok')}</span>
          <p className="hp-duo-note">
            {t('Pohon kompresoru · {{cost}} CZK/rok', { cost: fmt(m.annual_cost_hp_czk) })}
          </p>
        </div>
      </div>

      {/* ── Klíčové parametry ── */}
      <div className="hp-kpi-row">
        <div className="hp-kpi">
          <span className="hp-kpi-val">{data.annual_avg_cop}</span>
          <span className="hp-kpi-lbl">{t('Roční COP')}</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">{m.peak_heating_kw} kW</span>
          <span className="hp-kpi-lbl">{t('Špičkový výkon')}</span>
        </div>
        <div className="hp-kpi">
          <span className="hp-kpi-val">
            {fmt(m.co2_savings_kg)} kg
          </span>
          <span className="hp-kpi-lbl">{t('Úspora CO₂')}</span>
        </div>
      </div>

      <div className="hp-context">
        {t('Z 1 kWh elektřiny TČ vyrobí {{cop}} kWh tepla — {{total}} kWh celkové potřeby pokryje s pouhými {{elec}} kWh elektřiny.', { cop: data.annual_avg_cop, total: fmt(totalHeating), elec: fmt(m.electricity_kwh) })}
      </div>

      {/* ── Měsíční výroba ── */}
      <h3 className="hp-sub-title">{t('Měsíční obnovitelná výroba')}</h3>
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
      <h3 className="hp-sub-title">{t('Měsíční COP')}</h3>
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
        {showRooms ? t('Skrýt') : t('Zobrazit')} {t('výrobu per místnost')}
        ({data.rooms.length})
      </button>

      {showRooms && (
        <table className="hp-rooms-tbl">
          <thead>
            <tr>
              <th>{t('Místnost')}</th>
              <th>m²</th>
              <th>{t('OZE (kWh/rok)')}</th>
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