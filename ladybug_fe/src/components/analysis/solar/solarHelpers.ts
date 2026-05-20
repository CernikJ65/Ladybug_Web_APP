import type { TFn } from '../../../i18n/useT';
import { INVERTER_LOSS } from './solarConstants';

export const fmt = (n: number) =>
  n.toLocaleString('cs-CZ', { maximumFractionDigits: 0 });

export const pct = (v: number | undefined) =>
  v === undefined || v === null ? '—' : `${(v * 100).toFixed(1)} %`;

/* Kombinovana ztrata (system + inverter) — multiplikativne. */
export const combinedLossValue = (systemTotal: number | undefined): number | undefined => {
  if (systemTotal === undefined || systemTotal === null) return undefined;
  return 1 - (1 - systemTotal) * (1 - INVERTER_LOSS);
};

export const mountLabel = (v: string, t: TFn) => {
  switch (v) {
    case 'FixedOpenRack': return t('Otevřená konstrukce');
    case 'FixedRoofMounted': return t('Střešní montáž');
    default: return v;
  }
};

export const cardinalLabel = (v: string | undefined, t: TFn): string => {
  if (!v) return '';
  const map: Record<string, string> = {
    North: t('sever'),
    'North-East': t('severovýchod'),
    East: t('východ'),
    'South-East': t('jihovýchod'),
    South: t('jih'),
    'South-West': t('jihozápad'),
    West: t('západ'),
    'North-West': t('severozápad'),
    Horizontal: t('vodorovně'),
  };
  return map[v] ?? v;
};
