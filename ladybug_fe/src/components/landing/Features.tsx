/**
 * Feature karty — Light theme · Uniform grid · Clean hover.
 *
 * ZMĚNA: přidána karta 'heatpump-real' pro celoroční simulaci TČ.
 *
 * Soubor: ladybug_fe/src/components/landing/Features.tsx
 */
import React, { useCallback, type ReactNode } from 'react';
import {
  FaSun, FaWind, FaChartLine,
  FaCog, FaCube, FaSolarPanel, FaFire, FaBolt,
  FaThermometerHalf,
} from 'react-icons/fa';

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
      id: 'solar',
      icon: <FaSun />,
      title: 'Analýza EPW dat o počasí',
      description:
        'Analyzujte EPW data o počasí, směr větru, větrná růžice, teplota, sluneční dráha.',
      color: '#f39c12',
      tags: ['EPW', 'Ladybug', 'Wind Rose'],
    },
    {
      id: 'solar-advanced',
      icon: <FaSolarPanel />,
      title: 'Solární analýza',
      description:
        'Vypočet potenciálu solární energie pro FVE, roční výroba, orientace, umístění panelů.',
      color: '#e67e22',
      tags: ['Radiance', 'HBJSON'],
    },
    {
      id: 'heatpump',
      icon: <FaFire />,
      title: 'Potenciál tepelných čerpadel',
      description:
        'Simulace a porovnání výroby energie čerpadel typu vzduch-voda a země-voda pro vytápění ',
      color: '#14b8a6',
      tags: ['EnergyPlus', 'COP'],
    },
    {
      id: 'heatpump-real',
      icon: <FaThermometerHalf />,
      title: 'Celoroční simulace TČ',
      description:
        'Reálný HVAC (VRF / WSHP) s výkonovými křivkami. Vytápění i chlazení po celý rok.',
      color: '#0891b2',
      tags: ['VRF', 'WSHP', 'HVAC'],
    },
    {
      id: 'combined',
      icon: <FaBolt />,
      title: 'Energetický optimalizátor',
      description:
        'Kombinovaná analýza TČ + FVE. Investiční hodnocení, NPV a energetická bilance.',
      color: '#0d9488',
      tags: ['NPV', 'PED', 'Bilance'],
    },
    {
      id: 'hbjson',
      icon: <FaCube />,
      title: '3D Vizualizace HBJSON',
      description:
        'Vizualizujte HBJSON oblasti pomocí interaktivní 3D vizualizace.',
      color: '#8e44ad',
      tags: ['Three.js', 'HBJSON'],
    },
    {
      id: 'parametric',
      icon: <FaCog />,
      title: '?',
      description: '?',
      color: '#9b59b6',
    },
    {
      id: 'wind',
      icon: <FaWind />,
      title: '?',
      description: '?',
      color: '#3498db',
    },
    {
      id: 'energy',
      icon: <FaChartLine />,
      title: '?',
      description: '?',
      color: '#2ecc71',
    },
  ];

  return (
    <section id="features" className="features-section">
      {/* Jemná aurora */}
      <div className="features-aurora" aria-hidden="true" />
      {/* Dekorativní geo linie */}
      <div className="features-geo" aria-hidden="true" />

      <div className="features-header">
        <span className="features-eyebrow">Moduly</span>
        <h2 className="section-title">Funkce platformy</h2>
     
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