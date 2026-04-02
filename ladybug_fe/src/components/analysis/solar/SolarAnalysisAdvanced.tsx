import React, { useState } from 'react';
import {
  FaSun, FaSpinner, FaArrowLeft, FaBolt,
  FaBuilding, FaMapMarkerAlt, FaCog,
  FaFile, FaCloudUploadAlt, FaCheckCircle, FaSolarPanel,
  FaStar, FaThList, FaRulerCombined, FaChartBar,
} from 'react-icons/fa';
import PanelMapView, { type RoofMeta } from './PanelMapView';
import './SolarAnalysisAdvanced.css';

/* ───── Typy ───── */

interface PanelResult {
  id: number;
  roof_id: string;
  center: number[];
  area_m2: number;
  tilt: number;
  azimuth: number;
  radiation_kwh_m2: number;
  annual_production_kwh: number;
  capacity_kwp: number;
}

interface Variant {
  num_panels: number;
  is_requested: boolean;
  total_production_kwh: number;
  total_capacity_kwp: number;
  total_area_m2: number;
  avg_radiation_kwh_m2: number;
  co2_savings_kg: number;
  co2_savings_tons: number;
  trees_equivalent: number;
  panels: PanelResult[];
}

interface AnalysisResult {
  model_info: {
    model_name: string;
    total_roof_area_m2: number;
    roof_count: number;
  };
  location: {
    city: string;
    latitude: number;
    longitude: number;
  };
  optimal_orientation: {
    tilt_degrees: number;
    azimuth_degrees: number;
  };
  panel_config: {
    pv_efficiency: number;
    module_type: string;
    mounting_type: string;
  };
  simulation_engine: string;
  roofs: RoofMeta[];
  optimization: {
    max_panels_available: number;
    variants: Variant[];
  };
}

interface Props {
  onBack: () => void;
}

/* ───── Presety modulů ───── */

const MODULE_PRESETS: Record<string, { min: number; max: number; default: number; label: string }> = {
  Standard: { min: 14, max: 18, default: 16, label: 'Standardní (poly-Si)' },
  Premium:  { min: 18, max: 23, default: 20, label: 'Prémiový (mono-Si PERC/HJT)' },
  ThinFilm: { min: 8,  max: 13, default: 11, label: 'Tenkovrstvý (CdTe, a-Si)' },
};

/* ───── Komponenta ───── */

