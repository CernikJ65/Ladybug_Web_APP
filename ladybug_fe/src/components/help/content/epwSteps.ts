import type { TourStep } from '../TourOverlay';

type TabKey = 'wind' | 'temperature' | 'sunpath';

/**
 * Kroky průvodce pro scénář Analýza EPW dat o počasí.
 * Vrací jiný seznam podle aktivní záložky a stavu (data nahrána / nenahrána).
 *
 * @param activeTab  Aktuálně vybraná záložka ve výsledcích.
 * @param hasData    Zda jsou již výsledky načtené (location bar existuje).
 */
export const getEpwSteps = (
  activeTab: TabKey,
  hasData: boolean,
): TourStep[] => {
  // Úvodní kroky se zobrazují vždy, bez ohledu na stav.
  const intro: TourStep[] = [
    {
      selector: '.analysis-header',
      title: 'Analýza EPW dat o počasí',
      body:
        'Scénář umožňuje analyzovat klimatická EPW data o počasí pro danou lokalitu. Po dokončení analýzy aplikace poskytne 3 různé pohledy na data pomocí tří záložek: vítr, teplota a sluneční dráha.',
      position: 'bottom',
    },
    {
      selector: '.upload-area',
      title: 'Nahrání EPW souboru',
      body:
        'Vstupní pole, prostřednictvím něhož uživatel může nahrát EPW soubor. Stačí na něj kliknout a v následně otevřeném dialogovém okně vybrat patřičný soubor z lokálního úložiště.',
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
      body:
        'Pruh uvádí název města, zeměpisné souřadnice a nadmořskou výšku načtené z hlavičky EPW souboru.',
    },
    {
      selector: '.sa-tabs',
      title: 'Lišta záložek',
      body:
        'Lišta zpřístupňuje tři pohledy na stejná klimatická data. Mezi záložkami Vítr, Teplota a Sluneční dráha lze libovolně přepínat.',
    },
  ];

  if (activeTab === 'wind') {
    return [
      ...common,
      {
        selector: '[data-tour="wind-stats"]',
        title: 'Souhrnné statistiky větrných charakteristik',
        body:
          'Čtveřice karet shrnuje větrné podmínky lokality pomocí 4 charakteristik: průměrá roční rychlost, maximalní rychlsot , převládající směr a podíl bezvětří. Rychlosti jsou uváděny v metrech za sekundu.',
      },
      {
        selector: '[data-tour="wind-rose"]',
        title: 'Větrná růžice',
        body:
          'Polární graf zobrazuje, odkud a jak často vítr v lokalitě vane.',
      },
      {
        selector: '[data-tour="wind-monthly"]',
        title: 'Průměrné měsíční rychlosti',
        body:
          'Sloupcový graf ukazuje průměrnou rychlost větru pro každý měsíc v roce. U každého sloupce je vedle průměru uvedeno také měsíční maximum.',
      },
      {
        selector: '[data-tour="wind-beaufort"]',
        title: 'Beaufortova stupnice',
        body:
          'Rozložení rychlostí větru klasifikované podle Beaufortovy stupnice, od bezvětří po vichřici. U každé třídy je uveden počet hodin v roce, kdy panuje určitý stav',
      },
    ];
  }

  if (activeTab === 'temperature') {
    return [
      ...common,
      {
        selector: '.tv-stats',
        title: 'Souhrnné teplotní statistiky',
        body:
          'Šestice karet shrnuje teplotní poměry lokality. Patří sem roční průměr, Teplotní extrémy, podíl komfortních hodin v rozmezí 18 až 26 °C, počet mrazivých hodin a klasifikace klimatické zóny podle normy ASHRAE 169.',
      },
      {
        selector: '.tv-table-wrap',
        title: 'Měsíční teplotní profil',
        body:
          'Tabulka popisující měsíční teplotní profil dané lokality. Každý řádek odpovídá jednomu kalendářnímu měsíci a uvádí jeho minimální, průměrnou a maximální teplotu, doplněnou o celkové teplotní rozpětí. Minimální a maximální hodnoty navíc jsou uváděny ve formě percentilů P5 a P95, čímž se omezuje vliv ojedinělých extrémů.',
      },
      {
        selector: '.tv-dd-summary',
        title: 'Topné a chladicí denostupně',
        body:
          'Ukazatele HDD a CDD vyjadřují, jak výrazně a jak dlouho se venkovní teplota odchyluje od prahu pro vytápění (18 °C) a chlazení (21 °C). Roční součet poskytuje představu o potřebě vytápění a chlazení v lokalitě.',
      },
      {
        selector: '.tv-bars',
        title: 'Rozložení denostupňů v roce',
        body:
          'Sloupcový graf rozkládá roční hodnoty HDD a CDD do jednotlivých měsíců. Modré sloupce odpovídají topným denostupňům, červené chladicím.',
      },
      {
        selector: '.tv-heatmap-wrap',
        title: 'Teplotní heatmapa',
        body:
          'Heatmapa zachycuje průměrnou teplotu pro každou kombinaci měsíce a hodiny dne. Modrá značí chladnější hodnoty, červená teplejší.',
      },
    ];
  }

  return [
    ...common,
    {
      selector: '.sv-diagram-wrap',
      title: 'Pozice slunce nad obzorem',
      body:
        'Graf zachycuje výšku slunce nad obzorem pro 21. den každého měsíce. Volba 21. dne není náhodná, jelikož se blíží slunovratům a rovnodennostem. Hodnota 0° na svislé ose odpovídá horizontu, 90° poloze v nadhlavníku. Ve střední Evropě slunce dosahuje maximální výšky okolo 64°.',
    },
    {
      selector: '.tv-table-wrap',
      title: 'Východ, západ a délka dne',
      body:
        'Pro 21. den každého měsíce tabulka uvádí čas východu a západu slunce, výslednou délku dne a maximální výšku slunce nad obzorem.',
    },
    {
      selector: '.tv-bars',
      title: 'Délka dne v průběhu roku',
      body:
        'Horizontální sloupcový graf porovnává délku 21. dne v jednotlivých měsících.',
    },
  ];
};