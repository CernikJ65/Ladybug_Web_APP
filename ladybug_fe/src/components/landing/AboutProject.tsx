import React from 'react';
import { FaInfoCircle, FaGraduationCap, FaLightbulb, FaLaptopCode } from 'react-icons/fa';
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
                  'Tento projekt vznikl jako součást <strong>diplomové práce</strong> na <strong>Ostravské univerzitě</strong>.',
                ),
              }}
            />
          </div>

          <div>
            <FaLightbulb size={32} />
            <p
              dangerouslySetInnerHTML={{
                __html: t(
                  'Aplikace zpřístupňuje analytické funkce platformy <strong>Ladybug Tools</strong> uplatňované při analýze <strong>pozitivních energetických oblastí (PED)</strong>. Uživateli umožňuje spouštět vybrané Ladybug funkce <strong>bez nutnosti psaní kódu</strong> a bez vazby na placené prostředí <strong>Rhinoceros</strong>, čímž odstraňuje hlavní překážky širšího osvojení této platformy.',
                ),
              }}
            />
          </div>

          <div>
            <FaLaptopCode size={32} />
            <p
              dangerouslySetInnerHTML={{
                __html: t(
                  'Aplikace je postavena na architektuře <strong>klient–server</strong>. Klientská část je realizována pomocí knihovny <strong>React</strong> a jazyka <strong>TypeScript</strong>, serverová část v jazyce <strong>Python</strong> za využití frameworku <strong>FastAPI</strong>, který v rámci jednotlivých scénářů volá funkce knihovny <strong>Ladybug Tools</strong> doplněné o vlastní aplikační logiku.',
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