const SolarAnalysisAdvanced: React.FC<Props> = ({ onBack }) => {
  const [hbjsonFile, setHbjsonFile] = useState<File | null>(null);
  const [epwFile, setEpwFile]       = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [selIdx, setSelIdx]         = useState<number | null>(null);
  const [numPanels, setNumPanels]   = useState(10);
  const [pvEff, setPvEff]           = useState(MODULE_PRESETS.Standard.default);
  const [maxTilt, setMaxTilt]       = useState(60);
  const [modType, setModType]       = useState('Standard');
  const [mountType, setMountType]   = useState('FixedOpenRack');

  const currentPreset = MODULE_PRESETS[modType] ?? MODULE_PRESETS.Standard;

  const handleModTypeChange = (value: string) => {
    const preset = MODULE_PRESETS[value] ?? MODULE_PRESETS.Standard;
    setModType(value);
    setPvEff(preset.default);
  };

  const run = async () => {
    if (!hbjsonFile || !epwFile) { setError('Vyberte oba soubory'); return; }
    setLoading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append('hbjson_file', hbjsonFile);
    fd.append('epw_file', epwFile);
    fd.append('num_panels', numPanels.toString());
    fd.append('pv_efficiency', (pvEff / 100).toString());
    fd.append('max_tilt', maxTilt.toString());
    fd.append('module_type', modType);
    fd.append('mounting_type', mountType);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/solar/optimize-panels', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Chyba');
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
      setSelIdx(data.optimization.variants.findIndex(v => v.is_requested) ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

  const sel =
    result && selIdx !== null ? result.optimization.variants[selIdx] : null;

  const moduleLabel = (v: string) => {
    return MODULE_PRESETS[v]?.label ?? v;
  };

  const mountLabel = (v: string) => {
    switch (v) {
      case 'FixedOpenRack': return 'Volný stojan';
      case 'FixedRoofMounted': return 'Střešní montáž';
      default: return v;
    }
  };

  return (
    <div className="saa-page">
      {/* Hero */}
      <header className="saa-hero">
        <button className="saa-back" onClick={onBack}>
          <FaArrowLeft /> Zpět na přehled
        </button>
        <span className="saa-hero-badge">EnergyPlus + Ladybug Radiance</span>
        <h1>Optimalizace solárních panelů</h1>
        <p>
          Vypočet potenciálu solární energie pro FVE, roční výroba, orientace, umístění panelů.
        </p>
      </header>

      {/* Formulář */}
      <div className="saa-form-wrap">
        <div className="saa-card">
          <div className="saa-card-head">
            <span className="saa-card-icon"><FaCloudUploadAlt /></span>
            <div>
              <h2>Vstupní soubory</h2>
              <p className="saa-card-sub">Nahrajte model budovy a klimatická data</p>
            </div>
          </div>
          <div className="saa-upload-grid">
            <FileBox
              id="hbjson"
              label="HBJSON model"
              sub="Geometrie budovy (.hbjson)"
              file={hbjsonFile}
              accept=".hbjson,.json"
              onChange={f => { setHbjsonFile(f); setError(null); }}
              icon={<FaFile />}
            />
            <FileBox
              id="epw"
              label="EPW soubor"
              sub="Klimatická data (.epw)"
              file={epwFile}
              accept=".epw"
              onChange={f => { setEpwFile(f); setError(null); }}
              icon={<FaCloudUploadAlt />}
            />
          </div>
        </div>

        <div className="saa-card">
          <div className="saa-card-head">
            <span className="saa-card-icon"><FaSolarPanel /></span>
            <div>
              <h2>Konfigurace panelů</h2>
              <p className="saa-card-sub">Počet panelů a parametry simulace</p>
            </div>
          </div>

          <div className="saa-stepper">
            <span className="saa-stepper-label"><FaSolarPanel /> Počet panelů</span>
            <div className="saa-stepper-control">
              <button
                type="button"
                className="saa-stepper-btn"
                onClick={() => setNumPanels(p => Math.max(1, p - 1))}
              >−</button>
              <input
                type="number"
                className="saa-stepper-val"
                min={1}
                max={500}
                value={numPanels}
                onChange={e => setNumPanels(Math.max(1, +e.target.value))}
              />
              <button
                type="button"
                className="saa-stepper-btn"
                onClick={() => setNumPanels(p => Math.min(500, p + 1))}
              >+</button>
            </div>
          </div>

          <details className="saa-params">
            <summary><FaCog /> Pokročilé parametry</summary>
            <div className="saa-params-body">
              <div className="saa-select-row">
                <label>Typ modulu</label>
                <select value={modType} onChange={e => handleModTypeChange(e.target.value)}>
                  {Object.entries(MODULE_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <Slider
                label="Účinnost FV modulu"
                value={pvEff}
                min={currentPreset.min}
                max={currentPreset.max}
                unit="%"
                hint={`Rozsah pro ${moduleLabel(modType)}: ${currentPreset.min}–${currentPreset.max} %`}
                onChange={setPvEff}
              />
              <Slider
                label="Maximální sklon střechy"
                value={maxTilt}
                min={30}
                max={90}
                unit="°"
                hint="Plochy nad tímto sklonem se přeskočí"
                onChange={setMaxTilt}
              />
              <div className="saa-select-row">
                <label>Typ montáže</label>
                <select value={mountType} onChange={e => setMountType(e.target.value)}>
                  <option value="FixedOpenRack">Volný stojan (cirkulace vzduchu)</option>
                  <option value="FixedRoofMounted">Střešní montáž (flush)</option>
                </select>
              </div>
            </div>
          </details>

          <button
            onClick={run}
            disabled={loading || !hbjsonFile || !epwFile}
            className="saa-run"
          >
            {loading
              ? <><FaSpinner className="saa-spin" /> Analyzuji v EnergyPlus…</>
              : <><FaSun /> Spustit optimalizaci</>
            }
          </button>
        </div>
      </div>

      {/* Chyba */}
      {error && (
        <div className="saa-error">
          <strong>Chyba:</strong> {error}
        </div>
      )}

      {/* Výsledky */}
      {result && sel && (
        <div className="saa-results">

          {/* Info strip */}
          <div className="saa-info-strip">
            <div className="saa-info-chip">
              <FaMapMarkerAlt />
              <span>{result.location.city} ({result.location.latitude.toFixed(1)}° N)</span>
            </div>
            <div className="saa-info-chip">
              <FaBuilding />
              <span>{result.model_info.roof_count} střech · {result.model_info.total_roof_area_m2.toFixed(0)} m²</span>
            </div>
            <div className="saa-info-chip">
              <FaSolarPanel />
              <span>Max {result.optimization.max_panels_available} panelů</span>
            </div>
            <div className="saa-info-chip">
              <FaBolt />
              <span>{result.simulation_engine || 'EnergyPlus PVWatts'}</span>
            </div>
          </div>

          {/* Varianty */}
          <div className="saa-card">
            <div className="saa-card-head">
              <span className="saa-card-icon"><FaChartBar /></span>
              <div>
                <h2>Varianty rozmístění</h2>
                <p className="saa-card-sub">Klikněte na variantu pro zobrazení detailu</p>
              </div>
            </div>
            <div className="saa-variants">
              {result.optimization.variants.map((v, idx) => (
                <button
                  key={v.num_panels}
                  className={`saa-variant ${idx === selIdx ? 'active' : ''} ${v.is_requested ? 'requested' : ''}`}
                  onClick={() => setSelIdx(idx)}
                >
                  {v.is_requested && (
                    <span className="saa-badge"><FaStar /> Váš výběr</span>
                  )}
                  <div className="saa-var-count">{v.num_panels}</div>
                  <div className="saa-var-label">panelů</div>
                  <div className="saa-var-prod">{fmt(v.total_production_kwh)} kWh/rok</div>
                  <div className="saa-var-meta">{v.total_capacity_kwp.toFixed(1)} kWp</div>
                </button>
              ))}
            </div>
          </div>

          {/* KPI metriky */}
          <div className="saa-kpi-row">
            <KPI icon={<FaBolt />} value={`${fmt(sel.total_production_kwh)} kWh`} label="Roční výroba" accent />
            <KPI icon={<FaSolarPanel />} value={`${sel.total_capacity_kwp.toFixed(2)} kWp`} label="Instalovaný výkon" />
            <KPI icon={<FaRulerCombined />} value={`${sel.total_area_m2.toFixed(1)} m²`} label="Plocha panelů" />
            <KPI icon={<FaSun />} value={`${sel.avg_radiation_kwh_m2.toFixed(0)} kWh/m²`} label="Solární potenciál" />
          </div>

          {/* Detail karty + mapa */}
          <div className="saa-detail-grid">
            <div className="saa-card">
              <div className="saa-card-head">
                <span className="saa-card-icon"><FaCog /></span>
                <div>
                  <h2>Parametry systému</h2>
                  <p className="saa-card-sub">Konfigurace FV instalace</p>
                </div>
              </div>
              <div className="saa-detail-rows">
                <DetailRow label="Typ modulu" value={moduleLabel(result.panel_config.module_type)} />
                <DetailRow label="Typ montáže" value={mountLabel(result.panel_config.mounting_type)} />
                <DetailRow label="Účinnost FV" value={`${(result.panel_config.pv_efficiency * 100).toFixed(0)} %`} />
                <DetailRow label="Optimální sklon" value={`${result.optimal_orientation.tilt_degrees.toFixed(1)}°`} />
                <DetailRow label="Optimální azimut" value={`${result.optimal_orientation.azimuth_degrees.toFixed(0)}°`} />
              </div>
            </div>

            <PanelMapView panels={sel.panels} roofs={result.roofs} />
          </div>

          {/* Tabulka panelů */}
          <div className="saa-card">
            <div className="saa-card-head">
              <span className="saa-card-icon"><FaThList /></span>
              <div>
                <h2>Detail panelů ({sel.num_panels} ks)</h2>
                <p className="saa-card-sub">Seřazeno dle roční výroby od nejlepšího</p>
              </div>
            </div>
            <div className="saa-table-wrap">
              <table className="saa-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Střecha</th>
                    <th>Plocha</th>
                    <th>Sklon</th>
                    <th>Azimut</th>
                    <th>Sol. potenciál</th>
                    <th>Výroba</th>
                    <th>Kapacita</th>
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
      )}
    </div>
  );
};

/* ───── Subkomponenty ───── */

function FileBox({
  id, label, sub, file, accept, onChange, icon,
}: {
  id: string;
  label: string;
  sub: string;
  file: File | null;
  accept: string;
  onChange: (f: File) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className={`saa-file-box ${file ? 'has-file' : ''}`}>
      <label htmlFor={`saa-${id}`}>
        <div className="saa-file-inner">
          <div className="saa-file-icon">{icon}</div>
          <div>
            <h4>{label}</h4>
            <p>{sub}</p>
          </div>
        </div>
        <input
          id={`saa-${id}`}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && onChange(e.target.files[0])}
        />
        {file && (
          <div className="saa-file-ok">
            <FaCheckCircle /> {file.name}
          </div>
        )}
      </label>
    </div>
  );
}

function Slider({
  label, value, min, max, unit, hint, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="saa-slider">
      <label>
        <span>{label}</span>
        <span className="saa-slider-val">{value}{unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(+e.target.value)}
      />
      <p className="saa-slider-hint">{hint}</p>
    </div>
  );
}

function KPI({
  icon, value, label, accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={`saa-kpi ${accent ? 'saa-kpi-accent' : ''}`}>
      <span className="saa-kpi-icon">{icon}</span>
      <span className="saa-kpi-val">{value}</span>
      <span className="saa-kpi-lbl">{label}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="saa-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default SolarAnalysisAdvanced;