export interface SampleFile {
  id: string;
  category: 'hbjson' | 'epw' | 'dwg';
  name: string;
  description?: string;
  path: string;
}

export const SAMPLES: SampleFile[] = [
  // ── HBJSON modely ──
  {
    id: 'hbjson-cihelny-nezatepleny',
    category: 'hbjson',
    name: 'Nezateplená cihla',
    description:
      'Jednopatrový dům 8×9 m z plnopálené cihly 450 mm bez izolace (U ≈ 1.4), s 8 jednoduchými okny U = 5.0 a netěsným pláštěm.',
    path: '/samples/buildings/cihelny_nezatepleny_dum_rovna_strecha.hbjson',
  },
  {
    id: 'hbjson-zelezobeton-lehce-zatepleny',
    category: 'hbjson',
    name: 'Lehce zateplený dům',
    description:
      'Jednopatrový dům 12×8 m ze železobetonu s 50 mm EPS (U ≈ 0.55), s 8 dvojskelnými okny U = 2.4 a průměrnou těsností pláště.',
    path: '/samples/buildings/jedno_patrovy_dum_zelezobeton_lehce_zatepleny_rovna_strecha.hbjson',
  },
  {
    id: 'hbjson-soucasny-csn',
    category: 'hbjson',
    name: 'Dvoupatrový dům podle ČSN',
    description:
      'Dvoupatrový dům 10×10 m podle aktuální normy ČSN 73 0540-2. Zateplený 120 mm EPS (U = 0.28), s 12 dvojskelnými okny low-e U = 1.1 a těsným pláštěm.',
    path: '/samples/buildings/dum_soucasny_csn.hbjson',
  },
  {
    id: 'hbjson-zatepleny-2patra',
    category: 'hbjson',
    name: 'Zateplený dvoupatrový dům',
    description:
      'Dvoupatrový dům 10×10 m se zateplenou obálkou (U = 0.28), s 12 dvojskelnými okny low-e a 4 tepelnými zónami. Základní model bez kontextu okolí.',
    path: '/samples/buildings/dum_zatepleny_2patra.hbjson',
  },
  {
    id: 'hbjson-zatepleny-2patra-s-terenem',
    category: 'hbjson',
    name: 'Zateplený dvoupatrový dům s terénem',
    description:
      'Stejný dvoupatrový zateplený dům doplněný o plochu terénu v okolí budovy pro realističtější vizualizaci modelu ve 3D náhledu.',
    path: '/samples/buildings/dum_zatepleny_2patra_s_terenem.hbjson',
  },
  {
    id: 'hbjson-pasivni-2025',
    category: 'hbjson',
    name: 'Pasivní dům',
    description:
      'Jednopatrový dům 12×9 m s masivní izolací 300 mm EPS (U ≈ 0.10), s 8 trojskelnými okny U = 0.7 a velmi těsným pláštěm. Splňuje pasivní standard.',
    path: '/samples/buildings/dum_pasivni_2025.hbjson',
  },
  // ── EPW klimatická data ──
  {
    id: 'epw-mosnov-tmyx-2011-2025',
    category: 'epw',
    name: 'Ostrava-Mošnov (TMYx 2011–2025)',
    path: '/samples/buildings/CZE_VK_Mosnov.117820_TMYx.2011-2025.epw',
  },
  {
    id: 'epw-mosnov-tmyx',
    category: 'epw',
    name: 'Ostrava-Mošnov (TMYx)',
    path: '/samples/buildings/CZE_VK_Mosnov.117820_TMYx.epw',
  },
  {
    id: 'epw-ostrava-iwec',
    category: 'epw',
    name: 'Ostrava (IWEC)',
    path: '/samples/buildings/CZE_Ostrava.117820_IWEC.epw',
  },
  {
    id: 'epw-prague-iwec',
    category: 'epw',
    name: 'Praha (IWEC)',
    path: '/samples/buildings/CZE_Prague.115180_IWEC.epw',
  },

  {
    id: 'hbjson-dve-budovy-nezateplene',
    category: 'hbjson',
    name: 'Dvě nezateplené budovy',
    description:
      'Model dvou nezateplených budov s netěsným pláštěm a vysokou potřebou tepla.',
    path: '/samples/buildings/Dve_budovy_nezateplene_netesnici_material_velka_potreba_tepla.hbjson',
  },


  {
    id: 'hbjson-oblast-ostrava',
    category: 'hbjson',
    name: 'Model oblasti Ostrava',
    description:
      'HBJSON model části Ostravy vygenerovaný z CAD podkladu. Slouží jako příklad reálné zástavby pro PED analýzy.',
    path: '/samples/buildings/Ostrava_hbjson_model_oblasti.hbjson',
  },

  {
    id: 'hbjson-zatepleny-sedlova',
    category: 'hbjson',
    name: 'Zateplený dům se sedlovou střechou',
    description:
      'Dvoupatrový obdélníkový dům se sedlovou střechou tvořenou dvěma nakloněnými plochami. Zateplená obálka.',
    path: '/samples/buildings/dum_zatepleny_2patra_obdelnik_sedlova.hbjson',
  },
  // ── DWG CAD podklady ──
  {
    id: 'dwg-oblast-ostrava',
    category: 'dwg',
    name: 'Oblast Ostrava',
    description:
      'CAD podklad části Ostravy. Slouží jako vstup pro generování HBJSON modelu z reálné zástavby.',
    path: '/samples/buildings/Oblast_Ostrava.dwg',
  },
];