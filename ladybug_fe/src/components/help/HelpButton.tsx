import React from 'react';
import { FaRegCompass } from 'react-icons/fa';
import './HelpPanel.css';

interface Props {
  onClick: () => void;
  label?: string;
}

/**
 * Spouštěcí pilulka nápovědy.
 * Plovoucí v pravém horním rohu. Amber ring se zapne při hoveru.
 */
const HelpButton: React.FC<Props> = ({ onClick, label = 'Průvodce' }) => {
  return (
    <button
      type="button"
      className="help-trigger"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <FaRegCompass />
      <span>{label}</span>
    </button>
  );
};

export default HelpButton;