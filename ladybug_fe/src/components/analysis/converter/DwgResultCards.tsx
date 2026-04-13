/**
 * Výsledkové karty DWG/DXF konverze.
 *
 * Souhrn modelu (KPI), validace DXF, akce (stažení, reset).
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgResultCards.tsx
 */
import React from 'react';
import {
  FaCubes, FaLayerGroup, FaRulerCombined, FaBoxOpen,
  FaMountain, FaFileAlt, FaCheckCircle,
  FaExclamationTriangle, FaDownload, FaRedo,
} from 'react-icons/fa';
import type { ConvertResult } from './DwgTypes';

interface Props {
  result: ConvertResult;
  fmt: (n: number) => string;
  onDownload: () => void;
  onReset: () => void;
}

const DwgResultCards: React.FC<Props> = ({
  result, fmt, onDownload, onReset,
}) => {
  const { summary: s, validation: v, buildings: b } = result;
  const hasIssues = v.issues.length > 0;

  return (
    <>
      {/* Souhrn modelu */}
      <div className="cvt-card" style={{ animationDelay: '.05s' }}>
        <div className="cvt-card-head">
          <FaCubes className="cvt-card-icon" />
          <div>
            <h2>
              Model hotov{' '}
              <span className={`cvt-status ${
                hasIssues ? 'cvt-status-warn' : 'cvt-status-ok'
              }`}>
                {hasIssues
                  ? <><FaExclamationTriangle /> Varování</>
                  : <><FaCheckCircle /> OK</>}
              </span>
            </h2>
            <p className="cvt-card-sub">Honeybee HBJSON — souhrn</p>
          </div>
        </div>

        <div className="cvt-kpi-row">
          <KPI icon={<FaCubes />} val={String(s.rooms)} lbl="Místnosti" accent />
          <KPI icon={<FaLayerGroup />} val={String(s.faces)} lbl="Plochy" />
          <KPI icon={<FaRulerCombined />} val={`${fmt(s.floor_area_m2)} m²`} lbl="Podl. plocha" accent />
          <KPI icon={<FaBoxOpen />} val={`${fmt(s.volume_m3)} m³`} lbl="Objem" />
          <KPI icon={<FaMountain />} val={String(s.shades)} lbl="Stínící pl." />
          <KPI icon={<FaFileAlt />} val={`${fmt(s.file_size_kb)} KB`} lbl="Velikost" />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Row label="Detailní solid" value={b.solid} />
          <Row label="Z polygonu střechy" value={b.polygon} />
          <Row label="Obalový kvádr" value={b.bbox} />
          <Row label="Jen obrys (bez výšky)" value={b.outline_skip} />
          <Row label="Přeskočeno" value={b.error} />
        </div>
      </div>

      {/* Validace DXF */}
      <div className="cvt-card" style={{ animationDelay: '.1s' }}>
        <div className="cvt-card-head">
          <FaCheckCircle className="cvt-card-icon" />
          <div>
            <h2>Validace DXF</h2>
            <p className="cvt-card-sub">
              Verze {v.dxf_version} ·{' '}
              {(v.file_size_bytes / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>

        <Row label="Bloky celkem" value={v.blocks.total} />
        <Row label="Bloky s obsahem" value={v.blocks.with_content} />
        <Row label="Prázdné bloky" value={v.blocks.empty} />
        <Row label="Polyface mesh" value={v.geometry_3d.polyface_mesh} />
        <Row label="3D plochy" value={v.geometry_3d['3dface']} />

        {hasIssues && (
          <div className="cvt-error" style={{ marginTop: '.8rem' }}>
            <FaExclamationTriangle /> {v.issues.join(' · ')}
          </div>
        )}
      </div>

      {/* Akce */}
      <div className="cvt-card" style={{ animationDelay: '.15s' }}>
        <div className="cvt-actions">
          <button className="cvt-download" onClick={onDownload}>
            <FaDownload /> Stáhnout HBJSON
          </button>
          <button className="cvt-reset" onClick={onReset}>
            <FaRedo /> Nová konverze
          </button>
        </div>
      </div>
    </>
  );
};

export default DwgResultCards;

/* ── Pomocné podkomponenty ── */

function KPI(p: {
  icon: React.ReactNode;
  val: string;
  lbl: string;
  accent?: boolean;
}) {
  return (
    <div className={`cvt-kpi${p.accent ? ' cvt-kpi-accent' : ''}`}>
      <span className="cvt-kpi-icon">{p.icon}</span>
      <span className="cvt-kpi-val">{p.val}</span>
      <span className="cvt-kpi-lbl">{p.lbl}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="cvt-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}