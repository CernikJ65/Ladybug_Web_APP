import React, { useEffect, useState } from 'react';
import {
  FaArrowLeft, FaDownload, FaFile, FaCloudUploadAlt,
  FaDraftingCompass,
} from 'react-icons/fa';
import { useT } from '../../i18n/useT';
import { SAMPLES, type SampleFile } from './samplesData';
import './SampleData.css';

interface Props { onBack: () => void; }

const SampleData: React.FC<Props> = ({ onBack }) => {
  const t = useT();
  const hbjsons = SAMPLES.filter((s) => s.category === 'hbjson');
  const epws = SAMPLES.filter((s) => s.category === 'epw');
  const dwgs = SAMPLES.filter((s) => s.category === 'dwg');

  return (
    <div className="smp-page">
      <div className="smp-hero">
        <button className="smp-back" onClick={onBack}>
          <FaArrowLeft /> {t('Zpět')}
        </button>
        <h1>{t('Ukázková data')}</h1>
        <p>
          {t('Stažitelné soubory pro vyzkoušení analytických scénářů bez nutnosti připravovat vlastní data.')}
        </p>
      </div>

      <div className="smp-content">
        <SamplesSection
          title={t('HBJSON modely budov')}
          subtitle={t('Honeybee modely popisující geometrii budov a jejich tepelné zóny.')}
          items={hbjsons}
        />
        <SamplesSection
          title={t('EPW klimatická data')}
          subtitle={t('Hodinová klimatická data pro konkrétní lokality, převzatá z volně dostupných meteorologických souborů.')}
          items={epws}
        />
        <SamplesSection
          title={t('DWG CAD podklady')}
          subtitle={t('Geometrické podklady reálné zástavby, ze kterých lze vygenerovat HBJSON model.')}
          items={dwgs}
        />
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  subtitle: string;
  items: SampleFile[];
}

const SamplesSection: React.FC<SectionProps> = ({
  title, subtitle, items,
}) => {
  const t = useT();
  return (
    <section className="smp-card">
      <div className="smp-card-head">
        <div>
          <h2>{title}</h2>
          <p className="smp-card-sub">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="smp-empty">
          {t('Zatím zde nejsou žádné soubory ke stažení.')}
        </p>
      ) : (
        <div className="smp-grid">
          {items.map((s) => (
            <SampleCard key={s.id} sample={s} />
          ))}
        </div>
      )}
    </section>
  );
};

const SampleCard: React.FC<{ sample: SampleFile }> = ({ sample }) => {
  const t = useT();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(sample.path, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    })
      .then((r) => {
        if (cancelled) return;
        const ct = r.headers.get('content-type') ?? '';
        const isHtml = ct.includes('text/html');
        setAvailable(r.ok && !isHtml);
      })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [sample.path]);

  const isMissing = available === false;
  const filename = sample.path.split('/').pop() ?? 'sample';

  const handleDownload = () => {
    if (isMissing) return;
    const a = document.createElement('a');
    a.href = sample.path;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const icon = sample.category === 'hbjson'
    ? <FaFile />
    : sample.category === 'epw'
      ? <FaCloudUploadAlt />
      : <FaDraftingCompass />;

  return (
    <article
      className={`smp-item is-${sample.category} ${isMissing ? 'is-missing' : ''}`}
      onClick={isMissing ? undefined : handleDownload}
      role={isMissing ? undefined : 'button'}
      tabIndex={isMissing ? -1 : 0}
      onKeyDown={(e) => {
        if (isMissing) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDownload();
        }
      }}
    >
      <div className="smp-item-icon">{icon}</div>
      <h3 className="smp-item-title">{t(sample.name)}</h3>
      {sample.description && (
        <p className="smp-item-desc">{t(sample.description)}</p>
      )}
      <div className="smp-item-footer">
        {isMissing ? (
          <span className="smp-item-missing">
            {t('Soubor není k dispozici')}
          </span>
        ) : (
          <span className="smp-item-action">
            <FaDownload /> {t('Stáhnout')}
          </span>
        )}
      </div>
    </article>
  );
};

export default SampleData;