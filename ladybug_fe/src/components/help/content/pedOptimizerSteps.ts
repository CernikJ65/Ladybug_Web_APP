import type { TourStep } from '../TourOverlay';

export const getPedOptimizerSteps = (hasResult: boolean): TourStep[] => {
  const intro: TourStep[] = [
    {
      selector: '.ped-hero h1',
      title: 'PED optimalizátor',
      body: 'Tento scénář porovnává tři investiční varianty (FVE samotná, FVE + ASHP a FVE + GSHP) v rámci zadaného rozpočtu. Cílem je dosáhnout celoroční energetické bilance budovy (Positive Energy District).',
      position: 'bottom',
    },
    {
      selector: '.ped-upload-grid',
      title: 'Vstupní soubory',
      body: 'HBJSON popisuje geometrii budovy a střech. EPW dodává hodinová klimatická data pro danou lokalitu. Bez obou souborů algoritmus nelze spustit.',
      position: 'bottom',
    },
    {
      selector: '.ped-budget',
      title: 'Investiční rozpočet',
      body: 'Celkový strop investice v Kč. Algoritmus se snaží zvolit takovou kombinaci tepelného čerpadla a počtu FV panelů, aby se vešla do tohoto rozpočtu a zároveň pokryla co nejvíc spotřeby budovy.',
    },
    {
      selector: '.ped-field-grid--params',
      title: 'Parametry simulace',
      body: 'Teplota vytápění (setpoint pro EnergyPlus), účinnost FV modulů a způsob montáže. Tyto hodnoty ovlivňují jak spotřebu budovy, tak výrobu z FVE.',
    },
    {
      selector: '.ped-card--costs',
      title: 'Ceny komponent',
      body: 'Investiční náklady tepelných čerpadel (ASHP — vzduch/voda, GSHP — země/voda) a cena za jeden FV panel. Z těchto cen se počítá, kolik panelů a jaké TČ se vejde do rozpočtu.',
    },
    {
      selector: '.ped-run',
      title: 'Spuštění analýzy',
      body: 'Po stisknutí backend načte HBJSON, přes Radiance + pvlib spočte výrobu FVE pro každou variantu a v EnergyPlus odsimuluje roční chod budovy s daným tepelným čerpadlem.',
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
      body: 'Lokalita z hlavičky EPW, počet místností a podlahová plocha modelu, maximální možný počet panelů na střechách a zadaný rozpočet.',
    },
    {
      selector: '.ped-variants',
      title: 'Tři varianty',
      body: 'Karty tří investičních scénářů. U každé vidíte roční bilanci (výroba − spotřeba), počet panelů, výrobu, spotřebu a celkovou investici. Kliknutím variantu vyberete a zobrazí se její detail níže.',
    },
    {
      selector: '.ped-section-title',
      title: 'Detail vybrané varianty',
      body: 'Pod kartami se pro vybranou variantu zobrazí výkonnostní ukazatele tepelného čerpadla (COP, SCOP), roční rozklad spotřeby budovy a měsíční bilance výroby a spotřeby.',
    },
  ];
};
