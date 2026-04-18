import type { TourStep } from '../TourOverlay';

type TabKey = 'wind' | 'temperature' | 'sunpath';

/**
 * Kroky průvodce pro scénář EPW analýzy.
 * Vrací jiný seznam podle aktivní záložky a stavu (data nahrána / nenahrána).
 *
 * @param activeTab  Aktuálně vybraná záložka ve výsledcích.
 * @param hasData    Zda jsou již výsledky načtené (location bar existuje).
 */
export const getEpwSteps = (
  activeTab: TabKey,
  hasData: boolean,
): TourStep[] => {
  // Úvodní kroky — zobrazí se vždy, bez ohledu na stav.
  const intro: TourStep[] = [
    {
      selector: '.analysis-header',
      title: 'Analýza EPW dat o počasí',
      body: 'Tento scénář zpracovává EPW soubor s hodinovými klimatickými daty pro celý typický rok — 8 760 řádků měření teploty, větru, slunečního záření a dalších veličin.',
      position: 'bottom',
    },
    {
      selector: '.upload-area',
      title: 'Nahrání EPW souboru',
      body: 'Tady vyber EPW soubor své lokality. Získáš ho z EnergyPlus Weather databáze nebo jako TMYx soubor z nejbližšího meteorologického stanoviště.',
      position: 'bottom',
    },
  ];

  if (!hasData) {
    return intro;
  }

  const common: TourStep[] = [
    ...intro,
    {
      selector: '.sa-loc-bar',
      title: 'Informace o lokalitě',
      body: 'Město, zeměpisné souřadnice a nadmořská výška vytažené z hlavičky EPW souboru.',
    },
    {
      selector: '.sa-tabs',
      title: 'Přepínač pohledů',
      body: 'Tři různé pohledy na stejná klimatická data: vítr, teplota a sluneční dráha.',
    },
  ];

  if (activeTab === 'wind') {
    return [
      ...common,
      {
        selector: '[data-tour="wind-stats"]',
        title: 'Statistiky větru',
        body: 'Roční průměr, maximum, převládající směr a podíl bezvětří.',
      },
      {
        selector: '[data-tour="wind-rose"]',
        title: 'Větrná růžice',
        body: 'Polární diagram ukazuje, odkud vítr nejčastěji vane. Delší výseče znamenají víc hodin v roce, barva uvnitř odpovídá rychlostnímu koši v m/s.',
      },
      {
        selector: '[data-tour="wind-monthly"]',
        title: 'Měsíční průměry rychlosti',
        body: 'Jak se průměrná rychlost větru mění v průběhu roku. Číslo v závorce je nejvyšší naměřená hodinová rychlost v daném měsíci.',
      },
      {
        selector: '[data-tour="wind-beaufort"]',
        title: 'Beaufortova stupnice',
        body: 'Klasifikace větru od bezvětří po vichřici a kolik hodin v roce každá třída zabírá.',
      },
    ];
  }

  if (activeTab === 'temperature') {
    return [
      ...common,
      {
        selector: '.tv-stats',
        title: 'Teplotní statistiky',
        body: 'Roční průměr, extrémy, procento komfortních hodin a ASHRAE klimatická zóna.',
      },
    ];
  }

  return [
    ...common,
    {
      selector: '.sv-diagram-wrap',
      title: 'Diagram sluneční dráhy',
      body: 'Dráha slunce oblohou pro 21. den každého měsíce. Každý oblouk odpovídá jinému měsíci roku.',
    },
  ];
};