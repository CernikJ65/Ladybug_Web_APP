/**
 * Feature karty — Light theme · Uniform grid · Clean hover.
 *
 * ZMĚNA: nové pořadí karet podle workflow uživatele.
 *
 * Soubor: ladybug_fe/src/components/landing/Features.tsx
 */
import React, { useCallback, type ReactNode } from 'react';
import {
  FaSun,
  FaCube, FaSolarPanel, FaBalanceScale,
  FaFileImport,
  FaThermometerQuarter,
} from 'react-icons/fa';
import { useT } from '../../i18n/useT';

interface Feature {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
  tags?: string[];
}

interface Props {
  onFeatureClick: (id: string) => void;
}

const Features: React.FC<Props> = ({ onFeatureClick }) => {
  const t = useT();

  /* Spotlight: sledování kurzoru */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = e.currentTarget;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }, [],
  );

  const features: Feature[] = [
    {
      id: 'hbjson',
      icon: <FaCube />,
      title: t('3D Vizualizace HBJSON'),
      description: t(
        'Vizualizujte HBJSON oblasti pomocí interaktivní 3D vizualizace.',
      ),
      color: '#8e44ad',
      tags: ['Three.js', 'HBJSON'],
    },
    {
      id: 'solar',
      icon: <FaSun />,
      title: t('Analýza EPW dat o počasí'),
      description: t(
        'Analyzujte EPW data o počasí, směr větru, větrná růžice, teplota, sluneční dráha.',
      ),
      color: '#f39c12',
      tags: ['EPW', 'Ladybug', 'Wind Rose'],
    },
    {
      id: 'solar-advanced',
      icon: <FaSolarPanel />,
      title: t('Solární analýza'),
      description: t(
        'Vypočet potenciálu solární energie pro FVE, roční výroba, orientace, umístění panelů.',
      ),
      color: '#e67e22',
      tags: ['Radiance', 'HBJSON'],
    },
     {
       id: 'heatpump-real',
       icon: <FaThermometerQuarter />,
     title: t('Potenciál tepelných čerpadel'),
       description: t(
         'Scénář simuluje potenciál výroby tepla, a chladu tepelných čerpadel a zároveň porovnává dva typy: vzduch-voda (ASHP) a země-voda (GSHP)',
       ),
       color: '#0891b2',
       tags: ['EnergyPlus', 'WSHP', 'HVAC'],
     },
    {
      id: 'ped-optimizer',
      icon: <FaBalanceScale />,
      title: t('Optimalizace Oblasti pomocí PV a TČ'),
      description: t(
        'Uživatel zadá investiční rozpočet a v rámci zadaného rozpočtu simulace osadí oblast energetickými agenty třemi způsoby. ',
      ),
      color: '#0d9488',
      tags: ['PED', 'Bilance', 'Rozpočet'],
    },
    {
      id: 'converter',
      icon: <FaFileImport />,
      title: 'DWG / DXF → HBJSON',
      description: t(
        'Převeďte CAD soubory na Honeybee modely. Automatická extrakce budov a terénu.',
      ),
      color: '#b45309',
      tags: ['DWG', 'DXF', 'Honeybee'],
    },
    // {
    //   id: 'wind',
    //   icon: <FaWind />,
    //   title: '?',
    //   description: '?',
    //   color: '#3498db',
    // },
    // {
    //   id: 'energy',
    //   icon: <FaChartLine />,
    //   title: '?',
    //   description: '?',
    //   color: '#2ecc71',
    // },
  ];

  return (
    <section id="features" className="features-section">
      {/* Jemná aurora */}
      <div className="features-aurora" aria-hidden="true" />
      {/* Dekorativní geo linie */}
      <div className="features-geo" aria-hidden="true" />

      <div className="features-header">
        
        <h2 className="section-title">{t('Analytické scénáře')}</h2>
      </div>

      <div className="features-grid">
        {features.map((f, i) => (
          <div
            key={f.id}
            className="feature-card"
            style={{ '--accent': f.color, '--i': i } as React.CSSProperties}
            onClick={() => onFeatureClick(f.id)}
            onMouseMove={handleMouseMove}
          >
            {/* Spotlight — jemný follow kurzoru */}
            <div className="feature-spotlight" />

            {/* Barevný akcent nahoře */}
            <div className="feature-accent" />

            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.description}</p>

            {f.tags && f.tags.length > 0 && (
              <div className="feature-tags">
                {f.tags.map((tag) => (
                  <span key={tag} className="feature-tag">{tag}</span>
                ))}
              </div>
            )}

            <span className="feature-arrow">→</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;