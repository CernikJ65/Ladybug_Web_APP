/**
 * PanelMapView v6 — 2-sloupcový grid, stránkování 4+ střech.
 * Soubor: ladybug_fe/src/components/analysis/solar/PanelMapView.tsx
 */
import React, { useMemo, useState } from 'react';

export interface WorldBounds {
  min_x: number; max_x: number; min_y: number; max_y: number;
  width_m: number; depth_m: number;
}
export interface RoofMeta {
  identifier: string; area_m2: number; tilt: number; azimuth: number;
  orientation: string; center: number[]; world_bounds?: WorldBounds;
}
interface Panel {
  id: number; roof_id: string; center: number[];
  tilt: number; azimuth: number; radiation_kwh_m2: number;
  annual_production_kwh: number; area_m2: number;
}
interface Props { panels: Panel[]; roofs?: RoofMeta[]; }

function heatColor(t: number): string {
  const S: [number,number,number][] = [[59,130,246],[16,185,129],[234,179,8],[249,115,22],[239,68,68]];
  const c = Math.max(0,Math.min(1,t)), s = c*(S.length-1);
  const i = Math.min(Math.floor(s),S.length-2), f = s-i, a = S[i], b = S[i+1];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}
function heatColorLight(t: number): string {
  const S: [number,number,number][] = [[147,197,253],[110,231,183],[253,224,71],[253,186,116],[252,165,165]];
  const c = Math.max(0,Math.min(1,t)), s = c*(S.length-1);
  const i = Math.min(Math.floor(s),S.length-2), f = s-i, a = S[i], b = S[i+1];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}

const CD = ['N','NE','E','SE','S','SW','W','NW'];
function azL(az: number) { return CD[Math.round(((az%360)+360)%360/45)%8]; }

const PW = 1.0, PH = 1.7;
const SVG_W = 420;
const SVG_H = 280;
const PAD = 36;

interface RVP {
  roofId: string; panels: Panel[]; roofMeta?: RoofMeta;
  gMinR: number; gMaxR: number; accent: string;
}

