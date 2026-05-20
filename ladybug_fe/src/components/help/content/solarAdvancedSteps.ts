import type { TourStep } from '../TourOverlay';

/**
 * Kroky průvodce pro scénář Solární analýza.
 * Vrací jiný seznam podle stavu (výsledky načtené / nenačtené).
 *
 * @param hasResult  Zda jsou již výsledky simulace načtené.
 */
export const getSolarAdvancedSteps = (hasResult: boolean): TourStep[] => {
  // Úvodní kroky se zobrazují vždy, bez ohledu na stav.
  const intro: TourStep[] = [
    {
      selector: '.saa-hero h1',
      title: 'Solární analýza',
      body:
        'Optimalizační scénář, který rozmístí solární panely na střechy identifikované ve vstupních HBJSON datech, a to v nejvyšším počtu, jaký geometrie střech, jejich sklon a orientace dovolují. Pro panely se následně vypočítá solární potenciál a odhadne potenciální roční výroby elektrické energie a vrátí se ty nejlepší.',
      position: 'bottom',
    },
    {
      selector: '.saa-upload-grid',
      title: 'Vstupní soubory',
      body:
        'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie obalsti) a EPW  (klimatické data lokality.',
      position: 'bottom',
    },
    {
      selector: '.saa-stepper',
      title: 'Počet panelů',
      body:
        'Pole určuje, kolik panelů s největším potenciálem výroby se uživateli zobrazí ve výsledcích. Hodnotu lze upravit šipkami nebo přímým zápisem.',
    },
    {
      selector: '.saa-params',
      title: 'Pokročilé parametry',
      body:
        'Rozbalovací sekce s dalšími parametry simulace. Účinnost panelu udává, jaký podíl dopadajícího slunečního záření se převede na elektrickou energii. Maximální sklon střechy slouží jako filtr ploch, které se mají do simulace zahrnout. Typ montáže rozlišuje mezi otevřenou konstrukci od střešní montáže.',
    },
    {
      selector: '.saa-run',
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
      selector: '.saa-info-strip',
      title: 'Informační pruh',
      body:
        'Pruh s identifikací lokality načtené z hlavičky EPW souboru, počtem rozpoznaných střech, jejich celkovou plochou a maximálním počtem panelů, jež by se na ně vešly.',
    },
    {
      selector: '.saa-kpi-row',
      title: 'Souhrnné statistiky',
      body:
        'Charakteristiky vybrané skupiny solárních panelů. Roční výroba udává odhadovanou produkci elektrické energie, instalovaný výkon, celkovou rozlohu panelů na střechách a průměrný solární potenciál na jeden metr čtvereční vybraných panelů.',
    },
    {
      selector: '.saa-detail-grid > .saa-card',
      title: 'Parametry panelů',
      body:
        'Karta shrnuje parametry solárních panelů použitých v simulaci. Obsahuje například rozměry panelu,účinnost, typ montáže nebo celkové ztráty systému. Rozkliknutím Celkových ztrát se zobrazí jejich podrobný rozpis.',
    },
    {
      // Cílí na root div komponenty PanelMapView, který má data-tour="panel-map".
      // Předchozí selector '.pmap-wrap' nematchoval, protože root PanelMapView
      // používá pouze inline styly bez className.
      selector: '[data-tour="panel-map"]',
      title: 'Rozmístění solárních panelů',
      body:
        '2D vizualizace střešních ploch z HBJSON dat společně s rozmístěním panelů, jež ze simulace vzešly jako ty s nejvyšším potenciálem výroby. Pro každou střechu vzniká samostatná karta. Při najetí kurzorem na konkrétní panel se zobrazí jeho atributy, například potenciál roční výroby nebo jeho souřadnice  na střeše.',
    },
    {
      selector: '.saa-table-wrap',
      title: 'Detail jednotlivých panelů',
      body:
        'Tabulka s informacemi o všech vybraných panelech, seřazená podle potenciálu roční výroby. U každého panelu je uvedena plocha, optimální sklon určený simulací a směr orientace. Závěr tvoří energetické parametry: roční solární potenciál, odhadovaná výroba a instalovaný výkon.',
    },
  ];
};