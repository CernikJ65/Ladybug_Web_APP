import React from 'react';
import { FaCloudUploadAlt, FaFile } from 'react-icons/fa';
import type { TFn } from '../../../i18n/useT';
import SolarFileBox from './SolarFileBox';

interface Props {
  hbjsonFile: File | null;
  epwFile: File | null;
  onHbjsonChange: (f: File | null) => void;
  onEpwChange: (f: File | null) => void;
  t: TFn;
}

const SolarUploadCard: React.FC<Props> = ({
  hbjsonFile, epwFile, onHbjsonChange, onEpwChange, t,
}) => (
  <div className="saa-card">
    <div className="saa-card-head">
      <span className="saa-card-icon"><FaCloudUploadAlt /></span>
      <div>
        <h2>{t('Vstupní soubory')}</h2>
        <p className="saa-card-sub">{t('Nahrajte model budovy a klimatická data')}</p>
      </div>
    </div>
    <div className="saa-upload-grid">
      <SolarFileBox
        id="hbjson"
        label={t('HBJSON model')}
        sub={t('Geometrie budovy (.hbjson)')}
        file={hbjsonFile}
        accept=".hbjson,.json"
        onChange={onHbjsonChange}
        icon={<FaFile />}
        t={t}
      />
      <SolarFileBox
        id="epw"
        label={t('EPW soubor')}
        sub={t('Klimatická data (.epw)')}
        file={epwFile}
        accept=".epw"
        onChange={onEpwChange}
        icon={<FaCloudUploadAlt />}
        t={t}
      />
    </div>
  </div>
);

export default SolarUploadCard;
