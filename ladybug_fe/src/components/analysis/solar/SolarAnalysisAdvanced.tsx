import React, { useState } from 'react';
import {
  FaSun,
  FaSpinner,
  FaArrowLeft,
  FaLeaf,
  FaBolt,
  FaChartLine,
  FaBuilding,
  FaMapMarkerAlt,
  FaCog,
  FaFile,
  FaCloudUploadAlt,
  FaCheckCircle,
  FaCloudSun,
} from 'react-icons/fa';
import './SolarAnalysisAdvanced.css';

interface RoofSurface {
  identifier: string;
  area_m2: number;
  tilt_degrees: number;
  azimuth_degrees: number;
  orientation: string;
  center: number[];
  annual_radiation_kwh: number;
  annual_radiation_kwh_m2: number;
  pv_production: {
    annual_production_kwh: number;
    monthly_avg_kwh: number;
    daily_avg_kwh: number;
    installed_capacity_kwp: number;
  };
}

interface SolarAnalysisResult {
  model_info: {
    model_name: string;
    total_roof_area_m2: number;
    roof_count: number;
  };
  location: {
    city: string;
    latitude: number;
    longitude: number;
    elevation: number;
  };
  roof_analysis: {
    total_roof_area_m2: number;
    total_annual_radiation_kwh: number;
    average_radiation_kwh_m2: number;
    roof_surfaces: RoofSurface[];
  };
  energy_production: {
    annual_production_kwh: number;
    monthly_avg_kwh: number;
    daily_avg_kwh: number;
    installed_capacity_kwp: number;
    specific_yield_kwh_per_kwp: number;
    performance_ratio: number;
  };
  environmental_impact: {
    co2_savings_kg_per_year: number;
    co2_savings_tons_per_year: number;
    coal_savings_kg_per_year: number;
    trees_equivalent: number;
  };
  parameters: {
    pv_efficiency: number;
    system_losses: number;
    performance_ratio: number;
  };
}

interface SolarAnalysisAdvancedProps {
  onBack: () => void;
}

