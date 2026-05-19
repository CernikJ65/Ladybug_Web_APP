import React from 'react';
import { FaRocket } from 'react-icons/fa';
import { useT } from '../../i18n/useT';

const CallToAction: React.FC = () => {
  const t = useT();
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="cta-section">
      <div className="cta-content">
        <h2 className="cta-title">{t('Připraveni začít?')}</h2>
        <p className="cta-description">
          {t('Vyzkoušejte sílu Ladybug Tools bez nutnosti instalace či programování')}
        </p>
        <button className="cta-button" onClick={handleClick}>
          <FaRocket /> {t('Spustit aplikaci')}
        </button>
      </div>
    </section>
  );
};

export default CallToAction;
