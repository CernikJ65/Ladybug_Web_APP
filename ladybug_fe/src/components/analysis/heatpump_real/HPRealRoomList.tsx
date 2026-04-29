/**
 * Per-room produkce TC — Apple-clean rank list s pilulkami.
 *
 * Default zobrazi top 5 mistnosti podle vyrobeneho tepla.
 * Pri vice nez 5 mistnostech se objevi tlacitko "Zobrazit
 * vsech N", po expanzi se zmeni na "Sbalit".
 *
 * Soubor: ladybug_fe/src/components/analysis/heatpump_real/HPRealRoomList.tsx
 */
import React, { useState } from 'react';
import {
  FaFire, FaSnowflake, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import type { RoomDemand } from './hpRealUtils';
import { fmt } from './hpRealUtils';

interface Props {
  rooms: RoomDemand[];
  heatingOnly?: boolean;
}

const ROOM_LIMIT = 5;

const HPRealRoomList: React.FC<Props> = ({
  rooms, heatingOnly = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!rooms || rooms.length === 0) return null;

  const sorted = [...rooms].sort(
    (a, b) => b.heating_kwh - a.heating_kwh,
  );
  const visible = expanded ? sorted : sorted.slice(0, ROOM_LIMIT);
  const hasMore = sorted.length > ROOM_LIMIT;

  return (
    <>
      <h3 className="hp-sub-title">Produkce po místnostech</h3>
      <div className="hpr-room-list">
        {visible.map((r, idx) => (
          <div key={r.identifier} className="hpr-room-row">
            <span className="hpr-room-rank">{idx + 1}</span>
            <div className="hpr-room-meta">
              <span className="hpr-room-name">
                {r.display_name}
              </span>
              <span className="hpr-room-area">
                {r.floor_area_m2.toFixed(0)} m²
              </span>
            </div>
            <div className="hpr-room-pills">
              <span className="hpr-pill heat">
                <FaFire />
                <strong>{fmt(r.heating_kwh)}</strong>
                <em>kWh</em>
              </span>
              {!heatingOnly && (
                <span className="hpr-pill cool">
                  <FaSnowflake />
                  <strong>{fmt(r.cooling_kwh)}</strong>
                  <em>kWh</em>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="hpr-show-more"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? (
            <><FaChevronUp /> Sbalit</>
          ) : (
            <>
              <FaChevronDown />
              Zobrazit všech {sorted.length}
            </>
          )}
        </button>
      )}
    </>
  );
};

export default HPRealRoomList;