const RoofView: React.FC<RVP> = ({ roofId, panels, roofMeta, gMinR, gMaxR, accent }) => {
  const [hov, setHov] = useState<number|null>(null);

  const L = useMemo(() => {
    if (!panels.length) return null;
    let x0: number, x1: number, y0: number, y1: number;
    if (roofMeta?.world_bounds && roofMeta.world_bounds.width_m > 0) {
      x0 = roofMeta.world_bounds.min_x; x1 = roofMeta.world_bounds.max_x;
      y0 = roofMeta.world_bounds.min_y; y1 = roofMeta.world_bounds.max_y;
    } else {
      const xs = panels.map(p=>p.center[0]), ys = panels.map(p=>p.center[1]);
      const px = Math.max(2,(Math.max(...xs)-Math.min(...xs))*0.25);
      const py = Math.max(2,(Math.max(...ys)-Math.min(...ys))*0.25);
      x0=Math.min(...xs)-px; x1=Math.max(...xs)+px;
      y0=Math.min(...ys)-py; y1=Math.max(...ys)+py;
    }
    const wM=x1-x0, hM=y1-y0;
    const aW=SVG_W-2*PAD, aH=SVG_H-2*PAD;
    const sc = Math.min(aW/wM, aH/hM);
    const dW=wM*sc, dH=hM*sc;
    const ox=(SVG_W-dW)/2, oy=(SVG_H-dH)/2;
    const toS = (wx:number,wy:number) => ({ x:ox+(wx-x0)*sc, y:oy+(y1-wy)*sc });
    const tr = (panels[0]?.tilt??0)*Math.PI/180;
    const pw=PW*sc, ph=PH*Math.cos(tr)*sc;
    const rM = wM>=20?10:wM>=10?5:wM>=4?2:1;
    const rPx = rM*sc;
    const tP = panels.reduce((s,p)=>s+p.annual_production_kwh,0);
    const aR = panels.reduce((s,p)=>s+p.radiation_kwh_m2,0)/panels.length;
    return { ox,oy,dW,dH,wM,hM,sc,toS,pw,ph,rM,rPx,tP,aR };
  }, [panels, roofMeta]);

  if (!L) return null;
  const {ox,oy,dW,dH,wM,hM,sc,toS,pw,ph,rM,rPx,tP,aR} = L;
  const fmt=(n:number)=>n.toLocaleString('cs-CZ',{maximumFractionDigits:0});
  const ori = roofMeta?.orientation||azL(roofMeta?.azimuth??panels[0]?.azimuth??180);
  const tilt = roofMeta?.tilt??panels[0]?.tilt??0;
  const sId = roofId.replace(/.*_/,'').replace('RoofCeiling','Střecha');
  const uid = roofId.replace(/[^a-zA-Z0-9]/g,'_');

  return (
    <div style={{
      background:'#fff', borderRadius:10, border:'1px solid #e5e7eb',
      overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'8px 12px', borderBottom:'1px solid #f0f0f0', background:'#fafbfc',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:8,height:8,borderRadius:2,background:accent}} />
          <span style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{sId}</span>
          <span style={{fontSize:9,fontWeight:600,color:'#64748b',background:'#f1f5f9',padding:'1px 6px',borderRadius:3}}>
            {ori} · {tilt.toFixed(0)}°
          </span>
        </div>
        <span style={{fontSize:10,color:'#94a3b8',fontWeight:500}}>
          {panels.length} panelů · {wM.toFixed(1)}×{hM.toFixed(1)} m
        </span>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%"
        style={{display:'block',background:'#f8fafc'}}>
        <defs>
          <pattern id={`g-${uid}`} width={Math.max(8,2*sc)} height={Math.max(8,2*sc)} patternUnits="userSpaceOnUse">
            <circle cx={Math.max(4,sc)} cy={Math.max(4,sc)} r={0.5} fill="#cbd5e1" opacity={0.3} />
          </pattern>
          <filter id={`s-${uid}`}>
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.06" />
          </filter>
          {panels.map(p => {
            const t = gMaxR>gMinR?(p.radiation_kwh_m2-gMinR)/(gMaxR-gMinR):0.5;
            return (
              <linearGradient key={p.id} id={`p-${uid}-${p.id}`} x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0%" stopColor={heatColorLight(t)} stopOpacity={0.65} />
                <stop offset="100%" stopColor={heatColor(t)} stopOpacity={0.95} />
              </linearGradient>
            );
          })}
        </defs>

        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill={`url(#g-${uid})`} />
        <rect x={ox} y={oy} width={dW} height={dH}
          fill="#fff" stroke="#cbd5e1" strokeWidth={1.2} rx={3} filter={`url(#s-${uid})`} />
        <rect x={ox+2} y={oy+2} width={dW-4} height={dH-4}
          fill="none" stroke={accent} strokeWidth={0.4} strokeOpacity={0.2} rx={2} strokeDasharray="4 3" />

        {panels.map(p => {
          const t = gMaxR>gMinR?(p.radiation_kwh_m2-gMinR)/(gMaxR-gMinR):0.5;
          const {x,y} = toS(p.center[0],p.center[1]);
          const isH = hov===p.id, col = heatColor(t);
          const px1=x-pw/2, py1=y-ph/2;
          return (
            <g key={p.id} onMouseEnter={()=>setHov(p.id)} onMouseLeave={()=>setHov(null)}
              style={{cursor:'pointer'}}>
              {isH && (
                <rect x={px1-2} y={py1-2} width={pw+4} height={ph+4}
                  fill="none" stroke={col} strokeWidth={1.5} rx={3} opacity={0.5}>
                  <animate attributeName="opacity" values="0.3;0.7;0.3" dur="1.5s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={px1+0.6} y={py1+0.8} width={pw} height={ph} fill="rgba(0,0,0,0.08)" rx={1.5} />
              <rect x={px1} y={py1} width={pw} height={ph}
                fill={`url(#p-${uid}-${p.id})`}
                stroke={isH?'#1e293b':'rgba(0,0,0,0.15)'}
                strokeWidth={isH?1.2:0.6} rx={1.5} />
              {pw>6 && <line x1={x} y1={py1+1} x2={x} y2={py1+ph-1} stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />}
              {ph>10 && pw>5 && <line x1={px1+1} y1={y} x2={px1+pw-1} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth={0.3} />}
              {pw>4 && ph>4 && <rect x={px1+0.5} y={py1+0.5} width={pw-1} height={Math.max(1,ph*0.22)} fill="rgba(255,255,255,0.15)" rx={1} />}
            </g>
          );
        })}

        {hov!==null && (()=>{
          const p=panels.find(pp=>pp.id===hov);
          if(!p) return null;
          const {x,y}=toS(p.center[0],p.center[1]);
          const tw=148,th=52;
          let tx=x+pw/2+6,ty=y-th/2;
          if(tx+tw>SVG_W-4) tx=x-pw/2-tw-6;
          if(ty<4) ty=4; if(ty+th>SVG_H-4) ty=SVG_H-th-4;
          return (
            <g>
              <rect x={tx} y={ty} width={tw} height={th} rx={5} fill="#1e293b" fillOpacity={0.94} />
              <text x={tx+6} y={ty+14} fill="#fbbf24" fontSize={10} fontWeight={700} fontFamily="monospace">
                {p.radiation_kwh_m2.toFixed(0)} kWh/m²
              </text>
              <text x={tx+6} y={ty+27} fill="#94a3b8" fontSize={9} fontFamily="monospace">
                → {p.annual_production_kwh.toFixed(0)} kWh/rok
              </text>
              <text x={tx+6} y={ty+40} fill="#64748b" fontSize={8} fontFamily="monospace">
                [{p.center[0].toFixed(1)}, {p.center[1].toFixed(1)}, {p.center[2].toFixed(1)}]
              </text>
            </g>
          );
        })()}

        {(()=>{
          const y0=oy+dH+12;
          return (
            <g>
              <line x1={ox} y1={y0} x2={ox+dW} y2={y0} stroke="#94a3b8" strokeWidth={0.7} />
              <line x1={ox} y1={y0-3} x2={ox} y2={y0+3} stroke="#94a3b8" strokeWidth={0.7} />
              <line x1={ox+dW} y1={y0-3} x2={ox+dW} y2={y0+3} stroke="#94a3b8" strokeWidth={0.7} />
              <text x={ox+dW/2} y={y0+12} fill="#64748b" fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight={500}>
                {wM.toFixed(1)} m
              </text>
            </g>
          );
        })()}

        {(()=>{
          const x0=ox-12;
          return (
            <g>
              <line x1={x0} y1={oy} x2={x0} y2={oy+dH} stroke="#94a3b8" strokeWidth={0.7} />
              <line x1={x0-3} y1={oy} x2={x0+3} y2={oy} stroke="#94a3b8" strokeWidth={0.7} />
              <line x1={x0-3} y1={oy+dH} x2={x0+3} y2={oy+dH} stroke="#94a3b8" strokeWidth={0.7} />
              <text x={x0-5} y={oy+dH/2} fill="#64748b" fontSize={9} textAnchor="middle"
                fontFamily="monospace" fontWeight={500} transform={`rotate(-90,${x0-5},${oy+dH/2})`}>
                {hM.toFixed(1)} m
              </text>
            </g>
          );
        })()}

        {(()=>{
          const bx=SVG_W-rPx-14, by=SVG_H-14;
          return (
            <g>
              <rect x={bx-4} y={by-13} width={rPx+8} height={20} rx={3} fill="#f1f5f9" fillOpacity={0.9} stroke="#e2e8f0" strokeWidth={0.4} />
              <line x1={bx} y1={by} x2={bx+rPx} y2={by} stroke="#475569" strokeWidth={2} strokeLinecap="round" />
              <line x1={bx} y1={by-2.5} x2={bx} y2={by+2.5} stroke="#475569" strokeWidth={0.8} />
              <line x1={bx+rPx} y1={by-2.5} x2={bx+rPx} y2={by+2.5} stroke="#475569" strokeWidth={0.8} />
              <text x={bx+rPx/2} y={by-5} fill="#475569" fontSize={8} textAnchor="middle" fontFamily="monospace" fontWeight={600}>
                {rM} m
              </text>
            </g>
          );
        })()}

        {(()=>{
          const cx=SVG_W-22, cy=22;
          return (
            <g>
              <circle cx={cx} cy={cy} r={12} fill="#fff" stroke="#e2e8f0" strokeWidth={0.8} />
              <line x1={cx} y1={cy+6} x2={cx} y2={cy-6} stroke="#cbd5e1" strokeWidth={0.6} />
              <polygon points={`${cx},${cy-9} ${cx-3},${cy-2} ${cx+3},${cy-2}`} fill="#ef4444" opacity={0.8} />
              <polygon points={`${cx},${cy+9} ${cx-3},${cy+2} ${cx+3},${cy+2}`} fill="#d1d5db" />
              <text x={cx} y={cy-13} fill="#64748b" fontSize={7} textAnchor="middle" fontWeight={700} fontFamily="monospace">N</text>
            </g>
          );
        })()}
      </svg>

      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'7px 12px', borderTop:'1px solid #f0f0f0', background:'#fafbfc',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:10,color:'#64748b'}}>⌀</span>
          <span style={{fontSize:12,fontWeight:700,color:accent,fontFamily:'monospace'}}>{aR.toFixed(0)}</span>
          <span style={{fontSize:10,color:'#94a3b8'}}>kWh/m²</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:10,color:'#f59e0b'}}>⚡</span>
          <span style={{fontSize:12,fontWeight:700,color:'#1e293b',fontFamily:'monospace'}}>{fmt(tP)}</span>
          <span style={{fontSize:10,color:'#94a3b8'}}>kWh/rok</span>
        </div>
      </div>
    </div>
  );
};

const ACCENTS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
const INITIAL_VISIBLE = 4;

const PanelMapView: React.FC<Props> = ({ panels, roofs }) => {
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    if (!panels.length) return null;
    const gMinR = Math.min(...panels.map(p=>p.radiation_kwh_m2));
    const gMaxR = Math.max(...panels.map(p=>p.radiation_kwh_m2));
    const tP = panels.reduce((s,p)=>s+p.annual_production_kwh,0);
    const rI = new Map<string,RoofMeta>();
    (roofs??[]).forEach(r=>rI.set(r.identifier,r));
    const rM = new Map<string,Panel[]>();
    panels.forEach(p=>{if(!rM.has(p.roof_id))rM.set(p.roof_id,[]);rM.get(p.roof_id)!.push(p);});
    const gr=[...rM.entries()].sort((a,b)=>
      b[1].reduce((s,p)=>s+p.annual_production_kwh,0)-a[1].reduce((s,p)=>s+p.annual_production_kwh,0));
    return {gr,gMinR,gMaxR,tP,rI};
  }, [panels, roofs]);

  if (!data) return null;
  const {gr,gMinR,gMaxR,tP,rI} = data;
  const fmt=(n:number)=>n.toLocaleString('cs-CZ',{maximumFractionDigits:0});

  const needsPaging = gr.length > INITIAL_VISIBLE;
  const visible = showAll ? gr : gr.slice(0, INITIAL_VISIBLE);
  const hiddenCount = gr.length - INITIAL_VISIBLE;

  return (
    <div style={{background:'#fff',borderRadius:10,border:'1px solid #e5e7eb',overflow:'hidden'}}>
      <div style={{
        display:'flex',justifyContent:'space-between',alignItems:'center',
        padding:'10px 14px',borderBottom:'1px solid #e5e7eb',
      }}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>Rozmístění panelů</div>
          <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>
            Pohled shora · {panels.length} ks · {gr.length} střech
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:16,fontWeight:800,color:'#0f172a',fontFamily:'monospace',lineHeight:1}}>
            {fmt(tP)}
          </div>
          <div style={{fontSize:9,color:'#64748b',marginTop:1}}>kWh/rok celkem</div>
        </div>
      </div>

      <div style={{
        display:'flex',alignItems:'center',gap:8,
        padding:'6px 14px',background:'#f8fafc',borderBottom:'1px solid #f0f0f0',
      }}>
        <span style={{fontSize:10,color:'#64748b',fontWeight:600,whiteSpace:'nowrap'}}>Sol. potenciál</span>
        <span style={{fontSize:9,fontFamily:'monospace',color:'#94a3b8'}}>{Math.round(gMinR)}</span>
        <div style={{flex:1,height:6,borderRadius:3,background:'linear-gradient(to right,#3b82f6,#10b981,#eab308,#f97316,#ef4444)'}} />
        <span style={{fontSize:9,fontFamily:'monospace',color:'#94a3b8'}}>{Math.round(gMaxR)} kWh/m²</span>
      </div>

      {/* 2-sloupcový grid pro střechy */}
      <div style={{
        padding:10,
        display:'grid',
        gridTemplateColumns: gr.length === 1 ? '1fr' : '1fr 1fr',
        gap:10,
      }}>
        {visible.map(([rid,rp],gi)=>(
          <RoofView key={rid} roofId={rid} panels={rp}
            roofMeta={rI.get(rid)} gMinR={gMinR} gMaxR={gMaxR}
            accent={ACCENTS[gi%ACCENTS.length]} />
        ))}
      </div>

      {/* Tlačítko pro zobrazení dalších střech */}
      {needsPaging && !showAll && (
        <div style={{padding:'0 10px 10px',textAlign:'center'}}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              width:'100%',
              padding:'8px 16px',
              background:'#f8fafc',
              border:'1px solid #e2e8f0',
              borderRadius:8,
              fontSize:12,
              fontWeight:600,
              color:'#64748b',
              cursor:'pointer',
              fontFamily:'inherit',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#334155';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            Zobrazit dalších {hiddenCount} střech
          </button>
        </div>
      )}

      {needsPaging && showAll && (
        <div style={{padding:'0 10px 10px',textAlign:'center'}}>
          <button
            onClick={() => setShowAll(false)}
            style={{
              width:'100%',
              padding:'8px 16px',
              background:'#f8fafc',
              border:'1px solid #e2e8f0',
              borderRadius:8,
              fontSize:12,
              fontWeight:600,
              color:'#64748b',
              cursor:'pointer',
              fontFamily:'inherit',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#334155';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            Skrýt ({hiddenCount} střech)
          </button>
        </div>
      )}
    </div>
  );
};

export default PanelMapView;