export const PW = 1.0;
export const PH = 1.7;
export const SVG_W = 420;
export const PAD = 30;
export const ROOFS_PER_PAGE = 2;

// Clamp aspect ratio pro adaptivni vysku SVG.
// Ctvercova strecha (aspect ≈ 1) by mela ploche SVG 1.2:1 (= 350px vysky pri 420 width).
// Protahla strecha (aspect ≥ 2.5) ma 2.5:1 (= 168px vysky).
// Tim se panely vzdy vykresli ve spravnych proporcich (PW × PH × Math.cos(tilt))
// a karty nejsou bud zbytecne vysoke (u dlouhych strech) nebo zmackle (u ctvercu).
export const SVG_ASPECT_MIN = 1.2;
export const SVG_ASPECT_MAX = 2.5;

// Vizuální mezera kolem polygonu v metrech (jen aby kompas/popisky neseděly přesně na hraně).
export const VISUAL_PAD_M = 0.8;

// Fallback padding pro OBB ze středů panelů (kdyby chyběl world_polygon).
export const PANELS_FALLBACK_PAD_M = 1.0;
