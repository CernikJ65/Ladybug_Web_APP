import React from 'react';
import {
  FaArrowLeft, FaDownload, FaFile, FaCloudUploadAlt,
} from 'react-icons/fa';
import { useT } from '../../i18n/useT';
import { SAMPLES, type SampleFile } from './samplesData';
import './SampleData.css';

interface Props { onBack: () => void; }

const SampleData: React.FC<Props> = ({ onBack }) => {
  const t = useT();
  const hbjsons = SAMPLES.filter((s) => s.category === 'hbjson');
  const epws = SAMPLES.filter((s) => s.category === 'epw');

  return (
    <div className="samples-page">
      <header className="samples-hero">
        <button className="samples-back" onClick={onBack}>
          <FaArrowLeft /> {t('Zpět na úvod')}
        </button>
        <h1>{t('Ukázková data')}</h1>
        <p>
          {t('Stažitelné soubory pro vyzkoušení analytických scénářů bez nutnosti připravovat vlastní data. Stažený soubor stačí v daném scénáři nahrát stejně jako vlastní.')}
        </p>
      </header>

      <main className="samples-content">
        <section className="samples-section">
          <h2 className="samples-section-title">
            {t('HBJSON modely budov')}
          </h2>
          <p className="samples-section-sub">
            {t('Honeybee modely popisující geometrii budov a jejich tepelné zóny.')}
          </p>
          {hbjsons.length === 0 ? (
            <p className="samples-empty">
              {t('Zatím zde nejsou žádné soubory ke stažení.')}
            </p>
          ) : (
            <div className="samples-grid">
              {hbjsons.map((s) => (
                <SampleCard key={s.id} sample={s} />
              ))}
            </div>
          )}
        </section>

        <section className="samples-section">
          <h2 className="samples-section-title">
            {t('EPW klimatická data')}
          </h2>
          <p className="samples-section-sub">
            {t('Hodinová klimatická data pro konkrétní lokality, převzatá z volně dostupných meteorologických souborů.')}
          </p>
          {epws.length === 0 ? (
            <p className="samples-empty">
              {t('Zatím zde nejsou žádné soubory ke stažení.')}
            </p>
          ) : (
            <div className="samples-grid">
              {epws.map((s) => (
                <SampleCard key={s.id} sample={s} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

const SampleCard: React.FC<{ sample: SampleFile }> = ({ sample }) => {
  const t = useT();
  const isHbjson = sample.category === 'hbjson';
  const filename = sample.path.split('/').pop() ?? 'sample';

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = sample.path;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <article
      className={`sample-card ${isHbjson ? 'is-hbjson' : 'is-epw'}`}
      onClick={handleDownload}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDownload();
        }
      }}
    >
      <div className="sample-card-icon">
        {isHbjson ? <FaFile /> : <FaCloudUploadAlt />}
      </div>
      <h3 className="sample-card-title">{sample.name}</h3>
      <p className="sample-card-desc">{t(sample.description)}</p>

      <div className="sample-card-tags">
        {sample.tags.map((tag) => (
          <span key={tag} className="sample-card-tag">{t(tag)}</span>
        ))}
      </div>

      <div className="sample-card-footer">
        <span className="sample-card-size">
          {sample.sizeKb.toLocaleString('cs-CZ')} kB
        </span>
        <span className="sample-card-download">
          <FaDownload /> {t('Stáhnout')}
        </span>
      </div>
    </article>
  );
};

export default SampleData;
