/**
 * Prehled budovy — hero stats, seznam mistnosti jako horizontal
 * stripe list s cislem, nazvem, rozmery a plochou.
 *
 * Apple-list pattern: cislo v kolecku vlevo, info uprostred,
 * plocha vpravo zvyraznena.
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealOverview.tsx
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  FaBuilding, FaRulerCombined, FaDoorOpen,
  FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';
import type { RealHPResult } from './hpRealUtils';

interface Props { result: RealHPResult; }

const ROOMS_PER_PAGE = 6;

const HPRealOverview: React.FC<Props> = ({ result: r }) => {
  const m = r.model_info;
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(m.rooms.length / ROOMS_PER_PAGE);
  const shouldPaginate = m.rooms.length > ROOMS_PER_PAGE;
  const visibleRooms = useMemo(() => {
    const start = page * ROOMS_PER_PAGE;
    return m.rooms.slice(start, start + ROOMS_PER_PAGE);
  }, [m.rooms, page]);

  useEffect(() => {
    setPage(p => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount]);

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(pageCount - 1, p + 1));

  return (
    <section className="hp-card hp-overview-card">
      <div className="hp-card-head">
        <FaBuilding className="hp-card-icon" />
        <div>
          <h2>Budova</h2>
          <p className="hp-card-sub">
            Místnosti a celková podlahová plocha
          </p>
        </div>
      </div>

      <div className="hp-overview-stats">
        <div className="hp-overview-stat">
          <FaDoorOpen className="hp-overview-icon" />
          <span className="hp-overview-val">{m.room_count}</span>
          <span className="hp-overview-lbl">místností</span>
        </div>
        <div className="hp-overview-stat">
          <FaRulerCombined className="hp-overview-icon" />
          <span className="hp-overview-val">
            {m.total_floor_area_m2.toFixed(0)}
          </span>
          <span className="hp-overview-lbl">
            m² podlahové plochy
          </span>
        </div>
      </div>

      <div className="hp-room-list">
        {visibleRooms.map((room, i) => (
          <div key={room.identifier} className="hp-room-stripe">
            <span className="hp-room-num">
              {page * ROOMS_PER_PAGE + i + 1}
            </span>
            <div className="hp-room-info">
              <span className="hp-room-title">
                {room.display_name}
              </span>
              <span className="hp-room-dims">
                {room.dim_x_m.toFixed(1)} ×{' '}
                {room.dim_y_m.toFixed(1)} m
              </span>
            </div>
            <span className="hp-room-area-big">
              {room.floor_area_m2.toFixed(0)}
              <small> m²</small>
            </span>
          </div>
        ))}
      </div>

      {shouldPaginate && (
        <div className="hp-room-pagination">
          <button
            type="button"
            className="hp-room-page-btn"
            onClick={goPrev}
            disabled={page === 0}
            aria-label="Předchozí místnosti"
          >
            <FaChevronLeft />
          </button>
          <span className="hp-room-page-status">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="hp-room-page-btn"
            onClick={goNext}
            disabled={page === pageCount - 1}
            aria-label="Další místnosti"
          >
            <FaChevronRight />
          </button>
        </div>
      )}
    </section>
  );
};

export default HPRealOverview;
