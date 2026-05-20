import React, { useState } from 'react';
import { FaCog } from 'react-icons/fa';
import type { TFn } from '../../../i18n/useT';
import { DetailRow, SubRow } from './SolarMetrics';
import { mountLabel, cardinalLabel, pct, combinedLossValue } from './solarHelpers';
import { INVERTER_LOSS } from './solarConstants';
import type { AnalysisResult } from './solarTypes';

interface Props {
  result: AnalysisResult;
  t: TFn;
}

const SolarParamsCard: React.FC<Props> = ({ result, t }) => {
  const [lossesOpen, setLossesOpen] = useState(false);

  return (
    <div className="saa-card">
      <div className="saa-card-head">
        <span className="saa-card-icon"><FaCog /></span>
        <div>
          <h2>{t('Parametry panelů')}</h2>
          <p className="saa-card-sub">{t('Konfigurace FV instalace')}</p>
        </div>
      </div>
      <div className="saa-detail-rows">
        {/* Modul a montáž */}
        <DetailRow label={t('Typ montáže')} value={mountLabel(result.panel_config.mounting_type, t)} />
        <DetailRow label={t('Účinnost FV')} value={`${(result.panel_config.pv_efficiency * 100).toFixed(0)} %`} />

        {/* Geometrie */}
        {result.panel_config.panel_width_m !== undefined && result.panel_config.panel_height_m !== undefined && (
          <DetailRow
            label={t('Rozměry panelu')}
            value={`${result.panel_config.panel_width_m} × ${result.panel_config.panel_height_m} m`}
          />
        )}
        {result.panel_config.panel_area_m2 !== undefined && (
          <DetailRow label={t('Plocha panelu')} value={`${result.panel_config.panel_area_m2} m²`} />
        )}
        {result.panel_config.active_area_fraction !== undefined && (
          <DetailRow
            label={t('Aktivní plocha')}
            value={`${(result.panel_config.active_area_fraction * 100).toFixed(0)} %`}
          />
        )}
        {result.panel_config.spacing_m !== undefined && (
          <DetailRow label={t('Mezera mezi panely')} value={`${result.panel_config.spacing_m} m`} />
        )}

        {/* Stáří */}
        {result.panel_config.panel_age_years !== undefined && (
          <DetailRow label={t('Stáří systému')} value={`${result.panel_config.panel_age_years} ${t('let')}`} />
        )}

        {/* Orientace */}
        <DetailRow label={t('Optimální sklon')} value={`${result.optimal_orientation.tilt_degrees.toFixed(1)}°`} />
        <DetailRow
          label={t('Optimální směr natočení')}
          value={
            result.optimal_orientation.cardinal_direction
              ? `${result.optimal_orientation.azimuth_degrees.toFixed(0)}° (${cardinalLabel(result.optimal_orientation.cardinal_direction, t)})`
              : `${result.optimal_orientation.azimuth_degrees.toFixed(0)}°`
          }
        />

        {/* Celkové ztráty — rozbalovací sekce */}
        {result.panel_config.system_losses && (
          <div className={`saa-losses ${lossesOpen ? 'open' : ''}`}>
            <button
              type="button"
              className="saa-losses-header"
              onClick={() => setLossesOpen(o => !o)}
              aria-expanded={lossesOpen}
            >
              <span className="saa-losses-label">{t('Celkové ztráty')}</span>
              <span className="saa-losses-meta">
                <strong>{pct(combinedLossValue(result.panel_config.system_losses.total))}</strong>
                <span className="saa-losses-chev" aria-hidden="true" />
              </span>
            </button>

            <div className="saa-losses-body">
              <div className="saa-losses-section">
                <div className="saa-losses-section-title">{t('Komponenty systému')}</div>
                <SubRow label={t('Degradace stárnutím')} value={pct(result.panel_config.system_losses.age)} />
                <SubRow label={t('Počáteční pokles výkonu (do stabilizace)')} value={pct(result.panel_config.system_losses.light_induced_degradation)} />
                <SubRow label={t('Znečištění panelu')} value={pct(result.panel_config.system_losses.soiling)} />
                <SubRow label={t('Sníh')} value={pct(result.panel_config.system_losses.snow)} />
                <SubRow label={t('Odchylka výrobce')} value={pct(result.panel_config.system_losses.manufacturer_nameplate_tolerance)} />
                <SubRow label={t('Nesoulad mezi moduly')} value={pct(result.panel_config.system_losses.cell_characteristic_mismatch)} />
                <SubRow label={t('Ztráty ve vedení (například kabely)')} value={pct(result.panel_config.system_losses.wiring)} />
                <SubRow label={t('Elektrické konektory (například odpor)')} value={pct(result.panel_config.system_losses.electrical_connection)} />
                <SubRow label={t('Dostupnost sítě (výpadky)')} value={pct(result.panel_config.system_losses.grid_availability)} />
                <SubRow label={t('Systémové ztráty (dílčí součet)')} value={pct(result.panel_config.system_losses.total)} emphasized />
              </div>

              <div className="saa-losses-section">
                <div className="saa-losses-section-title">{t('Panel vyrábí stejnosměrný proud (DC), ale domácnost a síť používají hlavně střídavý proud')}</div>
                <SubRow label={t('Ztráta při převodu DC/AC')} value={pct(INVERTER_LOSS)} emphasized />
              </div>

              <p className="saa-losses-note">
                {t('Celkové ztráty se kombinují multiplikativně, nikoliv prostým součtem.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolarParamsCard;
