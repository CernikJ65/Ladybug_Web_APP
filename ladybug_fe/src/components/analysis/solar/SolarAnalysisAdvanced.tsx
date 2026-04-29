import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaSun, FaSpinner, FaArrowLeft, FaArrowRight, FaBolt,
  FaBuilding, FaMapMarkerAlt, FaCog,
  FaFile, FaCloudUploadAlt, FaCheckCircle, FaSolarPanel,
  FaThList, FaRulerCombined, FaTimes,
} from 'react-icons/fa';
import PanelMapView, { type RoofMeta } from './PanelMapView';
import SimulationProgressOverlay from '../../common/SimulationProgressOverlay';
import HelpButton from '../../help/HelpButton';
import TourOverlay from '../../help/TourOverlay';
import { getSolarAdvancedSteps } from '../../help/content/solarAdvancedSteps';
import { useSimulationProgress } from '../../../hooks/useSimulationProgress';
import { useViewStateCache } from './../../../hooks/useViewStateCache';
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
  production_ep_kwh?: number;
  production_pvlib_kwh?: number;
  ep_solar_potential_kwh_m2?: number;
}

type PvEngine = 'energyplus' | 'pvlib' | 'both';

interface OptimizationResult {
  num_panels: number;
  total_production_kwh: number;
  total_capacity_kwp: number;
  total_area_m2: number;
  avg_radiation_kwh_m2: number;
  panels: PanelResult[];
}

interface SystemLosses {
  age: number;
  light_induced_degradation: number;
  soiling: number;
  snow: number;
  manufacturer_nameplate_tolerance: number;
  cell_characteristic_mismatch: number;
  wiring: number;
  electrical_connection: number;
  grid_availability: number;
  total: number;
}

interface AnalysisResult {
  model_info: {
    model_name: string;
    total_roof_area_m2: number;
    roof_count: number;
    roof_surface_count?: number;
  };
  location: {
    city: string;
    latitude: number;
    longitude: number;
  };
  optimal_orientation: {
    tilt_degrees: number;
    azimuth_degrees: number;
    cardinal_direction?: string;
  };
  panel_config: {
    pv_efficiency: number;
    module_type: string;
    mounting_type: string;
    panel_width_m?: number;
    panel_height_m?: number;
    panel_area_m2?: number;
    spacing_m?: number;
    active_area_fraction?: number;
    panel_age_years?: number;
    system_losses?: SystemLosses;
  };
  simulation_engine: string;
  pv_engine?: PvEngine;
  engine_totals?: {
    energyplus_kwh?: number;
    pvlib_kwh?: number;
  };
  roofs: RoofMeta[];
  optimization: {
    max_panels_available: number;
    requested_count: number;
    result: OptimizationResult;
  };
}

interface CachedState {
  hbjsonFile: File | null;
  epwFile: File | null;
  result: AnalysisResult | null;
  error: string | null;
  numPanels: number;
  pvEff: number;
  maxTilt: number;
  mountType: string;
  pvEngine: PvEngine;
}

interface Props {
  onBack: () => void;
}

/* ───── Konfigurace účinnosti ───── */

const PV_EFF_MIN = 19;
const PV_EFF_MAX = 24;
const PV_EFF_DEFAULT = 20;

/* Inverter (DC→AC). EnergyPlus aplikuje samostatne mimo system_loss_fraction.
   Defaultni honeybee/PVWatts hodnota = 0.96 → 4 % ztrata. */
const INVERTER_LOSS = 0.04;

/* ───── Options pro AppleSelect ───── */

const PV_ENGINE_OPTIONS = [
  { value: 'energyplus', label: 'EnergyPlus PVWatts (trvá déle' },
  { value: 'pvlib',      label: 'Ladybug Radiance + pvlib (rychlá simulace)' },
  { value: 'both',       label: 'Simulovat oběma způsoby' },
];

const MOUNT_TYPE_OPTIONS = [
  { value: 'FixedOpenRack',    label: 'Otevřená konstrukce' },
  { value: 'FixedRoofMounted', label: 'Střešní montáž' },
];

/* ───── Komponenta ───── */

