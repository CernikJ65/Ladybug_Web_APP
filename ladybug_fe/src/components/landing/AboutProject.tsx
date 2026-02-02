import React from 'react';
import { FaInfoCircle, FaGraduationCap, FaUniversity, FaLightbulb } from 'react-icons/fa';

const AboutProject: React.FC = () => {
  return (
    <section className="about-section" id="about">
      <div className="about-content">
        <div className="about-icon">
          <FaInfoCircle size={56} />
        </div>
        <h2 className="about-title">O projektu</h2>
        <div className="about-text">
          <div>
            <FaGraduationCap size={32} />
            <p>
              Tento projekt vznikl jako součást <strong>diplomové práce</strong> na <strong>Ostravské univerzitě</strong> v rámci programu <strong>STENEO</strong>, který se zaměřuje na výzkum a vývoj pozitivně energetických čtvrtí (Positive Energy Districts).
            </p>
          </div>
          
          <div>
            <FaLightbulb size={32} />
            <p>
              Cílem je <strong>zpřístupnit pokročilé nástroje Ladybug Tools</strong> širší veřejnosti bez nutnosti instalace, programování nebo složitého nastavení. Pomocí této webové platformy můžete provádět energetické analýzy budov, simulace slunečního záření, větrání a mnoho dalšího přímo ve vašem prohlížeči.
            </p>
          </div>
          
          <div>
            <FaUniversity size={32} />
            <p>
              Platforma spojuje <strong>React frontend</strong> s výkonným <strong>FastAPI backendem</strong> a využívá Ladybug Tools knihovny pro přesné výpočty a vizualizace. Vše je navrženo s důrazem na uživatelskou přívětivost a dostupnost pro architekty, inženýry i studenty.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutProject;