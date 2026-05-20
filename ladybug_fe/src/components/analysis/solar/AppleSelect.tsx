import React, { useState, useEffect, useRef } from 'react';

interface AppleSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: AppleSelectOption[];
  onChange: (v: string) => void;
  ariaLabel?: string;
}

const AppleSelect: React.FC<Props> = ({ value, options, onChange, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const current = options.find(o => o.value === value) ?? options[0];
  const currentIdx = options.findIndex(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(options.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[activeIdx];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, activeIdx, options, onChange]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector<HTMLLIElement>('.saa-asel-opt.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIdx]);

  const toggleOpen = () => {
    if (!open) setActiveIdx(currentIdx >= 0 ? currentIdx : 0);
    setOpen(o => !o);
  };

  return (
    <div ref={wrapRef} className={`saa-asel ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="saa-asel-trigger"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="saa-asel-val">{current.label}</span>
        <span className="saa-asel-chev" aria-hidden="true" />
      </button>

      {open && (
        <ul ref={menuRef} className="saa-asel-menu" role="listbox">
          {options.map((opt, idx) => {
            const isSel = opt.value === value;
            const isActive = idx === activeIdx;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSel}
                className={
                  `saa-asel-opt` +
                  (isSel ? ' sel' : '') +
                  (isActive ? ' active' : '')
                }
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="saa-asel-opt-label">{opt.label}</span>
                {isSel && <span className="saa-asel-check" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AppleSelect;
