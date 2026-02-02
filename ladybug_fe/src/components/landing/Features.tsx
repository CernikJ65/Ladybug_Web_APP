import React, { type ReactNode } from 'react';
import { FaSun, FaWind, FaTree, FaChartLine, FaCog, FaCube, FaSolarPanel } from 'react-icons/fa';

interface Feature {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}

interface FeaturesProps {
  onFeatureClick: (featureId: string) => void;
}

const Features: React.FC<FeaturesProps> = ({ onFeatureClick }) => {
  const features: Feature[] = [
    {
      id: 'solar',
      icon: <FaSun />,
      title: 'Analýza EPW dat o počasí',
      description: 'Analyzujte EPW data o počasí, pro danou lokalitu, směr větru a sestavte větrnou růžici pro vaši lokalitu.',
      color: '#f39c12',
    },
    {
      id: 'solar-advanced',
      icon: <FaSolarPanel />,
      title: 'Pokročilá solární analýza',
      description: 'Analyzujte solární potenciál střech z HBJSON modelu. Vypočítejte roční radiaci a odhad výroby z PV panelů.',
      color: '#e67e22',
    },
    {
      id: 'hbjson',
      icon: <FaCube />,
      title: '3D Vizualizace HBJSON',
      description: 'Interaktivní 3D prohlížeč pro HBJSON modely budov s renderingem a analýzou geometrie.',
      color: '#8e44ad',
    },
    {
      id: 'parametric',
      icon: <FaCog />,
      title: 'Návrhář budov',
      description: 'Vytvářejte vlastní HBJSON modely budov s místnostmi, okny a exportem dat.',
      color: '#9b59b6',
    },
    {
      id: 'wind',
      icon: <FaWind />,
      title: 'Větrání & CFD',
      description: 'Simulujte proudění vzduchu kolem budovy a optimalizujte přirozené větrání.',
      color: '#3498db',
    },
    {
      id: 'climate',
      icon: <FaTree />,
      title: 'Klimatická data',
      description: 'Pracujte s EPW soubory a analyzujte mikroklima lokality.',
      color: '#27ae60',
    },
    {
      id: 'energy',
      icon: <FaChartLine />,
      title: 'Energetické modely',
      description: 'Vyhodnocujte energetickou náročnost a optimalizujte návrh.',
      color: '#e74c3c',
    },
  ];

  return (
    <section className="features-section" id="features">
      <div className="features-header">
        <h2 className="section-title">Co můžete zkusit</h2>
        <p className="section-subtitle">
          Nástroje pro analýzu pomocí Ladybug dostupné jedním kliknutím
        </p>
      </div>
      <div className="features-grid">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            className="feature-card"
            style={{ animationDelay: `${index * 0.1}s`, cursor: 'pointer' }}
            onClick={() => onFeatureClick(feature.id)}
          >
            <div
              className="feature-icon"
              style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
            >
              {feature.icon}
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-description">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;