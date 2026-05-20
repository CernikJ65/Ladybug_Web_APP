import type { TourStep } from '../TourOverlay';

export const getPedOptimizerSteps = (hasResult: boolean): TourStep[] => {
  const intro: TourStep[] = [
    {
      selector: '.ped-hero h1',
      title: 'Optimalizace oblasti pomocí PV a TČ',
      body:
        'Optimalizační scénář, který na základě zadaného rozpočtu osadí oblast fotovoltaickými panely a tepelnými čerpadly ve třech porovnávaných variantách. První pokrývá oblast pouze fotovoltaickými panely, zbylé dvě k nim navíc doplní tepelné čerpadlo vzduch-voda, případně země-voda. Z roční bilance výroby a spotřeby se pro každou variantu vypočte, zda oblast dosahuje energetické pozitivity.',
      position: 'bottom',
    },
    {
      selector: '.ped-files',
      title: 'Vstupní soubory',
      body:
        'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie oblasti) a EPW (klimatická data lokality).',
      position: 'bottom',
    },
    {
      selector: '.ped-budget',
      title: 'Investiční rozpočet',
      body:
        'Pole stanovuje horní finanční hranici v Kč, do které je možné oblast osadit energetickými agenty. Hodnotu lze upravit šipkami nebo přímým zápisem.',
    },
    {
      selector: '.ped-params-grid',
      title: 'Parametry simulace',
      body:
        'Parametry simulace převzaté z předchozích optimalizačních scénářů. Setpoint vytápění, účinnost fotovoltaických panelů a typ jejich montáže.',
    },
    {
      // Cílí na druhý .ped-params-grid uvnitř PedForm, který má
      // data-tour="ped-costs". Bez tohoto atributu by selector
      // .ped-params-grid trefoval jen ten první (parametry simulace).
      selector: '[data-tour="ped-costs"]',
      title: 'Ceny komponent',
      body:
        'Sekce umožňuje specifikovat pořizovací cenu jednotlivých energetických agentů.',
    },
    {
      selector: '.ped-run',
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
      selector: '.ped-info-strip',
      title: 'Informační pruh',
      body:
        'Pruh uvádí název lokality načtené z hlavičky EPW souboru, počet místností a celkovou podlahovou plochu rozpoznané budovy, maximální počet panelů, jež by se vešly na její střechy, a zadaný investiční rozpočet.',
    },
    {
      selector: '.ped-variants',
      title: 'Přehledové karty variant',
      body:
        'Přehledové karty poskytují stručný pohled na všechny tři varianty.',
    },
    {
      selector: '[data-tour="ped-consumption"]',
      title: 'Roční spotřeba budovy',
      body:
        'Tabulka rozkládá celkovou roční spotřebu vybrané varianty na její dílčí složky.',
    },
    {
      selector: '[data-tour="ped-monthly"]',
      title: 'Měsíční bilance',
      body:
        'Tabulka uvádí pro každý měsíc kalendářního roku spotřebu budovy, výrobu fotovoltaických panelů a jejich výslednou bilanci. Tento pohled umožňuje odhalit období, ve kterých některý z energetických agentů ztrácí na účinnosti, a otevírá tak prostor pro hledání alternativních řešení pro tato období.',
    },
  ];
};