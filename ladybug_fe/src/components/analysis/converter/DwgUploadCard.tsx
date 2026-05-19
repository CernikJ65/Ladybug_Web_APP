/**
 * Upload karta pro DWG/DXF konvertor.
 *
 * Drag & drop + file picker. Terén je do modelu zahrnut vždy
 * automaticky — žádný uživatelský přepínač. Velikost souboru
 * v tabulkových mono číslicích vedle názvu.
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgUploadCard.tsx
 */
import React from 'react';
import {
  FaCloudUploadAlt, FaFileAlt, FaTimesCircle, FaPlay,
} from 'react-icons/fa';
import { useT } from '../../../i18n/useT';

interface Props {
  file: File | null;
  dragging: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onConvert: () => void;
}

const DwgUploadCard: React.FC<Props> = (p) => {
  const t = useT();
  return (
    <div className="cvt-card">
      <div className="cvt-card-head">
        <FaCloudUploadAlt className="cvt-card-icon" />
        <div>
          <h2>{t('Nahrát CAD soubor')}</h2>
          <p className="cvt-card-sub">
            {t('Vlože soubor fomátu DWG')}
          </p>
        </div>
      </div>
      <div
        className={
          'cvt-upload-zone'
          + (p.dragging ? ' dragging' : '')
          + (p.file ? ' has-file' : '')
        }
        onClick={() => p.inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); p.onDragging(true); }}
        onDragLeave={() => p.onDragging(false)}
        onDrop={p.onDrop}
      >
        <div className="cvt-upload-icon">
          {p.file ? <FaFileAlt /> : <FaCloudUploadAlt />}
        </div>
        <div className="cvt-upload-title">
          {p.file ? t('Soubor vybrán') : t('Přetáhněte soubor sem')}
        </div>
        <div className="cvt-upload-hint">
          {p.file ? '' : t('nebo klikněte pro výběr · .dwg')}
        </div>
        {p.file && (
          <div className="cvt-upload-filename">
            <FaFileAlt /> {p.file.name}
            <span className="cvt-upload-filename-meta">
              {(p.file.size / 1024).toFixed(0)} KB
            </span>
          </div>
        )}
        <input
          ref={p.inputRef}
          type="file"
          accept=".dwg,.dxf"
          className="cvt-upload-input"
          onChange={e =>
            e.target.files?.[0] && p.onFile(e.target.files[0])
          }
        />
      </div>
      {p.error && (
        <div className="cvt-error">
          <FaTimesCircle /> {p.error}
        </div>
      )}
      <button
        className="cvt-submit"
        disabled={!p.file}
        onClick={p.onConvert}
      >
        <FaPlay /> {t('Konvertovat na HBJSON')}
      </button>
    </div>
  );
};

export default DwgUploadCard;