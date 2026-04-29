/**
 * Výsledková karta DWG/DXF konverze.
 *
 * Záměrně minimalistická — jen potvrzení úspěchu a dvě akce
 * (stažení HBJSON, nová konverze). KPI / validace / statistiky
 * pro tenhle čistě geometrický převod nedávají smysl.
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgResultCards.tsx
 */
import React from 'react';
import {
  FaCheckCircle, FaDownload, FaRedo,
} from 'react-icons/fa';

interface Props {
  onDownload: () => void;
  onReset: () => void;
}

const DwgResultCards: React.FC<Props> = ({ onDownload, onReset }) => (
  <div className="cvt-card" style={{ animationDelay: '.05s' }}>
    <div className="cvt-card-head">
      <FaCheckCircle className="cvt-card-icon cvt-status-ok" />
      <div>
        <h2>Převod proběhl úspěšně</h2>
        <p className="cvt-card-sub">HBJSON model je připraven ke stažení</p>
      </div>
    </div>

    <div className="cvt-actions">
      <button className="cvt-download" onClick={onDownload}>
        <FaDownload /> Stáhnout HBJSON
      </button>
      <button className="cvt-reset" onClick={onReset}>
        <FaRedo /> Nová konverze
      </button>
    </div>
  </div>
);

export default DwgResultCards;
