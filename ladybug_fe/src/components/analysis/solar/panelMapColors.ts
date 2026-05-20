import type { RoofMeta } from './panelMapTypes';

export function heatColor(t: number): string {
  const S: [number, number, number][] = [
    [99, 102, 241],
    [16, 185, 129],
    [234, 179, 8],
    [249, 115, 22],
  ];
  const c = Math.max(0, Math.min(1, t)), s = c * (S.length - 1);
  const i = Math.min(Math.floor(s), S.length - 2), f = s - i, a = S[i], b = S[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

export function heatColorLight(t: number): string {
  const S: [number, number, number][] = [
    [165, 180, 252],
    [110, 231, 183],
    [253, 224, 71],
    [253, 186, 116],
  ];
  const c = Math.max(0, Math.min(1, t)), s = c * (S.length - 1);
  const i = Math.min(Math.floor(s), S.length - 2), f = s - i, a = S[i], b = S[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

const CD = ['sever', 'severovýchod', 'východ', 'jihovýchod', 'jih', 'jihozápad', 'západ', 'severozápad'];

export function azL(az: number) {
  return CD[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

export function orientationLabel(meta: RoofMeta | undefined, fallbackAz: number, tilt: number): string {
  if (tilt < 5) return 'plochá';
  if (meta?.orientation && meta.orientation !== 'Horizontal') {
    const map: Record<string, string> = {
      'North': 'sever', 'North-East': 'severovýchod', 'East': 'východ',
      'South-East': 'jihovýchod', 'South': 'jih', 'South-West': 'jihozápad',
      'West': 'západ', 'North-West': 'severozápad',
    };
    return map[meta.orientation] ?? azL(meta.azimuth);
  }
  return azL(meta?.azimuth ?? fallbackAz);
}
