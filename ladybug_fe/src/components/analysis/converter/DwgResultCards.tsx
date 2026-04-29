/**
 * Výsledková karta DWG/DXF konverze.
 *
 * Centrovaný success layout: emerald circular badge → titulek →
 * popisek → dvě akce (primární download gradient, sekundární reset outline).
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgResultCards.tsx
 */
import React from 'react';
import { FaCheck, FaDownload, FaRedo } from 'react-icons/fa';

interface Props {
  onDownload: () => void;
  onReset: () => void;
}

const DwgResultCards: React.FC<Props> = ({ onDownload, onReset }) => (
  <div className="cvt-card" style={{ animationDelay: '.05s' }}>
    <div className="cvt-success">
      <div className="cvt-success-icon-wrap">
        <FaCheck />
      </div>
      <div className="cvt-success-title">Převod proběhl úspěšně</div>
      <div className="cvt-success-sub">
        Honeybee model je připraven ke stažení a lze jej použít
        v dalších energetických analýzách.
      </div>
      <div className="cvt-success-actions">
        <button className="cvt-download" onClick={onDownload}>
          <FaDownload /> Stáhnout HBJSON
        </button>
        <button className="cvt-reset" onClick={onReset}>
          <FaRedo /> Nová konverze
        </button>
      </div>
    </div>
  </div>
);

export default DwgResultCards;