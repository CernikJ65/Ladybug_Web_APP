import React, { useState } from 'react';
import {
  FaSun, FaSpinner, FaArrowLeft, FaBolt,
  FaBuilding, FaMapMarkerAlt, FaCog,
  FaFile, FaCloudUploadAlt, FaCheckCircle, FaSolarPanel,
  FaStar, FaThList,
} from 'react-icons/fa';
import PanelMapView, { type RoofMeta } from './PanelMapView';
import './SolarAnalysisAdvanced.css';

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Komponenta
// ---------------------------------------------------------------------------
const SolarAnalysisAdvanced: React.FC<Props> = ({ onBack }) => {
  const [hbjsonFile, setHbjsonFile] = useState<File | null>(null);
  const [epwFile, setEpwFile]       = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [selIdx, setSelIdx]         = useState<number | null>(null);
  const [numPanels, setNumPanels]   = useState(10);
  const [pvEff, setPvEff]           = useState(20);
  const [maxTilt, setMaxTilt]       = useState(60);
  const [modType, setModType]       = useState('Standard');
  const [mountType, setMountType]   = useState('FixedOpenRack');

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

  return (
    <div className="sa-container">
      {/* Hero banner */}
      <div className="sa-hero">
        <button onClick={onBack} className="sa-back">
          <FaArrowLeft /> Zpět
        </button>
        <div className="sa-hero-body">
          <div className="sa-hero-icon"><FaSolarPanel /></div>
          <h1>Optimalizace solárních panelů</h1>
          <p>HBJSON + EPW → algoritmus najde nejlepší rozmístění panelů</p>
        </div>
      </div>

      {/* Upload + parametry */}
      <div className="sa-card">
        <div className="sa-upload-grid">
          <FileBox
            id="hbjson"
            label="HBJSON model"
            sub="Geometrie budovy"
            file={hbjsonFile}
            accept=".hbjson,.json"
            onChange={f => { setHbjsonFile(f); setError(null); }}
            icon={<FaFile />}
          />
          <FileBox
            id="epw"
            label="EPW soubor"
            sub="Klimatická data"
            file={epwFile}
            accept=".epw"
            onChange={f => { setEpwFile(f); setError(null); }}
            icon={<FaCloudUploadAlt />}
          />
        </div>

        <div className="sa-panels-input">
          <label><FaSolarPanel /> Počet panelů</label>
          <input
            type="number"
            min={1}
            max={500}
            value={numPanels}
            onChange={e => setNumPanels(Math.max(1, +e.target.value))}
          />
        </div>

        <details className="sa-params">
          <summary><FaCog /> Parametry simulace</summary>
          <Slider
            label="Účinnost PV"
            value={pvEff}
            min={10}
            max={25}
            unit="%"
            hint="Standard: 18–22 %"
            onChange={setPvEff}
          />
          <Slider
            label="Max. sklon střechy"
            value={maxTilt}
            min={30}
            max={90}
            unit="°"
            hint="Plochy nad tímto sklonem se přeskočí"
            onChange={setMaxTilt}
          />
          <div className="sa-select-row">
            <label>Typ modulu</label>
            <select value={modType} onChange={e => setModType(e.target.value)}>
              <option value="Standard">Standard (14–17 %)</option>
              <option value="Premium">Premium (18–20 %)</option>
              <option value="ThinFilm">Thin Film (&lt;12 %)</option>
            </select>
          </div>
          <div className="sa-select-row">
            <label>Typ montáže</label>
            <select value={mountType} onChange={e => setMountType(e.target.value)}>
              <option value="FixedOpenRack">Open Rack (volný vzduch)</option>
              <option value="FixedRoofMounted">Roof Mounted (flush)</option>
            </select>
          </div>
        </details>

        <button
          onClick={run}
          disabled={loading || !hbjsonFile || !epwFile}
          className="sa-run"
        >
          {loading
            ? <><FaSpinner className="sa-spin" /> Analyzuji…</>
            : <><FaSun /> Spustit optimalizaci</>
          }
        </button>
      </div>

      {/* Chyba */}
      {error && (
        <div className="sa-error">
          <strong>Chyba:</strong> {error}
        </div>
      )}

      {/* Výsledky */}
      {result && sel && (
        <div className="sa-results">

          {/* Informační řádek */}
          <div className="sa-info-row">
            <span>
              <FaMapMarkerAlt /> {result.location.city} ({result.location.latitude.toFixed(1)}° N)
            </span>
            <span>
              <FaBuilding /> {result.model_info.roof_count} střech
              · {result.model_info.total_roof_area_m2.toFixed(0)} m²
            </span>
            <span>
              <FaSolarPanel /> Max {result.optimization.max_panels_available} panelů
            </span>
            <span>
              <FaBolt /> {result.simulation_engine || 'RadiationStudy'}
            </span>
          </div>

          {/* Varianty */}
          <h2 className="sa-section-title">Varianty</h2>
          <div className="sa-variants">
            {result.optimization.variants.map((v, idx) => (
              <button
                key={v.num_panels}
                className={`sa-variant ${idx === selIdx ? 'active' : ''} ${v.is_requested ? 'requested' : ''}`}
                onClick={() => setSelIdx(idx)}
              >
                {v.is_requested && (
                  <span className="sa-badge"><FaStar /> Požadováno</span>
                )}
                <div className="sa-var-count">{v.num_panels}</div>
                <div className="sa-var-label">panelů</div>
                <div className="sa-var-prod">{fmt(v.total_production_kwh)} kWh/rok</div>
                <div className="sa-var-meta">{v.total_capacity_kwp.toFixed(1)} kWp</div>
              </button>
            ))}
          </div>

          {/* Detail + mapa */}
          <div className="sa-detail-grid">
            <div className="sa-detail-card">
              <h3><FaBolt /> Energetika</h3>
              <Row label="Roční výroba"      value={`${fmt(sel.total_production_kwh)} kWh`} highlight />
              <Row label="Instalovaný výkon" value={`${sel.total_capacity_kwp.toFixed(2)} kWp`} />
              <Row label="Plocha panelů"     value={`${sel.total_area_m2.toFixed(1)} m²`} />
              <Row label="Solární potenciál" value={`${sel.avg_radiation_kwh_m2.toFixed(0)} kWh/m²`} />
              <Row label="Typ modulu"        value={result.panel_config.module_type} />
              <Row label="Typ montáže"       value={result.panel_config.mounting_type} />
            </div>

            {/* Vizualizace — předáváme i roofs s world_bounds */}
            <PanelMapView
              panels={sel.panels}
              roofs={result.roofs}
            />
          </div>

          {/* Tabulka panelů */}
          <div className="sa-table-section">
            <h3><FaThList /> Panely ({sel.num_panels} ks)</h3>
            <div className="sa-table-wrap">
              <table className="sa-table">
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
                      <td>{p.roof_id}</td>
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

// ---------------------------------------------------------------------------
// Pomocné subkomponenty
// ---------------------------------------------------------------------------
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
    <div className="sa-file-box">
      <label htmlFor={`sa-${id}`}>
        <div className="sa-file-inner">
          {icon}
          <div>
            <h4>{label}</h4>
            <p>{sub}</p>
          </div>
        </div>
        <input
          id={`sa-${id}`}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && onChange(e.target.files[0])}
        />
        {file && (
          <div className="sa-file-ok">
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
    <div className="sa-slider">
      <label>
        <span>{label}</span>
        <span className="sa-slider-val">{value}{unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(+e.target.value)}
      />
      <p className="sa-slider-hint">{hint}</p>
    </div>
  );
}

function Row({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="sa-row">
      <span>{label}</span>
      <strong className={highlight ? 'hl' : ''}>{value}</strong>
    </div>
  );
}

export default SolarAnalysisAdvanced;