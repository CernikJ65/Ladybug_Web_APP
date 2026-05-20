import React from 'react';
import { useT } from '../../i18n/useT';

const Footer: React.FC = () => {
  const t = useT();
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>{t('© 2026 PED Ladybug Web Tools - Diplomová práce')}</p>
        <p className="footer-note">{t('Postaveno na FastAPI & React')}</p>
      </div>
    </footer>
  );
};

export default Footer;
