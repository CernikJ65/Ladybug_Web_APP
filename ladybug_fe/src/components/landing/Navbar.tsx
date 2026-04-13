import React, { useEffect, useCallback } from 'react';
import { FaSun } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const sectionTitles: Record<string, { cs: string; en: string }> = {
  '': { cs: 'Ladybug Web', en: 'Ladybug Web' },
  features: { cs: 'Funkce – Ladybug Web', en: 'Features – Ladybug Web' },
  about: { cs: 'O projektu – Ladybug Web', en: 'About – Ladybug Web' },
};

const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();

  const updateTitle = useCallback((hash: string) => {
    const key = hash.replace('#', '');
    const titles = sectionTitles[key] || sectionTitles[''];
    document.title = i18n.language === 'cs' ? titles.cs : titles.en;
  }, [i18n.language]);

  // On mount: read hash, scroll to section, set title
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
    updateTitle(hash);
  }, [updateTitle]);

  // Update title when language changes
  useEffect(() => {
    updateTitle(window.location.hash);
  }, [i18n.language, updateTitle]);

  // Listen to browser back/forward
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      updateTitle(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [updateTitle]);

  const navigateTo = (id: string) => {
    window.location.hash = id ? `#${id}` : '';
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    updateTitle(`#${id}`);
  };

  return (
    <nav className="navbar">
      <div className="nav-content">
        <div className="nav-logo" onClick={() => navigateTo('')} style={{ cursor: 'pointer' }}>
          <FaSun className="logo-icon" />
          <span className="logo-text">{t('navbar.logo')}</span>
        </div>
        <div className="nav-links">
          <a onClick={() => navigateTo('features')} style={{ cursor: 'pointer' }}>
            {t('navbar.features')}
          </a>
          <a onClick={() => navigateTo('about')} style={{ cursor: 'pointer' }}>
            {t('navbar.about')}
          </a>
          <div className="lang-switcher" data-lang={i18n.language}>
            <button
              className={`lang-btn ${i18n.language === 'cs' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('cs')}
            >
              CZ
            </button>
            <button
              className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('en')}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;