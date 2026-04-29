import type { TourStep } from '../TourOverlay';

/**
 * Kroky průvodce pro scénář Solární analýzy (FV optimalizace).
 * Vrací jiný seznam podle stavu (výsledky načtené / nenačtené).
 *
 * @param hasResult  Zda jsou již výsledky optimalizace načtené (info strip existuje).
 */
export const getSolarAdvancedSteps = (hasResult: boolean): TourStep[] => {
  // Úvodní kroky — zobrazí se vždy, bez ohledu na stav.
  const intro: TourStep[] = [
    {
      selector: '.saa-hero h1',
      title: 'Solární analýza',
      body: 'Tento scénář navrhne rozmístění fotovoltaických panelů na střechách modelu. Algoritmus vybere vhodné plochy podle sklonu, spočte ozáření z hodinových EPW dat a vrátí varianty s odhadem roční výroby.',
      position: 'bottom',
    },
    {
      selector: '.saa-upload-grid',
      title: 'Vstupní soubory',
      body: 'HBJSON popisuje geometrii budov a střech. EPW dodává hodinová klimatická data pro danou lokalitu. Bez obou souborů algoritmus nelze spustit.',
      position: 'bottom',
    },
    {
      selector: '.saa-stepper',
      title: 'Počet panelů',
      body: 'Cílový počet panelů, kolem nějž algoritmus vygeneruje sadu variant. Hodnotu lze upravit šipkami nebo přímým zápisem.',
    },
    {
      selector: '.saa-params',
      title: 'Pokročilé parametry',
      body: 'Účinnost FV modulů, maximální přípustný sklon střechy, typ modulu (Standard, Premium, tenkovrstvý) a způsob montáže. Výchozí hodnoty odpovídají běžnému polykrystalickému modulu na volném stojanu.',
    },
    {
      selector: '.saa-run',
      title: 'Spuštění optimalizace',
      body: 'Po stisknutí tohoto tlačítka backend přečte HBJSON, vyfiltruje vhodné střešní plochy a v EnergyPlus PVWatts spočte roční výrobu pro každou variantu.',
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
      body: 'Lokalita z hlavičky EPW, počet rozpoznaných střech, jejich celková plocha a maximální možný počet panelů, který by se na ně vešel.',
    },
    {
      selector: '.saa-kpi-row',
      title: 'Hlavní metriky',
      body: 'Roční výroba v kWh, instalovaný výkon v kWp, plocha pokrytá panely a průměrný solární potenciál v kWh/m².',
    },
    {
      selector: '.saa-detail-grid',
      title: 'Parametry a mapa rozmístění',
      body: 'Vlevo souhrn konfigurace (typ modulu, montáž, sklon, azimut). Vpravo schematická mapa rozmístění panelů na jednotlivých střechách s barevnou škálou solárního potenciálu.',
    },
    {
      selector: '.saa-table',
      title: 'Detail jednotlivých panelů',
      body: 'Tabulka všech panelů seřazená podle roční výroby. U každého panelu vidíte plochu, sklon, azimut, ozáření a odhad výroby.',
    },
  ];
};