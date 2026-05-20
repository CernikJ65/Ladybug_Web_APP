import React, {
  useState, useEffect, useLayoutEffect, useRef,
} from 'react';
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

type Place = 'top' | 'bottom' | 'left' | 'right';
interface Rect { top: number; left: number; width: number; height: number; }
interface TipPos { top: number; left: number; place: Place; }

const TOOLTIP_W = 320;
const GAP = 16;
const PAD_VP = 16;   // odstup karty od okraje viewportu
const EST_H = 200;   // počáteční odhad, po prvním renderu se koriguje

/* ------------------------------------------------------------------
 * Vybere nejlepší umístění tooltipu vůči cílovému prvku.
 * Pořadí preferencí: step.position (pokud sedí) → bottom → top → right
 * → left. Pokud se nic nevejde, zvolí stranu s největším volným místem.
 * Vždy klampuje pozici tak, aby karta zůstala uvnitř viewportu.
 * ------------------------------------------------------------------ */
const choosePlacement = (
  r: DOMRect,
  tipW: number, tipH: number,
  vw: number, vh: number,
  preferred?: TourStep['position'],
): TipPos => {
  const spaceBelow = vh - r.bottom;
  const spaceAbove = r.top;
  const spaceRight = vw - r.right;
  const spaceLeft  = r.left;

  const needV = tipH + GAP + PAD_VP;
  const needH = tipW + GAP + PAD_VP;

  const fits: Record<Place, boolean> = {
    bottom: spaceBelow >= needV,
    top:    spaceAbove >= needV,
    right:  spaceRight >= needH,
    left:   spaceLeft  >= needH,
  };

  const fallback: Place[] = ['bottom', 'top', 'right', 'left'];
  const order: Place[] = preferred && preferred !== 'auto'
    ? [preferred as Place, ...fallback.filter(p => p !== preferred)]
    : fallback;

  let place: Place | undefined = order.find(p => fits[p]);
  if (!place) {
    // Nic se nevejde — zvol stranu s největším volným místem.
    const all: Array<[Place, number]> = [
      ['bottom', spaceBelow], ['top', spaceAbove],
      ['right',  spaceRight], ['left',  spaceLeft],
    ];
    all.sort((a, b) => b[1] - a[1]);
    place = all[0][0];
  }

  let top: number;
  let left: number;

  switch (place) {
    case 'bottom':
      top  = r.bottom + GAP;
      left = r.left + r.width / 2 - tipW / 2;
      break;
    case 'top':
      top  = r.top - GAP - tipH;
      left = r.left + r.width / 2 - tipW / 2;
      break;
    case 'right':
      top  = r.top + r.height / 2 - tipH / 2;
      left = r.right + GAP;
      break;
    case 'left':
      top  = r.top + r.height / 2 - tipH / 2;
      left = r.left - GAP - tipW;
      break;
  }

  // Clamp do viewportu na obou osách. Bez toho mohl tooltip
  // vyjet pod spodní hranu, hlavně u delších textů.
  left = Math.max(PAD_VP, Math.min(vw - tipW - PAD_VP, left));
  top  = Math.max(PAD_VP, Math.min(vh - tipH - PAD_VP, top));

  return { top, left, place };
};

const TourOverlay: React.FC<Props> = ({ isActive, onClose, steps }) => {
  const [idx, setIdx] = useState(0);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [tip, setTip] = useState<TipPos | null>(null);
  const [visible, setVisible] = useState<TourStep[]>([]);
  const [resizeKey, setResizeKey] = useState(0);

  const tooltipRef = useRef<HTMLDivElement>(null);
  // Pro daný (idx, výška tooltipu) provedeme korekci pozice nejvýš
  // jednou, jinak by druhý useLayoutEffect mohl spadnout do smyčky.
  const correctedRef = useRef<{ idx: number; h: number } | null>(null);

  // Init při skutečném otevření průvodce (steps se může v rodiči
  // re-vytvářet, ale my chceme reset jen při změně isActive).
  useEffect(() => {
    if (!isActive) {
      setSpot(null); setTip(null);
      setIdx(0); setVisible([]);
      correctedRef.current = null;
      return;
    }
    const avail = steps.filter(s => document.querySelector(s.selector));
    setVisible(avail);
    setIdx(0);
    correctedRef.current = null;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Klávesové zkratky.
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

  // Resize okna — invalidace korekce a re-trigger hlavního layout effectu.
  useEffect(() => {
    if (!isActive) return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        correctedRef.current = null;
        setResizeKey(k => k + 1);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [isActive]);

  // Hlavní výpočet pozice — při změně kroku, scroll prvku do viewportu
  // a nastavení spotlightu + počáteční pozice tipu podle odhadu.
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
      const tipH = tooltipRef.current?.offsetHeight ?? EST_H;
      const tipW = tooltipRef.current?.offsetWidth  ?? TOOLTIP_W;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setTip(choosePlacement(r, tipW, tipH, vw, vh, step.position));
    };

    const initial = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const tipH = tooltipRef.current?.offsetHeight ?? EST_H;

    // Element musí být alespoň částečně ve viewportu — bez toho by
    // initial.bottom mohlo být záporné (element je nad viewportem)
    // a spaceBelow by vyšlo nesmyslně velké, takže by se nescrollovalo.
    const inView = initial.top < vh && initial.bottom > 0;
    const spaceBelow = vh - initial.bottom;
    const fitsBelow = inView && spaceBelow >= tipH + GAP + PAD_VP;

    if (fitsBelow) {
      finalize();
      return () => { cancelled = true; };
    }

    // Element je buď úplně mimo viewport, nebo ve viewportu ale moc
    // nízko. V obou případech smooth scrollujeme — buď do středu, nebo
    // tak, aby horní okraj byl cca 120 px od horní hrany viewportu.
    if (!inView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const targetY = Math.min(120, vh * 0.2);
      window.scrollBy({ top: initial.top - targetY, behavior: 'smooth' });
    }

    // Čekáme na ustálení smooth scrollu — tři stabilní framy v řadě
    // znamenají, že animace dojela. Pojistka 1500 ms zabrání zaseknutí.
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
      if (performance.now() - start > 1500) { finalize(); return; }
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);

    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, [isActive, idx, visible, resizeKey]);

  // Korekce pozice po prvním renderu — změří skutečnou výšku tooltipu
  // a pokud se liší od odhadu, překalkuluje umístění. Pro každý idx
  // se provede maximálně jednou (krom resize), takže nehrozí smyčka.
  useLayoutEffect(() => {
    if (!tip || !tooltipRef.current) return;
    const step = visible[idx];
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) return;

    const realH = tooltipRef.current.offsetHeight;
    const realW = tooltipRef.current.offsetWidth;

    if (
      correctedRef.current?.idx === idx
      && correctedRef.current?.h === realH
    ) return;

    const r = el.getBoundingClientRect();
    const fresh = choosePlacement(
      r, realW, realH,
      window.innerWidth, window.innerHeight, step.position,
    );

    correctedRef.current = { idx, h: realH };

    if (
      Math.abs(fresh.top - tip.top) > 2
      || Math.abs(fresh.left - tip.left) > 2
      || fresh.place !== tip.place
    ) {
      setTip(fresh);
    }
  }, [tip, idx, visible]);

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
        <div
          ref={tooltipRef}
          className={`tour-tooltip ${tip.place}`}
          style={{ top: tip.top, left: tip.left, width: TOOLTIP_W }}
        >
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