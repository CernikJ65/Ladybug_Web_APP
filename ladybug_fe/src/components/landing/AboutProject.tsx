import React from 'react';
import { FaInfoCircle, FaGraduationCap, FaUniversity, FaLightbulb } from 'react-icons/fa';
import { useT } from '../../i18n/useT';

const AboutProject: React.FC = () => {
  const t = useT();
  return (
    <section className="about-section" id="about">
      <div className="about-content">
        <div className="about-icon">
          <FaInfoCircle size={56} />
        </div>
        <h2 className="about-title">{t('O projektu')}</h2>
        <div className="about-text">
          <div>
            <FaGraduationCap size={32} />
            <p
              dangerouslySetInnerHTML={{
                __html: t(
                  'Tento projekt vznikl jako součást <strong>diplomové práce</strong> na <strong>Ostravské univerzitě</strong> v rámci programu <strong>STENEO</strong>, který se zaměřuje na výzkum a vývoj pozitivně energetických čtvrtí (Positive Energy Districts).',
                ),
              }}
            />
          </div>

          <div>
            <FaLightbulb size={32} />
            <p
              dangerouslySetInnerHTML={{
                __html: t(
                  'Cílem je <strong>zpřístupnit pokročilé nástroje Ladybug Tools</strong> širší veřejnosti bez nutnosti instalace, programování nebo složitého nastavení. Pomocí této webové platformy můžete provádět energetické analýzy budov, simulace slunečního záření, větrání a mnoho dalšího přímo ve vašem prohlížeči.',
                ),
              }}
            />
          </div>

          <div>
            <FaUniversity size={32} />
            <p
              dangerouslySetInnerHTML={{
                __html: t(
                  'Platforma spojuje <strong>React frontend</strong> s výkonným <strong>FastAPI backendem</strong> a využívá Ladybug Tools knihovny pro přesné výpočty a vizualizace. Vše je navrženo s důrazem na uživatelskou přívětivost a dostupnost pro architekty, inženýry i studenty.',
                ),
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutProject;
