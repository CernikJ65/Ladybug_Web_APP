import type { TourStep } from '../TourOverlay';

export const getHeatpumpRealSteps = (hasResult: boolean): TourStep[] => {
  const intro: TourStep[] = [
    {
      selector: '.hp-hero h1',
      title: 'Potenciál tepelných čerpadel',
      body:
        'Optimalizační scénář, který umisťuje do zón vyznačených v HBJSON datech tepelná čerpadla a počítá jejich potenciál. Zároveň porovnává dva druhy čerpadel, vzduch-voda (ASHP) a země-voda (GSHP), proto se simulace interně spouští dvakrát.',
      position: 'bottom',
    },
    {
      selector: '.hp-files',
      title: 'Vstupní soubory',
      body:
        'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie budovy) a EPW (klimatická data lokality).',
      position: 'bottom',
    },
    {
      selector: '.hp-type-grid',
      title: 'Typ budovy',
      body:
        'Sekce umožňuje budovám z HBJSON dat přiřadit jeden ze šesti dostupných typů. Volba typu určuje, která šablona energetického chování převzatá z Ladybug Tools bude budově přiřazena. Šablona reprezentuje typická vnitřní zatížení daného druhu budovy.',
    },
    {
      selector: '.hp-mode-seg',
      title: 'Režim simulace',
      body:
        'Přepínač rozhoduje, zda bude simulace zahrnovat pouze vytápění místností, nebo také jejich chlazení.',
    },
    {
      selector: '.hp-params-grid',
      title: 'Setpointy a rekuperace',
      body:
        'Posuvník Setpoint vytápění určuje cílovou teplotu, kterou má tepelné čerpadlo v zónách budovy během simulace udržovat. ',
    },
    {
      selector: '.hp-run',
      title: 'Spuštění simulace',
      body:
        'Tlačítko pro spuštění simulace.',
    },
  ];

  if (!hasResult) {
    return intro;
  }

  return [
    ...intro,
    {
      selector: '.hp-overview-card',
      title: 'Místnosti budovy',
      body:
        'Karta uvádí seznam všech místností rozpoznaných v HBJSON datech společně s jejich rozměry. Tyto místnosti v simulaci vystupují jako zóny vytápění, jejichž teplotu se tepelná čerpadla snaží po celý rok udržet na zadaných hodnotách.',
    },
    {
      // Cílí na root section komponenty HPRealDemand, který má data-tour="hp-demand".
      // Předchozí selector '.hp-kpi-row' matchoval jen řádek KPI karet, takže
      // spotlight zachycoval pouze horní část a měsíční graf zůstával mimo.
      selector: '[data-tour="hp-demand"]',
      title: 'Tepelná potřeba budovy',
      body:
        'Sekce shrnuje, kolik tepla bylo potřeba do budovy dodat během jednoho simulovaného roku. Souhrnnou roční hodnotu v kWh doplňuje sloupcový graf, který tuto potřebu rozkládá na jednotlivé měsíce.',
    },
    {
      selector: '.hp-compare-wrap',
      title: 'Porovnání tepelných čerpadel',
      body:
        'Závěrečná část scénáře nabízí tři pohledy na simulaci uspořádané do samostatných záložek, mezi nimiž lze libovolně přepínat. Úvodní záložka Porovnání poskytuje agregovaný přehled klíčových metrik obou čerpadel, jako jsou hodnota COP nebo celková roční spotřeba elektřiny. Zbylé dvě záložky nabízejí detailnější pohled na každé čerpadlo zvlášť, doplněný například o měsíční graf dodaného tepla či rozpis výroby podle potřeb jednotlivých místností.',
    },
  ];
};