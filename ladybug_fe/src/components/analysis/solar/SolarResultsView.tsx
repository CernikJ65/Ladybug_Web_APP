import React from 'react';
import {
  FaBolt, FaBuilding, FaMapMarkerAlt, FaSolarPanel,
  FaThList, FaRulerCombined, FaSun,
} from 'react-icons/fa';
import type { TFn } from '../../../i18n/useT';
import PanelMapView from './PanelMapView';
import { KPI } from './SolarMetrics';
import SolarParamsCard from './SolarParamsCard';
import { fmt } from './solarHelpers';
import type { AnalysisResult, OptimizationResult } from './solarTypes';

interface Props {
  result: AnalysisResult;
  sel: OptimizationResult;
  t: TFn;
}

const SolarResultsView: React.FC<Props> = ({ result, sel, t }) => (
  <div className="saa-results">

    <div className="saa-info-strip">
      <div className="saa-info-chip">
        <FaMapMarkerAlt />
        <span>{result.location.city} ({result.location.latitude.toFixed(1)}° N)</span>
      </div>
      <div className="saa-info-chip">
        <FaBuilding />
        <span>
          {result.model_info.roof_count} {result.model_info.roof_count === 1 ? t('střecha') : t('střech')}
          {result.model_info.roof_surface_count && result.model_info.roof_surface_count !== result.model_info.roof_count
            ? ` (${result.model_info.roof_surface_count} ${t('ploch')})`
            : ''}
          {' · '}{result.model_info.total_roof_area_m2.toFixed(0)} m²
        </span>
      </div>
      <div className="saa-info-chip">
        <FaSolarPanel />
        <span>{t('Max')} {result.optimization.max_panels_available} {t('panelů')}</span>
      </div>
    </div>

    {/* KPI metriky */}
    <div className="saa-kpi-row">
      <KPI icon={<FaBolt />} value={`${fmt(sel.total_production_kwh)} kWh`} label={t('Roční výroba')} accent />
      <KPI icon={<FaSolarPanel />} value={`${sel.total_capacity_kwp.toFixed(2)} kWp`} label={t('Instalovaný výkon')} />
      <KPI icon={<FaRulerCombined />} value={`${sel.total_area_m2.toFixed(1)} m²`} label={t('Plocha panelů')} />
      <KPI icon={<FaSun />} value={`${sel.avg_radiation_kwh_m2.toFixed(0)} kWh/m²`} label={t('Solární potenciál')} />
    </div>

    {/* Detail karty + mapa */}
    <div className="saa-detail-grid">
      <SolarParamsCard result={result} t={t} />

      <PanelMapView
        panels={sel.panels}
        roofs={result.roofs}
        panelOrder={new Map(sel.panels.map((p, i) => [p.id, i + 1]))}
      />
    </div>

    {/* Tabulka panelů */}
    <div className="saa-card">
      <div className="saa-card-head">
        <span className="saa-card-icon"><FaThList /></span>
        <div>
          <h2>{t('Detail panelů ({{n}} ks)', { n: sel.num_panels })}</h2>
          <p className="saa-card-sub">{t('Seřazeno dle roční výroby od nejlepšího')}</p>
        </div>
      </div>
      <div className="saa-table-wrap">
        <table className="saa-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('Střecha')}</th>
              <th>{t('Plocha')}</th>
              <th>{t('Sklon')}</th>
              <th>{t('Směr')}</th>
              <th title={t('Stíněná POA z Radiance (SkyMatrix ray tracing, stínění od budovy)')}>{t('Sol. pot. (Radiance)')}</th>
              <th>{t('Výroba')}</th>
              <th>{t('Instalovaný výkon')}</th>
            </tr>
          </thead>
          <tbody>
            {sel.panels.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td className="td-left">{p.roof_id}</td>
                <td>{p.area_m2} m²</td>
                <td>{p.tilt.toFixed(1)}°</td>
                <td>{p.azimuth.toFixed(0)}°</td>
                <td className="val-hl">{p.radiation_kwh_m2.toFixed(0)} kWh/m²</td>
                <td className="val-hl">{p.annual_production_kwh.toFixed(0)} kWh</td>
                <td>{p.capacity_kwp.toFixed(3)} kWp</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export default SolarResultsView;
