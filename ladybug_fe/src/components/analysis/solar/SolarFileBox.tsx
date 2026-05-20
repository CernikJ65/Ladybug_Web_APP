import React from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import type { TFn } from '../../../i18n/useT';

interface Props {
  id: string;
  label: string;
  sub: string;
  file: File | null;
  accept: string;
  onChange: (f: File | null) => void;
  icon: React.ReactNode;
  t: TFn;
}

const SolarFileBox: React.FC<Props> = ({ id, label, sub, file, accept, onChange, icon, t }) => {
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
              aria-label={t('Odstranit soubor')}
              title={t('Odstranit soubor')}
            >
              <FaTimes />
            </button>
          </div>
        )}
      </label>
    </div>
  );
};

export default SolarFileBox;
