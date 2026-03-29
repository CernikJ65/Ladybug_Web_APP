/**
 * Hero sekce — Apple-inspired + subtle living touches.
 *
 * Soubor: ladybug_fe/src/components/landing/Hero.tsx
 */
import React from 'react';
import {
  FaArrowRight, FaInfoCircle,
  FaCloudSun, FaCube, FaFileExport, FaSun,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const Hero: React.FC = () => {
  const { t } = useTranslation();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
    });
  };

  return (
    <section className="hero-section">
      {/* Subtle ambient layers */}
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-light-leak" aria-hidden="true" />
      <div className="hero-light-leak hero-light-leak--2" aria-hidden="true" />

      <div className="hero-content">
        <div className="hero-badge">
          <FaSun className="badge-icon" />
          <span>{t('hero.badge')}</span>
        </div>
        <h1 className="hero-title">
          {t('hero.title')}
          <span className="gradient-text">
            {' '}{t('hero.titleHighlight')}
          </span>
        </h1>
        <p className="hero-description">
          {t('hero.description')}
        </p>
        <div className="hero-buttons">
          <button className="btn-primary"
            onClick={() => scrollTo('features')}>
            <FaArrowRight /> {t('hero.btnFeatures')}
          </button>
          <button className="btn-secondary"
            onClick={() => scrollTo('about')}>
            <FaInfoCircle /> {t('hero.btnMore')}
          </button>
        </div>
      </div>

      <div className="hero-visual">
        <div className="floating-card card-1">
          <div className="card-icon-wrapper sun">
            <FaCloudSun className="card-icon" />
          </div>
          <div className="card-text">
            <div className="card-value">
              {t('hero.card1Value')}
            </div>
            <div className="card-label">
              {t('hero.card1Label')}
            </div>
          </div>
        </div>

        <div className="floating-card card-2">
          <div className="card-icon-wrapper wind">
            <FaCube className="card-icon" />
          </div>
          <div className="card-text">
            <div className="card-value">
              {t('hero.card2Value')}
            </div>
            <div className="card-label">
              {t('hero.card2Label')}
            </div>
          </div>
        </div>

        <div className="floating-card card-3">
          <div className="card-icon-wrapper temp">
            <FaFileExport className="card-icon" />
          </div>
          <div className="card-text">
            <div className="card-value">
              {t('hero.card3Value')}
            </div>
            <div className="card-label">
              {t('hero.card3Label')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;