import React from 'react';
import { FaRocket } from 'react-icons/fa';

const CallToAction: React.FC = () => {
  const handleClick = () => {
    // Zatím jen scroll nahoru
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="cta-section">
      <div className="cta-content">
        <h2 className="cta-title">Připraveni začít?</h2>
        <p className="cta-description">
          Vyzkoušejte sílu Ladybug Tools bez nutnosti instalace či programování
        </p>
        <button className="cta-button" onClick={handleClick}>
          <FaRocket /> Spustit aplikaci
        </button>
      </div>
    </section>
  );
};

export default CallToAction;