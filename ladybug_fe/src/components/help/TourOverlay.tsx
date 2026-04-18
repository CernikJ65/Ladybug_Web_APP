import React, { useState, useEffect, useLayoutEffect } from 'react';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import './HelpPanel.css';

export interface TourStep {
  selector: string;
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'auto';
}

interface Props {
  isActive: boolean;
  onClose: () => void;
  steps: TourStep[];
}

interface Rect { top: number; left: number; width: number; height: number; }
interface TipPos { top: number; left: number; place: 'top' | 'bottom'; }

const TOOLTIP_W = 320;
const GAP = 16;
const EST_H = 180;

const TourOverlay: React.FC<Props> = ({ isActive, onClose, steps }) => {
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [tip, setTip] = useState<TipPos | null>(null);
  const [visible, setVisible] = useState<TourStep[]>([]);

  // Init jen při isActive změně — reference na steps může přicházet nová
  // při každém renderu rodiče, ale reset chceme jen při skutečném otevření.
  useEffect(() => {
    if (!isActive) {
      setSpot(null); setTip(null);
      return;
    }
    const avail = steps.filter(s => document.querySelector(s.selector));
    setVisible(avail);
    setIdx(0);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Klávesové zkratky
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') {
        setIdx(i => Math.min(i + 1, visible.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setIdx(i => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, visible.length, onClose]);

  // Měření pozice až po ustálení scrollu (poll každou animační frame,
  // dokud se rect.top 3 framy po sobě nemění → scroll je dokončený).
  useLayoutEffect(() => {
    if (!isActive || !visible[idx]) return;
    const step = visible[idx];
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) { setSpot(null); setTip(null); return; }

    let cancelled = false;
    let rafId = 0;

    const finalize = () => {
      if (cancelled) return;
      const r = el.getBoundingClientRect();
      const pad = 8;
      setSpot({
        top: r.top - pad, left: r.left - pad,
        width: r.width + pad * 2, height: r.height + pad * 2,
      });
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom;
      let place: 'top' | 'bottom' = 'bottom';
      if (step.position === 'top') place = 'top';
      else if (step.position === 'bottom') place = 'bottom';
      else place = spaceBelow >= EST_H + GAP ? 'bottom' : 'top';
      const left = Math.max(16, Math.min(
        vw - TOOLTIP_W - 16,
        r.left + r.width / 2 - TOOLTIP_W / 2,
      ));
      const top = place === 'bottom'
        ? r.bottom + GAP
        : Math.max(16, r.top - GAP - EST_H);
      setTip({ top, left, place });
    };

    // Je prvek celý viditelný? Pokud ano, není potřeba scrollovat,
    // jen změříme a CSS transition doplave.
    const initial = el.getBoundingClientRect();
    const inView = initial.top >= 0 && initial.bottom <= window.innerHeight;

    if (inView) {
      finalize();
      return () => { cancelled = true; };
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let lastTop = NaN;
    let stable = 0;
    const start = performance.now();

    const check = () => {
      if (cancelled) return;
      const currentTop = el.getBoundingClientRect().top;
      if (Math.abs(currentTop - lastTop) < 0.5) {
        stable++;
        if (stable >= 3) { finalize(); return; }
      } else {
        stable = 0;
      }
      lastTop = currentTop;
      // pojistka, kdyby scroll z nějakého důvodu nikdy neustal
      if (performance.now() - start > 1500) { finalize(); return; }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);

    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, [isActive, idx, visible]);

  if (!isActive) return null;

  if (!visible.length) {
    return (
      <div className="tour-empty-wrap">
        <div className="tour-empty">
          <p>Pro průvodce nejprve nahraj EPW soubor.</p>
          <button className="tour-btn primary" onClick={onClose} type="button">
            Rozumím
          </button>
        </div>
      </div>
    );
  }

  const cur = visible[idx];
  const total = visible.length;

  return (
    <>
      <svg className="tour-mask" width="100%" height="100%">
        <defs>
          <mask id="tour-spot-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.left} y={spot.top}
                width={spot.width} height={spot.height}
                rx="10" fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%"
          fill="rgba(8, 12, 18, .84)"
          mask="url(#tour-spot-mask)" />
      </svg>

      {spot && (
        <div className="tour-ring" style={{
          top: spot.top, left: spot.left,
          width: spot.width, height: spot.height,
        }} />
      )}

      {tip && (
        <div className={`tour-tooltip ${tip.place}`}
          style={{ top: tip.top, left: tip.left, width: TOOLTIP_W }}>
          <div className="tour-tooltip-head">
            <span className="tour-counter">
              {idx + 1}<span>/ {total}</span>
            </span>
            <button className="tour-close" onClick={onClose}
              aria-label="Zavřít průvodce" type="button">
              <FaTimes />
            </button>
          </div>
          <h3 className="tour-title">{cur.title}</h3>
          <p className="tour-body">{cur.body}</p>
          <div className="tour-nav">
            <button className="tour-btn secondary" type="button"
              onClick={() => setIdx(i => Math.max(i - 1, 0))}
              disabled={idx === 0}>
              <FaChevronLeft /> Zpět
            </button>
            {idx === total - 1 ? (
              <button className="tour-btn primary" onClick={onClose} type="button">
                Dokončit
              </button>
            ) : (
              <button className="tour-btn primary" type="button"
                onClick={() => setIdx(i => i + 1)}>
                Další <FaChevronRight />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TourOverlay;