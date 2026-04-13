/**
 * DWG/DXF → HBJSON Konvertor — hlavní komponenta.
 *
 * Orchestruje stav a API volání, renderování deleguje
 * na DwgUploadCard a DwgResultCards.
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgConverter.tsx
 */
import React, { useState, useRef, useCallback } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import type { ConvertResult } from './DwgTypes';
import DwgUploadCard from './DwgUploadCard';
import DwgResultCards from './DwgResultCards';
import './DwgConverter.css';

const API = 'http://127.0.0.1:8000/api/converter';

interface Props { onBack: () => void; }

const DwgConverter: React.FC<Props> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [terrain, setTerrain] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fmt = (n: number) =>
    n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 });

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.dwg') && !name.endsWith('.dxf')) {
      setError('Podporované formáty: .dwg, .dxf');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleConvert = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('include_terrain', String(terrain));

    try {
      const res = await fetch(`${API}/convert`, {
        method: 'POST', body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neznámá chyba');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob(
      [JSON.stringify(result.hbjson, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      (file?.name.replace(/\.[^.]+$/, '') || 'model') + '.hbjson';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="cvt-page">
      <div className="cvt-hero">
        <button className="cvt-back" onClick={onBack}>
          <FaArrowLeft /> Zpět
        </button>
        <span className="cvt-hero-badge">DWG / DXF → HBJSON</span>
        <h1>CAD Konvertor</h1>
        <p>
          Převeďte DWG nebo DXF soubor na Honeybee model
          pro energetické simulace
        </p>
      </div>

      <div className="cvt-content">
        {!result && !loading && (
          <DwgUploadCard
            file={file}
            terrain={terrain}
            dragging={dragging}
            error={error}
            inputRef={inputRef}
            onFile={handleFile}
            onTerrain={setTerrain}
            onDragging={setDragging}
            onDrop={handleDrop}
            onConvert={handleConvert}
          />
        )}

        {loading && (
          <div className="cvt-card">
            <div className="cvt-loading">
              <div className="cvt-spinner" />
              <div className="cvt-loading-text">Konverze probíhá…</div>
              <div className="cvt-loading-sub">
                DWG → DXF → ladybug_geometry → Honeybee HBJSON
              </div>
            </div>
          </div>
        )}

        {result && (
          <DwgResultCards
            result={result}
            fmt={fmt}
            onDownload={handleDownload}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
};

export default DwgConverter;