const SolarAnalysisAdvanced: React.FC<Props> = ({ onBack }) => {
  const [hbjsonFile, setHbjsonFile] = useState<File | null>(null);
  const [epwFile, setEpwFile]       = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [numPanels, setNumPanels]   = useState(8);
  const [pvEff, setPvEff]           = useState(PV_EFF_DEFAULT);
  const [maxTilt, setMaxTilt]       = useState(60);
  const [mountType, setMountType]   = useState('FixedOpenRack');
  const [pvEngine, setPvEngine]     = useState<PvEngine>('energyplus');
  const [jobId, setJobId]           = useState<string | null>(null);
  const [lossesOpen, setLossesOpen] = useState(false);
  const [tourOpen, setTourOpen]     = useState(false);

  const progress = useSimulationProgress(loading ? jobId : null);

  /* Memoizace kroků průvodce — přepočet jen při změně stavu výsledků. */
  const tourSteps = useMemo(
    () => getSolarAdvancedSteps(result !== null),
    [result],
  );

  useViewStateCache<CachedState>(
    'solar-advanced',
    { hbjsonFile, epwFile, result, error, numPanels, pvEff, maxTilt, mountType, pvEngine },
    (c: CachedState) => {
      setHbjsonFile(c.hbjsonFile);
      setEpwFile(c.epwFile);
      setResult(c.result);
      setError(c.error);
      setNumPanels(c.numPanels);
      setPvEff(c.pvEff);
      setMaxTilt(c.maxTilt);
      setMountType(c.mountType);
      if (c.pvEngine) setPvEngine(c.pvEngine);
    }
  );

  const handleFileChange = (
    setter: React.Dispatch<React.SetStateAction<File | null>>
  ) => (f: File | null) => {
    setter(f);
    setError(null);
    setResult(null);
  };

  const run = async () => {
    if (!hbjsonFile || !epwFile) { setError('Vyberte oba soubory'); return; }
    const newJobId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobId(newJobId);
    setLoading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append('hbjson_file', hbjsonFile);
    fd.append('epw_file', epwFile);
    fd.append('num_panels', numPanels.toString());
    fd.append('pv_efficiency', (pvEff / 100).toString());
    fd.append('max_tilt', maxTilt.toString());
    fd.append('mounting_type', mountType);
    fd.append('pv_engine', pvEngine);
    fd.append('job_id', newJobId);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

  const pct = (v: number | undefined) =>
    v === undefined || v === null ? '—' : `${(v * 100).toFixed(1)} %`;

  /* Kombinovana ztrata (system + inverter) — multiplikativne. */
  const combinedLossValue = (systemTotal: number | undefined): number | undefined => {
    if (systemTotal === undefined || systemTotal === null) return undefined;
    return 1 - (1 - systemTotal) * (1 - INVERTER_LOSS);
  };

  const sel = result ? result.optimization.result : null;

  const mountLabel = (v: string) => {
    switch (v) {
      case 'FixedOpenRack': return 'Otevřená konstrukce';
      case 'FixedRoofMounted': return 'Střešní montáž';
      default: return v;
    }
  };

  const cardinalLabel = (v: string | undefined): string => {
    if (!v) return '';
    const map: Record<string, string> = {
      North: 'sever',
      'North-East': 'severovýchod',
      East: 'východ',
      'South-East': 'jihovýchod',
      South: 'jih',
      'South-West': 'jihozápad',
      West: 'západ',
      'North-West': 'severozápad',
      Horizontal: 'vodorovně',
    };
    return map[v] ?? v;
  };

  return (
    <div className="saa-page">
      <HelpButton onClick={() => setTourOpen(true)} />
      <TourOverlay
        isActive={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />

      <SimulationProgressOverlay
        open={loading}
        progress={progress}
        title="Solární analýza"
      />

      {/* Hero */}
      <header className="saa-hero">
        <button className="saa-back" onClick={onBack}>
          <FaArrowLeft /> Zpět na přehled
        </button>
        
        <h1>Solární analýza</h1>
        <p>
          Scénar, který na základě EPW a HBJSON dat simuluje solární potenciál dopadu slunečního zářeni na panely a na základě toto následně similuje kolik je panel schopen produkovat .
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
              onChange={handleFileChange(setHbjsonFile)}
              icon={<FaFile />}
            />
            <FileBox
              id="epw"
              label="EPW soubor"
              sub="Klimatická data (.epw)"
              file={epwFile}
              accept=".epw"
              onChange={handleFileChange(setEpwFile)}
              icon={<FaCloudUploadAlt />}
            />
          </div>
        </div>

        <div className="saa-card saa-config-card">
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
                <label>Zvolte způsob simulace</label>
                <AppleSelect
                  value={pvEngine}
                  options={PV_ENGINE_OPTIONS}
                  onChange={v => setPvEngine(v as PvEngine)}
                  ariaLabel="Výpočetní engine"
                />
              </div>
              <Slider
                label="Účinnost panelu"
                value={pvEff}
                min={PV_EFF_MIN}
                max={PV_EFF_MAX}
                unit="%"
                hint=""
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
                <AppleSelect
                  value={mountType}
                  options={MOUNT_TYPE_OPTIONS}
                  onChange={setMountType}
                  ariaLabel="Typ montáže"
                />
              </div>
            </div>
          </details>

          <button
            onClick={run}
            disabled={loading || !hbjsonFile || !epwFile}
            className="saa-run"
          >
            <span className="saa-run-mark">
              {loading ? <FaSpinner className="saa-spin" /> : <FaSun />}
            </span>
            <span className="saa-run-copy">
              {loading ? engineRunningLabel(pvEngine) : 'Spustit optimalizaci'}
            </span>
            {!loading && <FaArrowRight className="saa-run-arrow" />}
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
              <span>
                {result.model_info.roof_count} {result.model_info.roof_count === 1 ? 'střecha' : 'střech'}
                {result.model_info.roof_surface_count && result.model_info.roof_surface_count !== result.model_info.roof_count
                  ? ` (${result.model_info.roof_surface_count} ploch)`
                  : ''}
                {' · '}{result.model_info.total_roof_area_m2.toFixed(0)} m²
              </span>
            </div>
            <div className="saa-info-chip">
              <FaSolarPanel />
              <span>Max {result.optimization.max_panels_available} panelů</span>
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
                  <h2>Parametry panelů</h2>
                  <p className="saa-card-sub">Konfigurace FV instalace</p>
                </div>
              </div>
              <div className="saa-detail-rows">
                {/* Modul a montáž */}
                <DetailRow label="Typ montáže" value={mountLabel(result.panel_config.mounting_type)} />
                <DetailRow label="Účinnost FV" value={`${(result.panel_config.pv_efficiency * 100).toFixed(0)} %`} />

                {/* Geometrie */}
                {result.panel_config.panel_width_m !== undefined && result.panel_config.panel_height_m !== undefined && (
                  <DetailRow
                    label="Rozměry panelu"
                    value={`${result.panel_config.panel_width_m} × ${result.panel_config.panel_height_m} m`}
                  />
                )}
                {result.panel_config.panel_area_m2 !== undefined && (
                  <DetailRow label="Plocha panelu" value={`${result.panel_config.panel_area_m2} m²`} />
                )}
                {result.panel_config.active_area_fraction !== undefined && (
                  <DetailRow
                    label="Aktivní plocha"
                    value={`${(result.panel_config.active_area_fraction * 100).toFixed(0)} %`}
                  />
                )}
                {result.panel_config.spacing_m !== undefined && (
                  <DetailRow label="Mezera mezi panely" value={`${result.panel_config.spacing_m} m`} />
                )}

                {/* Stáří */}
                {result.panel_config.panel_age_years !== undefined && (
                  <DetailRow label="Stáří systému" value={`${result.panel_config.panel_age_years} let`} />
                )}

                {/* Orientace */}
                <DetailRow label="Optimální sklon" value={`${result.optimal_orientation.tilt_degrees.toFixed(1)}°`} />
                <DetailRow
                  label="Optimální směr natočení"
                  value={
                    result.optimal_orientation.cardinal_direction
                      ? `${result.optimal_orientation.azimuth_degrees.toFixed(0)}° (${cardinalLabel(result.optimal_orientation.cardinal_direction)})`
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
                      <span className="saa-losses-label">Celkové ztráty</span>
                      <span className="saa-losses-meta">
                        <strong>{pct(combinedLossValue(result.panel_config.system_losses.total))}</strong>
                        <span className="saa-losses-chev" aria-hidden="true" />
                      </span>
                    </button>

                    <div className="saa-losses-body">
                      <div className="saa-losses-section">
                        <div className="saa-losses-section-title">Komponenty systému</div>
                        <SubRow label="Degradace stárnutím" value={pct(result.panel_config.system_losses.age)} />
                        <SubRow label="Počáteční pokles výkonu (do stabilizace)" value={pct(result.panel_config.system_losses.light_induced_degradation)} />
                        <SubRow label="Znečištění panelu" value={pct(result.panel_config.system_losses.soiling)} />
                        <SubRow label="Sníh" value={pct(result.panel_config.system_losses.snow)} />
                        <SubRow label="Odchylka výrobce" value={pct(result.panel_config.system_losses.manufacturer_nameplate_tolerance)} />
                        <SubRow label="Nesoulad mezi moduly" value={pct(result.panel_config.system_losses.cell_characteristic_mismatch)} />
                        <SubRow label="Ztráty ve vedení (například kabely)" value={pct(result.panel_config.system_losses.wiring)} />
                        <SubRow label="Elektrické konektory (například odpor)" value={pct(result.panel_config.system_losses.electrical_connection)} />
                        <SubRow label="Dostupnost sítě (výpadky)" value={pct(result.panel_config.system_losses.grid_availability)} />
                        <SubRow label="Systémové ztráty (dílčí součet)" value={pct(result.panel_config.system_losses.total)} emphasized />
                      </div>

                      <div className="saa-losses-section">
                        <div className="saa-losses-section-title">Panel vyrábí stejnosměrný proud (DC), ale domácnost a síť používají hlavně střídavý proud</div>
                        <SubRow label="Ztráta při převodu DC/AC" value={pct(INVERTER_LOSS)} emphasized />
                      </div>

                      <p className="saa-losses-note">
                        Celkové ztráty se kombinují multiplikativně, nikoliv prostým součtem.
                      </p>
                    </div>
                  </div>
                )}
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
                    <th>Směr</th>
                    <th title="Stíněná POA z Radiance (SkyMatrix ray tracing, stínění od budovy)">Sol. pot. (Radiance)</th>
                    {result.pv_engine === 'both' ? (
                      <>
                        <th>Výroba (pvlib)</th>
                        <th title="Stíněná POA z EnergyPlus (polygon clipping, stínění od budovy i sousedních panelů)">Sol. pot. (EP)</th>
                        <th>Výroba (EP)</th>
                      </>
                    ) : (
                      <th>Výroba</th>
                    )}
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
                      {result.pv_engine === 'both' ? (
                        <>
                          <td className="val-hl">
                            {p.production_pvlib_kwh !== undefined && p.production_pvlib_kwh !== null
                              ? `${p.production_pvlib_kwh.toFixed(0)} kWh` : '—'}
                          </td>
                          <td className="val-hl">
                            {p.ep_solar_potential_kwh_m2 !== undefined && p.ep_solar_potential_kwh_m2 !== null
                              ? `${p.ep_solar_potential_kwh_m2.toFixed(0)} kWh/m²`
                              : '—'}
                          </td>
                          <td className="val-hl">
                            {p.production_ep_kwh !== undefined && p.production_ep_kwh !== null
                              ? `${p.production_ep_kwh.toFixed(0)} kWh` : '—'}
                          </td>
                        </>
                      ) : (
                        <td className="val-hl">{p.annual_production_kwh.toFixed(0)} kWh</td>
                      )}
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

/* ───── Pomocné ───── */

function engineRunningLabel(engine: PvEngine): string {
  switch (engine) {
    case 'pvlib': return 'Počítám pvlib + Radiance…';
    case 'both':  return 'Analyzuji EnergyPlus + pvlib…';
    default:      return 'Analyzuji v EnergyPlus…';
  }
}

/* ───── Subkomponenty ───── */

function FileBox({
  id, label, sub, file, accept, onChange, icon,
}: {
  id: string;
  label: string;
  sub: string;
  file: File | null;
  accept: string;
  onChange: (f: File | null) => void;
  icon: React.ReactNode;
}) {
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
    const input = document.getElementById(`saa-${id}`) as HTMLInputElement | null;
    if (input) input.value = '';
  };

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
            <button
              type="button"
              className="saa-file-clear"
              onClick={handleClear}
              aria-label="Odstranit soubor"
              title="Odstranit soubor"
            >
              <FaTimes />
            </button>
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
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="saa-slider">
      <label>
        <span>{label}</span>
        <span className="saa-slider-val">{value}{unit}</span>
      </label>
      <div className="saa-slider-wrap">
        <div className="saa-slider-track">
          <div className="saa-slider-fill" style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(+e.target.value)}
          />
        </div>
      </div>
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

function SubRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={`saa-sub-row ${emphasized ? 'emphasized' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* ───── AppleSelect — custom dropdown (iOS/macOS inspirovaný) ───── */

interface AppleSelectOption {
  value: string;
  label: string;
}

function AppleSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: AppleSelectOption[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const current = options.find(o => o.value === value) ?? options[0];
  const currentIdx = options.findIndex(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(options.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[activeIdx];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, activeIdx, options, onChange]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector<HTMLLIElement>('.saa-asel-opt.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIdx]);

  const toggleOpen = () => {
    if (!open) setActiveIdx(currentIdx >= 0 ? currentIdx : 0);
    setOpen(o => !o);
  };

  return (
    <div ref={wrapRef} className={`saa-asel ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="saa-asel-trigger"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="saa-asel-val">{current.label}</span>
        <span className="saa-asel-chev" aria-hidden="true" />
      </button>

      {open && (
        <ul ref={menuRef} className="saa-asel-menu" role="listbox">
          {options.map((opt, idx) => {
            const isSel = opt.value === value;
            const isActive = idx === activeIdx;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSel}
                className={
                  `saa-asel-opt` +
                  (isSel ? ' sel' : '') +
                  (isActive ? ' active' : '')
                }
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="saa-asel-opt-label">{opt.label}</span>
                {isSel && <span className="saa-asel-check" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default SolarAnalysisAdvanced;