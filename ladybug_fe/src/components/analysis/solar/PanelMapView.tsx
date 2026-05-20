import React, { useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import type { PanelMapProps, Panel, RoofMeta } from './panelMapTypes';
import { ROOFS_PER_PAGE } from './panelMapConstants';
import RoofView from './RoofView';
import PagerButton from './PagerButton';
import { useT } from '../../../i18n/useT';

export type { RoofMeta } from './panelMapTypes';

const PanelMapView: React.FC<PanelMapProps> = ({ panels, roofs, panelOrder }) => {
  const t = useT();
  const [page, setPage] = useState(0);

  const data = useMemo(() => {
    if (!panels.length) return null;
    const gMinR = Math.min(...panels.map(p => p.radiation_kwh_m2));
    const gMaxR = Math.max(...panels.map(p => p.radiation_kwh_m2));
    const tP = panels.reduce((s, p) => s + p.annual_production_kwh, 0);
    const rI = new Map<string, RoofMeta>();
    (roofs ?? []).forEach(r => rI.set(r.identifier, r));
    const rM = new Map<string, Panel[]>();
    panels.forEach(p => { if (!rM.has(p.roof_id)) rM.set(p.roof_id, []); rM.get(p.roof_id)!.push(p); });
    const gr = [...rM.entries()].sort((a, b) =>
      b[1].reduce((s, p) => s + p.annual_production_kwh, 0) -
      a[1].reduce((s, p) => s + p.annual_production_kwh, 0));
    return { gr, gMinR, gMaxR, tP, rI };
  }, [panels, roofs]);

  if (!data) return null;
  const { gr, tP } = data;
  const fmt = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

  const pageCount = Math.ceil(gr.length / ROOFS_PER_PAGE);
  const needsPaging = gr.length > ROOFS_PER_PAGE;
  const safePage = Math.min(page, pageCount - 1);
  const visible = gr.slice(safePage * ROOFS_PER_PAGE, (safePage + 1) * ROOFS_PER_PAGE);

  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => Math.min(pageCount - 1, p + 1));

  const panelLabel = panels.length === 1 ? t('panel') : panels.length < 5 ? t('panely') : t('panelů');
  const roofLabel = gr.length === 1 ? t('střeše') : t('střechách');

  return (
    <div
      data-tour="panel-map"
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: '16px 20px 14px',
      }}>
        <div>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.015em',
          }}>
            {t('Rozmístění panelů')}
          </div>
          <div style={{
            fontSize: 11,
            color: '#9ca3af',
            marginTop: 2,
            fontWeight: 400,
          }}>
            {panels.length} {panelLabel} {t('na')} {gr.length} {roofLabel}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#111827',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>
            {fmt(tP)}
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#9ca3af',
              marginLeft: 4,
            }}>
              kWh
            </span>
          </div>
          <div style={{
            fontSize: 9,
            color: '#9ca3af',
            marginTop: 2,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {t('celková roční výroba')}
          </div>
        </div>
      </div>

      <div style={{
        padding: '4px 14px 14px',
        display: 'grid',
        gridTemplateColumns: visible.length === 1
          ? 'minmax(0, 520px)'
          : 'repeat(2, 1fr)',
        justifyContent: visible.length === 1 ? 'center' : 'stretch',
        alignItems: 'start',
        gap: 12,
      }}>
        {visible.map(([rid, rp]) => (
          <RoofView
            key={rid}
            roofId={rid}
            panels={rp}
            roofMeta={data.rI.get(rid)}
            gMinR={data.gMinR}
            gMaxR={data.gMaxR}
            panelOrder={panelOrder}
          />
        ))}
      </div>

      {needsPaging && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '4px 14px 16px',
        }}>
          <PagerButton
            disabled={safePage === 0}
            onClick={goPrev}
            ariaLabel={t('Předchozí stránka')}
            icon={<FaChevronLeft />}
          />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
            letterSpacing: '-0.005em',
            minWidth: 56,
            textAlign: 'center',
          }}>
            <span style={{ color: '#111827' }}>{safePage + 1}</span>
            <span style={{ margin: '0 6px', color: '#cbd5e1' }}>/</span>
            <span>{pageCount}</span>
          </span>
          <PagerButton
            disabled={safePage === pageCount - 1}
            onClick={goNext}
            ariaLabel={t('Další stránka')}
            icon={<FaChevronRight />}
          />
        </div>
      )}
    </div>
  );
};

export default PanelMapView;
