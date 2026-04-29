/**
 * Typy pro DWG/DXF → HBJSON konvertor.
 *
 * Pipeline je čistě geometrický převod pro 3D vizualizaci, výsledek
 * obsahuje jen surový HBJSON dict — žádná čísla, validace ani statistiky
 * se v UI nezobrazují.
 *
 * Soubor: ladybug_fe/src/components/analysis/converter/DwgTypes.ts
 */

export interface ConvertResult {
  hbjson: unknown;
}
