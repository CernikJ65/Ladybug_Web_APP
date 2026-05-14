import type { TourStep } from '../TourOverlay';

export const getHeatpumpRealSteps = (hasResult: boolean): TourStep[] => {
  const intro: TourStep[] = [
    {
      selector: '.hp-hero h1',
      title: 'Potenciál tepelných čerpadel',
      body: 'Tento scénář umisťuje do zón vyznačených v HBJSON datech tepelná čerpadla a pomocí EnergyPlus počítá jejich roční spotřebu. Současně porovná dva typy — vzduch-voda (ASHP) a země-voda (GSHP), proto se simulace interně spouští dvakrát.',
      position: 'bottom',
    },
    {
      selector: '.hp-files',
      title: 'Vstupní soubory',
      body: 'HBJSON popisuje geometrii budovy a její zóny. EPW dodává hodinová klimatická data pro celý simulovaný rok. Bez obou souborů simulace nelze spustit.',
      position: 'bottom',
    },
    {
      selector: '.hp-type-grid',
      title: 'Typ budovy',
      body: 'Volba typu budovy určuje výchozí program provozu — ventilaci a vnitřní zisky (obsazenost, osvětlení, spotřebiče). Tyto profily se přebírají z Ladybug knihovny dle vybraného typu.',
    },
    {
      selector: '.hp-mode-seg',
      title: 'Režim simulace',
      body: 'Zvolte, zda se má simulovat pouze vytápění, nebo i chlazení v letních měsících. Pouze vytápění zrychlí simulaci a hodí se pro čistě otopné scénáře.',
    },
    {
      selector: '.hp-params-grid',
      title: 'Setpointy a rekuperace',
      body: 'Teplota vytápění a chlazení určuje hranice komfortní zóny, na které čerpadlo reaguje. Rekuperace (ERV) snižuje ztráty větráním — 0 % znamená bez ventilace, vyšší hodnota znamená vyšší účinnost zpětného získávání tepla.',
    },
    {
      selector: '.hp-run',
      title: 'Spuštění simulace',
      body: 'Tlačítko spustí EnergyPlus dvakrát za sebou — jednou s ASHP a jednou s GSHP. Kvůli tomu může simulace trvat několik desítek vteřin až minut podle velikosti modelu.',
    },
  ];

  if (!hasResult) {
    return intro;
  }

  return [
    ...intro,
    {
      selector: '.hp-overview-card',
      title: 'Přehled budovy',
      body: 'Souhrn rozpoznané geometrie — počet místností a celková plocha. Pod tím je seznam jednotlivých zón s jejich rozměry a plochami, které vstoupily do simulace.',
    },
    {
      selector: '.hp-kpi-row',
      title: 'Tepelná potřeba budovy',
      body: 'Roční spotřeba na vytápění a (volitelně) chlazení v kWh, vypočtená přímo z EnergyPlus. Tato hodnota je vstupem pro porovnání obou typů čerpadel.',
    },
    {
      selector: '.hp-compare-wrap',
      title: 'Porovnání ASHP vs. GSHP',
      body: 'Karta porovnává oba typy čerpadel — vzduch-voda (ASHP) a země-voda (GSHP). Přepínačem nahoře vybíráte, který typ se má zobrazit jako primární. U každého vidíte roční spotřebu elektřiny, sezónní COP a rozdíl oproti druhé variantě.',
    },
  ];
};
