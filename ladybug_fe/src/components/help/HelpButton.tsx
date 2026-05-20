import React from 'react';
import { FaRegCompass } from 'react-icons/fa';
import { useT } from '../../i18n/useT';
import './HelpPanel.css';

interface Props {
  onClick: () => void;
  label?: string;
}

/**
 * Spouštěcí pilulka nápovědy.
 * Plovoucí v pravém horním rohu. Amber ring se zapne při hoveru.
 */
const HelpButton: React.FC<Props> = ({ onClick, label }) => {
  const t = useT();
  const displayLabel = label ?? t('Průvodce');
  return (
    <button
      type="button"
      className="help-trigger"
      onClick={onClick}
      aria-label={displayLabel}
      title={displayLabel}
    >
      <FaRegCompass />
      <span>{displayLabel}</span>
    </button>
  );
};

export default HelpButton;