import React from 'react';

interface Props {
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  icon: React.ReactNode;
}

const PagerButton: React.FC<Props> = ({ disabled, onClick, ariaLabel, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      width: 32,
      height: 32,
      display: 'grid',
      placeItems: 'center',
      padding: 0,
      background: disabled ? '#f3f4f6' : '#fafbfc',
      border: '1px solid rgba(0, 0, 0, 0.06)',
      borderRadius: '50%',
      color: disabled ? '#cbd5e1' : '#374151',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'all .15s',
      fontSize: 11,
    }}
    onMouseEnter={e => {
      if (disabled) return;
      e.currentTarget.style.background = '#f1f5f9';
      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
      e.currentTarget.style.color = '#111827';
    }}
    onMouseLeave={e => {
      if (disabled) return;
      e.currentTarget.style.background = '#fafbfc';
      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)';
      e.currentTarget.style.color = '#374151';
    }}
  >
    {icon}
  </button>
);

export default PagerButton;