const SolarAnalysisAdvanced: React.FC<SolarAnalysisAdvancedProps> = ({ onBack }) => {
  const [hbjsonFile, setHbjsonFile] = useState<File | null>(null);
  const [epwFile, setEpwFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolarAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pvEfficiency, setPvEfficiency] = useState(18);
  const [systemLosses, setSystemLosses] = useState(14);
  const [maxTilt, setMaxTilt] = useState(60);

  const handleHbjsonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setHbjsonFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleEpwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEpwFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!hbjsonFile || !epwFile) {
      setError('Prosím vyberte oba soubory (HBJSON a EPW)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('hbjson_file', hbjsonFile);
    formData.append('epw_file', epwFile);
    formData.append('pv_efficiency', (pvEfficiency / 100).toString());
    formData.append('system_losses', (systemLosses / 100).toString());
    formData.append('max_tilt', maxTilt.toString());

    try {
      const response = await fetch('http://127.0.0.1:8000/api/solar/analyze-roof-potential', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Chyba při analýze');
      }

      const data: SolarAnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="solar-advanced-container">

      {/* Hero banner – modrý gradient pozadí */}
      <div className="page-hero">
        <button onClick={onBack} className="back-button">
          <FaArrowLeft /> Zpět na přehled
        </button>
        <div className="page-hero-content">
          <div className="page-hero-icon-wrap">
            <FaSun className="page-hero-icon" />
          </div>
          <h1>Pokročilá solární analýza</h1>
          <p>Analyzujte solární potenciál streech z HBJSON modelu</p>
        </div>
      </div>

      {/* Upload sekce */}
      <div className="upload-section">
        <div className="upload-grid">
          <div className="file-upload-box">
            <label htmlFor="hbjson-upload">
              <div className="upload-box-inner">
                <div className="upload-icon-wrap">
                  <FaFile className="upload-icon" />
                </div>
                <div className="upload-box-text">
                  <h3>HBJSON model</h3>
                  <p>Geometrie budovy</p>
                </div>
              </div>
              <input
                id="hbjson-upload"
                type="file"
                accept=".hbjson,.json"
                onChange={handleHbjsonChange}
                style={{ display: 'none' }}
              />
              {hbjsonFile && (
                <div className="file-selected">
                  <FaCheckCircle className="file-selected-icon" />
                  <span>{hbjsonFile.name}</span>
                </div>
              )}
            </label>
          </div>

          <div className="file-upload-box">
            <label htmlFor="epw-upload">
              <div className="upload-box-inner">
                <div className="upload-icon-wrap">
                  <FaCloudUploadAlt className="upload-icon" />
                </div>
                <div className="upload-box-text">
                  <h3>EPW soubor</h3>
                  <p>Klimatická data</p>
                </div>
              </div>
              <input
                id="epw-upload"
                type="file"
                accept=".epw"
                onChange={handleEpwChange}
                style={{ display: 'none' }}
              />
              {epwFile && (
                <div className="file-selected">
                  <FaCheckCircle className="file-selected-icon" />
                  <span>{epwFile.name}</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Parametry */}
        <div className="parameters-section">
          <h3>
            <FaCog className="section-icon" />
            Parametry simulace
          </h3>

          <div className="param-group">
            <label>
              <span>Účinnost PV panelů</span>
              <span className="param-value">{pvEfficiency} %</span>
            </label>
            <input
              type="range"
              min="10"
              max="25"
              step="1"
              value={pvEfficiency}
              onChange={(e) => setPvEfficiency(Number(e.target.value))}
            />
            <div className="param-hint">Standardní křemíkové panely: 15–20 %</div>
          </div>

          <div className="param-group">
            <label>
              <span>Systémové ztráty</span>
              <span className="param-value">{systemLosses} %</span>
            </label>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={systemLosses}
              onChange={(e) => setSystemLosses(Number(e.target.value))}
            />
            <div className="param-hint">Zahrnuje invertor, kabely, teplotu</div>
          </div>

          <div className="param-group">
            <label>
              <span>Max. sklon strechy</span>
              <span className="param-value">{maxTilt}°</span>
            </label>
            <input
              type="range"
              min="30"
              max="90"
              step="5"
              value={maxTilt}
              onChange={(e) => setMaxTilt(Number(e.target.value))}
            />
            <div className="param-hint">Plochy s větším sklonem nebudou analyzovány</div>
          </div>
        </div>

        <button
          onClick={handleUpload}
          disabled={loading || !hbjsonFile || !epwFile}
          className="analyze-button"
        >
          {loading ? (
            <>
              <FaSpinner className="spinner" /> Analyzuji model…
            </>
          ) : (
            <>
              <FaSun /> Spustit analýzu
            </>
          )}
        </button>
      </div>

      {/* Chyba */}
      {error && (
        <div className="error-message">
          <strong>Chyba:</strong> {error}
        </div>
      )}

      {/* ====== VÝSLEDKY ====== */}
      {result && (
        <div className="results-container">

          {/* 1. Summary banner — hlavní číslo vlevo, 3 secondary stats vpravo */}
          <div className="summary-banner">
            <div className="summary-main">
              <FaBolt className="summary-main-icon" />
              <div className="summary-main-value">
                {result.energy_production.annual_production_kwh.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}
              </div>
              <div className="summary-main-unit">kWh / rok</div>
              <div className="summary-main-label">Roční výroba energie</div>
            </div>
            <div className="summary-secondary">
              <div className="summary-stat">
                <FaChartLine className="summary-stat-icon" />
                <div className="summary-stat-value">{result.energy_production.installed_capacity_kwp.toFixed(2)}</div>
                <div className="summary-stat-label">kWp · Instalovaný výkon</div>
              </div>
              <div className="summary-stat">
                <FaCloudSun className="summary-stat-icon" />
                <div className="summary-stat-value">{result.roof_analysis.average_radiation_kwh_m2.toFixed(0)}</div>
                <div className="summary-stat-label">kWh/m² · Průměrná radiace</div>
              </div>
              <div className="summary-stat">
                <FaLeaf className="summary-stat-icon" />
                <div className="summary-stat-value">−{result.environmental_impact.co2_savings_tons_per_year.toFixed(2)}</div>
                <div className="summary-stat-label">t CO₂/rok · Úspora emisí</div>
              </div>
            </div>
          </div>

          {/* 2. Dva panely: Vstupní data | Energetická analýza */}
          <div className="detail-panels">
            <div className="detail-panel">
              <div className="panel-header">
                <FaBuilding className="panel-header-icon" />
                <h3>Vstupní data</h3>
              </div>

              <div className="panel-subsection">
                <div className="panel-subsection-title">
                  <FaMapMarkerAlt /> Lokace
                </div>
                <div className="panel-row">
                  <span>Město</span>
                  <strong>{result.location.city}</strong>
                </div>
                <div className="panel-row">
                  <span>Souřadnice</span>
                  <strong>{result.location.latitude.toFixed(2)}° N, {result.location.longitude.toFixed(2)}° E</strong>
                </div>
                <div className="panel-row">
                  <span>Nadmorská výška</span>
                  <strong>{result.location.elevation.toFixed(0)} m</strong>
                </div>
              </div>

              <div className="panel-subsection">
                <div className="panel-subsection-title">
                  <FaBuilding /> Model budovy
                </div>
                <div className="panel-row">
                  <span>Název</span>
                  <strong>{result.model_info.model_name}</strong>
                </div>
                <div className="panel-row">
                  <span>Počet streech</span>
                  <strong>{result.model_info.roof_count}</strong>
                </div>
                <div className="panel-row">
                  <span>Celková plocha streech</span>
                  <strong>{result.model_info.total_roof_area_m2.toFixed(1)} m²</strong>
                </div>
              </div>
            </div>

            <div className="detail-panel">
              <div className="panel-header">
                <FaBolt className="panel-header-icon" />
                <h3>Energetická analýza</h3>
              </div>

              <div className="panel-row">
                <span>Roční výroba</span>
                <strong className="value-highlight">{result.energy_production.annual_production_kwh.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} kWh</strong>
              </div>
              <div className="panel-row">
                <span>Měsíční průměr</span>
                <strong>{result.energy_production.monthly_avg_kwh.toFixed(0)} kWh</strong>
              </div>
              <div className="panel-row">
                <span>Denní průměr</span>
                <strong>{result.energy_production.daily_avg_kwh.toFixed(1)} kWh</strong>
              </div>
              <div className="panel-row">
                <span>Instalovaný výkon</span>
                <strong>{result.energy_production.installed_capacity_kwp.toFixed(2)} kWp</strong>
              </div>
              <div className="panel-row">
                <span>Specifický výnos</span>
                <strong>{result.energy_production.specific_yield_kwh_per_kwp.toFixed(0)} kWh / kWp</strong>
              </div>
              <div className="panel-row">
                <span>Účinnost systému</span>
                <strong>{(result.energy_production.performance_ratio * 100).toFixed(0)} %</strong>
              </div>
              <div className="panel-row">
                <span>Celková radiace</span>
                <strong>{result.roof_analysis.total_annual_radiation_kwh.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} kWh</strong>
              </div>
            </div>
          </div>

          {/* 3. Roof detail jako tabulka */}
          <div className="roofs-table-section">
            <div className="roofs-table-header">
              <FaSun className="roofs-table-header-icon" />
              <h3>Detail jednotlivých streech</h3>
            </div>
            <div className="roofs-table-wrap">
              <table className="roofs-table">
                <thead>
                  <tr>
                    <th className="col-name">Streecha</th>
                    <th>Orientace</th>
                    <th>Plocha</th>
                    <th>Sklon</th>
                    <th>Azimut</th>
                    <th>Radiace</th>
                    <th>Výroba</th>
                    <th>Kapacita</th>
                  </tr>
                </thead>
                <tbody>
                  {result.roof_analysis.roof_surfaces.map((roof, idx) => (
                    <tr key={idx}>
                      <td className="col-name">{roof.identifier}</td>
                      <td><span className="orientation-badge">{roof.orientation}</span></td>
                      <td>{roof.area_m2.toFixed(1)} m²</td>
                      <td>{roof.tilt_degrees.toFixed(1)}°</td>
                      <td>{roof.azimuth_degrees.toFixed(1)}°</td>
                      <td className="val-highlight">{roof.annual_radiation_kwh_m2.toFixed(0)} kWh/m²</td>
                      <td className="val-highlight">{roof.pv_production.annual_production_kwh.toFixed(0)} kWh</td>
                      <td>{roof.pv_production.installed_capacity_kwp.toFixed(2)} kWp</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default SolarAnalysisAdvanced;