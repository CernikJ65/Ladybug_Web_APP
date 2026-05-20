import React from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  hint: string;
  onChange: (v: number) => void;
}

const SolarSlider: React.FC<Props> = ({ label, value, min, max, unit, hint, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="saa-slider">
      <label>
        <span>{label}</span>
        <span className="saa-slider-val">{value}{unit}</span>
      </label>
      <div className="saa-slider-wrap">
        <div className="saa-slider-track">
          <div className="saa-slider-fill" style={{ width: `${pct}%` }} />
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(+e.target.value)}
          />
        </div>
      </div>
      <p className="saa-slider-hint">{hint}</p>
    </div>
  );
};

export default SolarSlider;
