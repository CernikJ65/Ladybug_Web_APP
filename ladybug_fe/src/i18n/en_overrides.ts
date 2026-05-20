const en_overrides: Record<string, string> = {
  // ── Landing / Features ─────────────────────────────────────────────
  '3D Vizualizace HBJSON': '3D HBJSON Visualization',
  'Vizualizujte HBJSON oblasti pomocí interaktivní 3D vizualizace.':
    'Visualize HBJSON areas with an interactive 3D viewer.',
  'Analýza EPW dat o počasí': 'EPW Weather Data Analysis',
  'Analyzujte EPW data o počasí, směr větru, větrná růžice, teplota, sluneční dráha.':
      'Analyze EPW weather data, wind direction, wind rose, temperature, sun path.',
  'Solární analýza': 'Solar Analysis',
  'Vypočet potenciálu solární energie pro FVE, roční výroba, orientace, umístění panelů.':
    'PV solar potential calculation: annual production, orientation, panel placement.',
  'Potenciál tepelných čerpadel': 'Heat Pump Potential',
  'Scénář simuluje potenciál výroby tepla, a chladu tepelných čerpadel a zároveň porovnává dva typy: vzduch-voda (ASHP) a země-voda (GSHP)':
    'A scenario simulating the heating and cooling production potential of heat pumps while comparing two types: air-to-water (ASHP) and ground-to-water (GSHP).',
  'Optimalizace Oblasti pomocí PV a TČ': 'Area Optimization with PV and HP',
  'Uživatel zadá investiční rozpočet a v rámci zadaného rozpočtu simulace osadí oblast energetickými agenty třemi způsoby. ':
    'The user enters an investment budget; within that budget the simulation populates the area with energy agents in three different ways.',
  'Uživatel zadá investiční rozpočet a v rámci zadaného rozpočtu simulace osadí oblast energetickými agenty třemi způsoby. Cílem je dosáhnout celoroční energetické bilance budovy.':
    'The user enters an investment budget; within that budget the simulation populates the area with energy agents in three different ways. The goal is to achieve a year-round energy balance for the building.',
  'Převeďte CAD soubory na Honeybee modely. Automatická extrakce budov a terénu.':
    'Convert CAD files into Honeybee models. Automatic extraction of buildings and terrain.',
  'Analytické scénáře': 'Analysis Scenarios',

  // ── Landing / AboutProject ────────────────────────────────────────
  'O projektu': 'About the project',
  'Tento projekt vznikl jako součást <strong>diplomové práce</strong> na <strong>Ostravské univerzitě</strong> v rámci programu <strong>STENEO</strong>, který se zaměřuje na výzkum a vývoj pozitivně energetických čtvrtí (Positive Energy Districts).':
    'This project was created as part of a <strong>master\'s thesis</strong> at the <strong>University of Ostrava</strong> within the <strong>STENEO</strong> programme, which focuses on the research and development of Positive Energy Districts.',
  'Cílem je <strong>zpřístupnit pokročilé nástroje Ladybug Tools</strong> širší veřejnosti bez nutnosti instalace, programování nebo složitého nastavení. Pomocí této webové platformy můžete provádět energetické analýzy budov, simulace slunečního záření, větrání a mnoho dalšího přímo ve vašem prohlížeči.':
    'The goal is to <strong>make the advanced Ladybug Tools accessible</strong> to a wider audience without the need to install anything, code, or configure complex settings. With this web platform you can perform building energy analyses, solar radiation and ventilation simulations, and much more, straight from your browser.',
  'Platforma spojuje <strong>React frontend</strong> s výkonným <strong>FastAPI backendem</strong> a využívá Ladybug Tools knihovny pro přesné výpočty a vizualizace. Vše je navrženo s důrazem na uživatelskou přívětivost a dostupnost pro architekty, inženýry i studenty.':
    'The platform combines a <strong>React frontend</strong> with a powerful <strong>FastAPI backend</strong> and uses the Ladybug Tools libraries for accurate calculations and visualizations. Everything is designed with a focus on usability and accessibility for architects, engineers, and students.',

  // ── Landing / CallToAction ────────────────────────────────────────
  'Připraveni začít?': 'Ready to start?',
  'Vyzkoušejte sílu Ladybug Tools bez nutnosti instalace či programování':
    'Try the power of Ladybug Tools. No installation, no coding required.',
  'Spustit aplikaci': 'Launch app',

  // ── Landing / Footer ──────────────────────────────────────────────
  '© 2026 PED Ladybug Web Tools - Diplomová práce':
    '© 2026 PED Ladybug Web Tools · Master\'s thesis',
  'Postaveno na FastAPI & React': 'Built on FastAPI & React',

  // ── App.tsx ───────────────────────────────────────────────────────
  'Funkce "{{id}}" bude brzy dostupná!': 'Feature "{{id}}" will be available soon!',

  // ── Common ────────────────────────────────────────────────────────
  'Simulace probíhá': 'Simulation in progress',
  'Zpět': 'Back',
  'Zpět na přehled': 'Back to overview',
  'Neznámá chyba': 'Unknown error',
  'Chyba': 'Error',
  'Chyba serveru': 'Server error',
  'Chyba při načítání: ': 'Loading error: ',
  'Skrýt': 'Hide',
  'Zobrazit': 'Show',
  'Změnit': 'Change',
  'Změnit soubor': 'Change file',
  'Odstranit soubor': 'Remove file',
  'Odebrat soubor': 'Remove file',
  'Sbalit': 'Collapse',
  'Celkem': 'Total',
  'Plocha': 'Area',
  'Měsíc': 'Month',

  'Místnosti': 'Rooms',
  'Východ': 'East',
  'Západ': 'West',

  // ── Converter ─────────────────────────────────────────────────────
  'Podporované formáty: .dwg, .dxf': 'Supported formats: .dwg, .dxf',
  'Převod DWG formátu na HBJSON': 'DWG → HBJSON conversion',
  'Konverze probíhá…': 'Converting…',
  'DWG → DXF → ladybug_geometry → Honeybee HBJSON':
    'DWG → DXF → ladybug_geometry → Honeybee HBJSON',
  'Převod proběhl úspěšně': 'Conversion successful',
  'Honeybee model je připraven ke stažení a lze jej použít v dalších energetických analýzách.':
    'The Honeybee model is ready to download and can be used in further energy analyses.',
  'Stáhnout HBJSON': 'Download HBJSON',
  'Nová konverze': 'New conversion',
  'Nahrát CAD soubor': 'Upload CAD file',
  'Vlože soubor fomátu DWG': 'Insert a DWG file',
  'Soubor vybrán': 'File selected',
  'Přetáhněte soubor sem': 'Drag the file here',
  'nebo klikněte pro výběr · .dwg': 'or click to select · .dwg',
  'Konvertovat na HBJSON': 'Convert to HBJSON',

  // ── HBJSON Viewer ─────────────────────────────────────────────────
  'Skrýt panel': 'Hide panel',
  'Zobrazit panel': 'Show panel',
  'Načítám model…': 'Loading model…',
  'Načíst HBJSON soubor': 'Load HBJSON file',
  'Pohled': 'View',
  'Průhlednost': 'Opacity',
  'Zrušit výběr': 'Clear selection',
  'Export': 'Export',
  'Mřížka': 'Grid',
  'Hover': 'Hover',
  'Vybraná budova': 'Selected building',
  'Výběr: {{n}} budov': 'Selection: {{n}} buildings',
  'Vybraná místnost': 'Selected room',
  'Výběr: {{n}} místností': 'Selection: {{n}} rooms',
  'Název:': 'Name:',
  'Ploch:': 'Surfaces:',
  'Výška:': 'Height:',
  'Rozměr střechy:': 'Roof dimensions:',
  'Místností:': 'Rooms:',
  'Budov:': 'Buildings:',
  'Model:': 'Model:',
  'Terén:': 'Terrain:',
  'Rozměr:': 'Size:',
  '…a dalších {{n}}': '…and {{n}} more',
  'Ovládání': 'Controls',
  'Klik = výběr': 'Click = select',
  'budovy': 'buildings',
  'místnosti': 'rooms',
  'Ctrl+klik = přidat do výběru': 'Ctrl+click = add to selection',
  'Shift + tažení = box select': 'Shift + drag = box select',
  'Tažení = rotace · Pravé tl. = posuv · Kolečko = zoom':
    'Drag = rotate · Right button = pan · Wheel = zoom',
  'Šipky / WASD = pohyb · R = reset · Esc = zrušit':
    'Arrows / WASD = move · R = reset · Esc = cancel',

  // ── Solar / PanelMapView ──────────────────────────────────────────
  'panel': 'panel',
  'panely': 'panels',
  'panelů': 'panels',
  'plochá střecha': 'flat roof',
  'sklon {{tilt}}°, orientace na {{ori}}':
    'tilt {{tilt}}°, oriented {{ori}}',
  'výroba': 'production',
  'rok': 'year',
  'Solární potenciál': 'Solar potential',
  'Roční výroba': 'Annual production',
  'S': 'N',
  'J': 'S',
  'V': 'E',
  'Z': 'W',
  'SV': 'NE',
  'JV': 'SE',
  'JZ': 'SW',
  'SZ': 'NW',
  'sever': 'north',
  'severovýchod': 'northeast',
  'východ': 'east',
  'jihovýchod': 'southeast',
  'jih': 'south',
  'jihozápad': 'southwest',
  'západ': 'west',
  'severozápad': 'northwest',
  'vodorovně': 'horizontal',
  'Rozmístění panelů': 'Panel layout',
  'na': 'on',
  'střeše': 'roof',
  'střechách': 'roofs',
  'celková roční výroba': 'total annual production',
  'střechu': 'roof',
  'střechy': 'roofs',
  'střech': 'roofs',
  'další střechu': 'more roof',
  'další střechy': 'more roofs',
  'dalších střech': 'more roofs',

  // ── Solar / SolarAnalysis ─────────────────────────────────────────
  'Vyberte EPW soubor': 'Select an EPW file',
  'Nahrajte EPW soubor, pro provedení analýzy větru, teploty a sluneční dráhy':
    'Upload an EPW file to run wind, temperature, and sun-path analyses.',
  'Klikněte pro výběr EPW souboru': 'Click to select an EPW file',
  'Analyzuji…': 'Analyzing…',
  'Spustit analýzu': 'Run analysis',
  'Vítr': 'Wind',
  'Teplota': 'Temperature',
  'Sluneční dráha': 'Sun path',
  'Načítám data…': 'Loading data…',

  // ── Solar / SolarAnalysisAdvanced ─────────────────────────────────
  'Otevřená konstrukce': 'Open rack',
  'Střešní montáž': 'Roof-mounted',
  'Vyberte oba soubory': 'Select both files',
  'Scénar, který na základě EPW a HBJSON dat simuluje solární potenciál dopadu slunečního zářeni na panely a na základě toto následně similuje kolik je panel schopen produkovat .':
    'A scenario that uses EPW and HBJSON data to simulate the solar potential of irradiation hitting the panels and then simulates how much each panel can produce.',
  'Vstupní soubory': 'Input files',
  'Nahrajte model budovy a klimatická data': 'Upload the building model and weather data',
  'HBJSON model': 'HBJSON model',
  'Geometrie budovy (.hbjson)': 'Building geometry (.hbjson)',
  'EPW soubor': 'EPW file',
  'Klimatická data (.epw)': 'Weather data (.epw)',
  'Konfigurace simulace': 'Simulation configuration',
  'Počet panelů a parametry simulace': 'Panel count and simulation parameters',
  'Počet panelů': 'Number of panels',
  'Pokročilé parametry': 'Advanced parameters',
  'Účinnost panelu': 'Panel efficiency',
  'Maximální sklon střechy': 'Maximum roof tilt',
  'Plochy nad tímto sklonem se přeskočí': 'Surfaces above this tilt are skipped',
  'Typ montáže': 'Mount type',
  'Počítám pvlib + Radiance…': 'Running pvlib + Radiance…',
  'Spustit optimalizaci': 'Run optimization',
  'Chyba:': 'Error:',
  'střecha': 'roof',
  'ploch': 'surfaces',
  'Max': 'Max',
  'Instalovaný výkon': 'Installed capacity',
  'Plocha panelů': 'Panel area',
  'Parametry panelů': 'Panel parameters',
  'Konfigurace FV instalace': 'PV installation configuration',
  'Účinnost FV': 'PV efficiency',
  'Rozměry panelu': 'Panel dimensions',
  'Plocha panelu': 'Panel area',
  'Aktivní plocha': 'Active area',
  'Mezera mezi panely': 'Gap between panels',
  'Stáří systému': 'System age',
  'let': 'years',
  'Optimální sklon': 'Optimal tilt',
  'Optimální směr natočení': 'Optimal azimuth',
  'Celkové ztráty': 'Total losses',
  'Komponenty systému': 'System components',
  'Degradace stárnutím': 'Aging degradation',
  'Počáteční pokles výkonu (do stabilizace)': 'Initial power drop (until stabilization)',
  'Znečištění panelu': 'Panel soiling',
  'Sníh': 'Snow',
  'Odchylka výrobce': 'Manufacturer tolerance',
  'Nesoulad mezi moduly': 'Module mismatch',
  'Ztráty ve vedení (například kabely)': 'Wiring losses (e.g. cables)',
  'Elektrické konektory (například odpor)': 'Electrical connectors (e.g. resistance)',
  'Dostupnost sítě (výpadky)': 'Grid availability (outages)',
  'Systémové ztráty (dílčí součet)': 'System losses (subtotal)',
  'Panel vyrábí stejnosměrný proud (DC), ale domácnost a síť používají hlavně střídavý proud':
    'The panel produces direct current (DC), but the household and grid mainly use alternating current.',
  'Ztráta při převodu DC/AC': 'DC/AC conversion loss',
  'Celkové ztráty se kombinují multiplikativně, nikoliv prostým součtem.':
    'Total losses combine multiplicatively, not by simple sum.',
  'Detail panelů ({{n}} ks)': 'Panel detail ({{n}} pcs)',
  'Seřazeno dle roční výroby od nejlepšího': 'Sorted by annual production, best first',
  'Střecha': 'Roof',
  'Sklon': 'Tilt',
  'Směr': 'Azimuth',
  'Stíněná POA z Radiance (SkyMatrix ray tracing, stínění od budovy)':
    'Shaded POA from Radiance (SkyMatrix ray tracing, shading from the building)',
  'Sol. pot. (Radiance)': 'Sol. pot. (Radiance)',
  'Výroba': 'Production',

  // ── Solar / SunpathView ───────────────────────────────────────────
  'Pozice slunce 21. dne v měsíci': 'Sun position on the 21st of each month',
  'Hodina dne': 'Hour of day',
  'Výška °': 'Altitude °',
  'Východ a západ slunce a délka dne (21. den v měsíci)':
    'Sunrise / sunset and day length (21st of each month)',
  'Délka dne': 'Day length',
  'Max výška': 'Max altitude',
  'Délka 21. dne v průběhu roku': 'Day length on the 21st throughout the year',

  // ── Solar / TemperatureView ───────────────────────────────────────
  'Průměrná teplota': 'Average temperature',
  'Minimum': 'Minimum',
  'Maximum': 'Maximum',
  'Komfort 18–26 °C': 'Comfort 18–26 °C',
  'Mrazivé hodiny pod nulu': 'Sub-zero hours',
  'ASHRAE zóna': 'ASHRAE zone',
  'Měsíční teplotní profil': 'Monthly temperature profile',
  'Min (P5)': 'Min (P5)',
  'Průměr': 'Average',
  'Max (P95)': 'Max (P95)',
  'Rozpětí': 'Range',
  'Topné a chladicí denostupně': 'Heating and cooling degree days',
  'Čvn': 'Jun',
  'Čvc': 'Jul',
  '← HDD (vytápění)': '← HDD (heating)',
  'CDD (chlazení) →': 'CDD (cooling) →',
  'Typický den — leden vs červenec': 'Typical day: January vs July',
  'Teplotní heatmapa': 'Temperature heatmap',

  // ── Solar / WindView ──────────────────────────────────────────────
  'Průměrná rychlost větru': 'Average wind speed',
  'Maximální rychlost větru': 'Maximum wind speed',
  'Převládající směr větru': 'Prevailing wind direction',
  'Kolik % času tvořilo bezvětří': 'Percentage of time with calm conditions',
  'Větrná růžice': 'Wind rose',
  'Průmerná rychlost větru pro jednotlivé měsíce': 'Average monthly wind speed',
  'max': 'max',
  'Beaufortova stupnice': 'Beaufort scale',

  // ── Heatpump (Analysis + Form + Overview + Section) ──────────────
  'Nahrajte oba soubory — HBJSON i EPW': 'Please upload both files: HBJSON and EPW',
  'Simulace tepelných zátěží, COP analýza a ekonomické porovnání ASHP vs GSHP pro váš projekt':
    'Thermal load simulation, COP analysis, and ASHP vs GSHP economic comparison for your project.',
  'Rezidenční': 'Residential',
  'Rodinné domy, byty': 'Single-family homes, apartments',
  'Kancelářská': 'Office',
  'Kanceláře, coworkingy': 'Offices, coworking spaces',
  'Obchodní': 'Retail',
  'Obchody, nákupní centra': 'Shops, shopping centres',
  'Školní': 'Educational',
  'Školy, univerzity': 'Schools, universities',
  'Hotelová': 'Hotel',
  'Hotely, penziony': 'Hotels, guesthouses',
  'Nemocniční': 'Healthcare',
  'Nemocnice, kliniky': 'Hospitals, clinics',
  'Podlahové vytápění': 'Underfloor heating',
  'Fancoily': 'Fan coils',
  'Radiátory': 'Radiators',
  'HBJSON model budovy': 'HBJSON building model',
  'EPW klimatická data': 'EPW weather data',
  'Soubor .epw': '.epw file',
  'Typ budovy': 'Building type',
  'Topný systém a parametry': 'Heating system and parameters',
  'Setpoint vytápění': 'Heating setpoint',
  'Rekuperace (ZZT)': 'Heat recovery (HRV)',
  'Vypnuto': 'Off',
  'Hloubka kolektoru GSHP': 'GSHP collector depth',
  'Cena elektřiny': 'Electricity price',
  'CO₂ intenzita sítě': 'Grid CO₂ intensity',
  'Simuluji v EnergyPlus…': 'Simulating in EnergyPlus…',
  'Země–voda': 'Ground-to-water',
  'Vzduch–voda': 'Air-to-water',
  'Přehled budovy a klimatu': 'Building and climate overview',
  'Denostupně (base 18 °C)': 'Degree days (base 18 °C)',
  'Mrazové hodiny (< 0 °C)': 'Sub-zero hours (< 0 °C)',
  'ASHRAE klim. zóna': 'ASHRAE climate zone',
  'Podlahová plocha': 'Floor area',
  'Roční tepelná potřeba': 'Annual heat demand',
  'Měrná potřeba tepla': 'Specific heat demand',
  'Porovnání OZE výroby': 'Renewable production comparison',
  '{{system}} vyrobí o {{pct}} % více obnovitelné energie':
    '{{system}} produces {{pct}}% more renewable energy',
  'Vzduch–voda (ASHP)': 'Air-to-water (ASHP)',
  'Země–voda (GSHP)': 'Ground-to-water (GSHP)',
  'Průměrný COP': 'Average COP',
  'Spotřeba el.': 'Electricity use',
  'Roční náklady': 'Annual cost',
  'Úspora CO₂': 'CO₂ savings',
  'Led': 'Jan',
  'Úno': 'Feb',
  'Bře': 'Mar',
  'Dub': 'Apr',
  'Kvě': 'May',
  'Srp': 'Aug',
  'Zář': 'Sep',
  'Říj': 'Oct',
  'Lis': 'Nov',
  'Pro': 'Dec',

  // ── Full month names (BE: temperature, sunpath) ──────────────────
  'Leden': 'January',
  'Únor': 'February',
  'Březen': 'March',
  'Duben': 'April',
  'Květen': 'May',
  'Červen': 'June',
  'Červenec': 'July',
  'Srpen': 'August',
  'Září': 'September',
  'Říjen': 'October',
  'Listopad': 'November',
  'Prosinec': 'December',

  // ── Wind directions (BE: DIR_16) ─────────────────────────────────
  'SSV': 'NNE',
  'VSV': 'ENE',
  'JJV': 'SSE',
  'JJZ': 'SSW',
  'ZJZ': 'WSW',
  'ZSZ': 'WNW',
  'SSZ': 'NNW',

  // ── Beaufort scale labels (BE: BEAUFORT_LABELS) ──────────────────
  '0 Bezvětří': '0 Calm',
  '1 Vánek': '1 Light air',
  '2 Slabý': '2 Light breeze',
  '3 Mírný': '3 Gentle breeze',
  '4 Čerstvý': '4 Moderate breeze',
  '5 Silný': '5 Fresh breeze',
  '6 Prudký': '6 Strong breeze',
  '7 Bouřlivý': '7 Near gale',
  '8+ Vichřice': '8+ Gale',

  // ── Wind speed bins (BE: SP_LABELS) ──────────────────────────────
  'Klid': 'Calm',
  'venkovního vzduchu': 'outside air',
  'zemního tepla': 'ground heat',
  '{{n}} jedn. · {{kwh}} kWh celkové potřeby': '{{n}} units · {{kwh}} kWh total demand',
  'Vyrobeno': 'Produced',
  'z {{src}}': 'from {{src}}',
  'kWh / rok': 'kWh / year',
  'Obnovitelná energie získaná zdarma a dodaná do budovy jako teplo':
    'Renewable energy obtained for free and delivered to the building as heat.',
  'Spotřeba': 'Consumption',
  'elektřiny': 'electricity',
  'Pohon kompresoru · {{cost}} CZK/rok': 'Compressor drive · {{cost}} CZK/year',
  'Roční COP': 'Annual COP',
  'Špičkový výkon': 'Peak capacity',
  'Z 1 kWh elektřiny TČ vyrobí {{cop}} kWh tepla — {{total}} kWh celkové potřeby pokryje s pouhými {{elec}} kWh elektřiny.':
    'From 1 kWh of electricity the heat pump produces {{cop}} kWh of heat, covering {{total}} kWh of demand with just {{elec}} kWh of electricity.',
  'Měsíční obnovitelná výroba': 'Monthly renewable production',
  'Měsíční COP': 'Monthly COP',
  'výrobu per místnost': 'production per room',
  'Místnost': 'Room',
  'OZE (kWh/rok)': 'Renewables (kWh/year)',
  'Simulace tepelných čerpadel': 'Heat pump simulation',
  'Tento scénář umisťuje do zón vyznačených v HBJSON datech tepelná čerpadla a počítá jejich potenciál. Zároveň porovnává dva druhy čerpadel, vzduch-voda (ASHP) a země-voda (GSHP), proto se simulace interně spouští dvakrát.':
    'This scenario places heat pumps into the zones marked in the HBJSON data and calculates their potential. It also compares two pump types: air-to-water (ASHP) and ground-to-water (GSHP), so the simulation internally runs twice.',
  'Topení (kompresor + el. backup)': 'Heating (compressor + electric backup)',
  'Chlazení (chiller / DX)': 'Cooling (chiller / DX)',
  'Ventilátory': 'Fans',
  'Čerpadla': 'Pumps',
  'Chladicí věž': 'Cooling tower',
  'Porovnání': 'Comparison',
  'ASHP Vzduch-voda': 'ASHP Air-to-water',
  'GSHP Země-voda': 'GSHP Ground-to-water',
  'COP topení': 'Heating COP',
  'COP chlazení': 'Cooling COP',
  'COP celoroční': 'Annual COP',
  'Spotřeba elektřiny': 'Electricity consumption',
  'Tepelná potřeba budovy': 'Building heat demand',
  'Potřeba vytápění': 'Heating demand',
  'Chlazení': 'Cooling',
  'Měsíční potřeba': 'Monthly demand',
  '{{mo}}: {{val}} kWh teplo': '{{mo}}: {{val}} kWh heat',
  '{{mo}}: {{val}} kWh chlad': '{{mo}}: {{val}} kWh cooling',
  'Potřeba tepla': 'Heat demand',
  'Potřeba chladu': 'Cooling demand',
  'Byty, domy': 'Apartments, houses',
  'Kanceláře': 'Offices',
  'Obchody': 'Shops',
  'Školy': 'Schools',
  'Hotely': 'Hotels',
  'Nemocnice': 'Hospitals',
  'Vybere jedne z přednsatavenych Ladybug šablon pro simulaci tepelné potřeby budovy.':
    'Select one of the preset Ladybug templates for simulating the building\'s heat demand.',
  'Režim simulace': 'Simulation mode',
  'Vytápění a chlazení': 'Heating and cooling',
  'Pouze vytápění': 'Heating only',
  'Setpointy a rekuperace': 'Setpoints and heat recovery',
  'Setpoint chlazení': 'Cooling setpoint',
  'Rekuperace (ERV)': 'Heat recovery (ERV)',
  'Vyp. (bez ventilace)': 'Off (no ventilation)',
  'Simuluji 2× EnergyPlus…': 'Simulating 2× EnergyPlus…',
  'Spustit celoroční simulaci': 'Run year-round simulation',
  'Místnosti (Zóny vytápění)': 'Rooms (heating zones)',
  'Místnosti a celková podlahová plocha': 'Rooms and total floor area',
  'místností': 'rooms',
  'm² podlahové plochy': 'm² of floor area',
  'Předchozí místnosti': 'Previous rooms',
  'Další místnosti': 'Next rooms',
  'Produkce po místnostech': 'Production by room',
  'Zobrazit všech {{n}}': 'Show all {{n}}',
  'Měsíční produkce': 'Monthly production',
  'Vyrobené teplo': 'Heat produced',
  'Vyrobený chlad': 'Cooling produced',
  'Vyrobí kWh tepla / rok': 'Heat produced kWh / year',
  'kWh el. spotřeba / rok': 'kWh electricity / year',
  'Vyrobí kWh chladu / rok': 'Cooling produced kWh / year',
  'Měsíční COP topení': 'Monthly heating COP',
  'Měsíční COP chlazení': 'Monthly cooling COP',

  // ── PED Optimizer ─────────────────────────────────────────────────
  'Spotřeba TČ': 'HP consumption',
  'HVAC chlazení': 'HVAC cooling',
  'Osvětlení': 'Lighting',
  'Spotřebiče': 'Appliances',
  'El. vytápění': 'Electric heating',
  'Složka spotřeby': 'Consumption component',
  'Spotřeba (kWh)': 'Consumption (kWh)',
  'Podíl': 'Share',
  'Zvýšit o {{step}}': 'Increase by {{step}}',
  'Snížit o {{step}}': 'Decrease by {{step}}',
  'Kč': 'CZK',
  'Zvýšit o 10 000 Kč': 'Increase by 10,000 CZK',
  'Snížit o 10 000 Kč': 'Decrease by 10,000 CZK',
  'Investiční rozpočet': 'Investment budget',
  'Maximální částka, kterou je možné na osazení oblasti vynaložit.':
    'Maximum amount available to populate the area.',
  'Parametry simulace': 'Simulation parameters',
  'Setpoint vytápění, účinnost panelů a typ montáže.':
    'Heating setpoint, panel efficiency, and mount type.',
  'Teplota vytápění': 'Heating temperature',
  'Účinnost FVE': 'PV efficiency',
  'Přilehlá ke střeše': 'Roof-mounted',
  'Ceny komponent': 'Component prices',
  'Investiční náklady jednotlivých prvků v Kč.': 'Investment costs of individual items in CZK.',
  'Čerpadlo ASHP vzduch/voda': 'ASHP air/water pump',
  'Čerpadlo GSHP země/voda': 'GSHP ground/water pump',
  'Cena za panel': 'Price per panel',
  'Probíhá simulace…': 'Simulation in progress…',
  'Spustit PED analýzu': 'Run PED analysis',
  'Dodané teplo do zón': 'Heat delivered to zones',
  'SCOP (sezónní)': 'SCOP (seasonal)',
  'Výroba FVE (kWh)': 'PV production (kWh)',
  'Bilance (kWh)': 'Balance (kWh)',
  'Rok celkem': 'Year total',
  'PED analýza': 'PED analysis',
  'Lokalita': 'Location',
  'Místností': 'Rooms',
  'Max panelů': 'Max panels',
  'Rozpočet': 'Budget',
  'Varianty': 'Variants',
  'Výkon TČ': 'HP capacity',
  'Roční spotřeba budovy': 'Annual building consumption',
  'Měsíční bilance': 'Monthly balance',
  '{{n}} panelů': '{{n}} panels',
  'Variantu nelze realizovat': 'This variant cannot be implemented',
  'Výroba FVE': 'PV production',
  'Spotřeba budovy': 'Building consumption',
  'Cena celkem': 'Total price',

  'Zpět na úvod': 'Back to home',
  'Ukázková data': 'Sample Data',
  'Stažitelné soubory pro vyzkoušení analytických scénářů bez nutnosti připravovat vlastní data. Stažený soubor stačí v daném scénáři nahrát stejně jako vlastní.':
    'Downloadable files for trying out the analysis scenarios without preparing your own data. Just upload the downloaded file in the chosen scenario as if it were your own.',
  'HBJSON modely budov': 'HBJSON Building Models',
  'Honeybee modely popisující geometrii budov a jejich tepelné zóny.':
    'Honeybee models describing building geometry and thermal zones.',
  
  'Hodinová klimatická data pro konkrétní lokality, převzatá z volně dostupných meteorologických souborů.':
    'Hourly climate data for specific locations, taken from freely available weather files.',
  'Zatím zde nejsou žádné soubory ke stažení.':
    'No files available for download yet.',
  'Stáhnout': 'Download',

  // ── Help / TourOverlay UI ─────────────────────────────────────────
  'Pro průvodce nejprve nahraj EPW soubor.': 'To start the guide, please upload an EPW file first.',
  'Rozumím': 'Got it',
  'Zavřít průvodce': 'Close guide',
  'Dokončit': 'Finish',
  'Další': 'Next',
  'Průvodce': 'Guide',

  // ── Help / EPW steps ──────────────────────────────────────────────
  'Scénář umožňuje analyzovat klimatická EPW data o počasí pro danou lokalitu. Po dokončení analýzy aplikace poskytne 3 různé pohledy na data pomocí tří záložek: vítr, teplota a sluneční dráha.':
    'The scenario lets you analyze climate EPW weather data for a chosen location. Once the analysis completes, the app provides three views of the data via three tabs: wind, temperature, and sun path.',
  'Nahrání EPW souboru': 'EPW file upload',
  'Vstupní pole, prostřednictvím něhož uživatel může nahrát EPW soubor. Stačí na něj kliknout a v následně otevřeném dialogovém okně vybrat patřičný soubor z lokálního úložiště.':
    'An input field for uploading an EPW file. Just click it and pick the appropriate file from local storage in the dialog that opens.',
  'Informace o lokalitě': 'Location information',
  'Pruh uvádí název města, zeměpisné souřadnice a nadmořskou výšku načtené z hlavičky EPW souboru.':
    'The bar shows the city name, geographic coordinates, and elevation read from the EPW file header.',
  'Lišta záložek': 'Tab bar',
  'Lišta zpřístupňuje tři pohledy na stejná klimatická data. Mezi záložkami Vítr, Teplota a Sluneční dráha lze libovolně přepínat.':
    'The bar provides three views of the same climate data. You can freely switch between the Wind, Temperature, and Sun path tabs.',
  'Souhrnné statistiky větrných charakteristik': 'Wind summary statistics',
  'Čtveřice karet shrnuje větrné podmínky lokality pomocí 4 charakteristik: průměrá roční rychlost, maximalní rychlsot , převládající směr a podíl bezvětří. Rychlosti jsou uváděny v metrech za sekundu.':
    'Four cards summarize the wind conditions at the location using four characteristics: average annual speed, maximum speed, prevailing direction, and calm share. Speeds are in meters per second.',
  'Polární graf zobrazuje, odkud a jak často vítr v lokalitě vane.':
    'The polar chart shows where the wind blows from and how often.',
  'Průměrné měsíční rychlosti': 'Average monthly speeds',
  'Sloupcový graf ukazuje průměrnou rychlost větru pro každý měsíc v roce. U každého sloupce je vedle průměru uvedeno také měsíční maximum.':
    'The bar chart shows average wind speed for each month of the year. Each bar shows the monthly maximum next to the average.',
  'Rozložení rychlostí větru klasifikované podle Beaufortovy stupnice, od bezvětří po vichřici. U každé třídy je uveden počet hodin v roce, kdy panuje určitý stav':
    'Wind speed distribution classified by the Beaufort scale, from calm to gale. Each class shows the number of hours per year with the corresponding conditions.',
  'Souhrnné teplotní statistiky': 'Temperature summary statistics',
  'Šestice karet shrnuje teplotní poměry lokality. Patří sem roční průměr, Teplotní extrémy, podíl komfortních hodin v rozmezí 18 až 26 °C, počet mrazivých hodin a klasifikace klimatické zóny podle normy ASHRAE 169.':
    'Six cards summarize the temperature conditions at the location: annual average, temperature extremes, share of comfortable hours within 18 to 26 °C, sub-zero hour count, and climate zone classification per ASHRAE 169.',
  'Tabulka popisující měsíční teplotní profil dané lokality. Každý řádek odpovídá jednomu kalendářnímu měsíci a uvádí jeho minimální, průměrnou a maximální teplotu, doplněnou o celkové teplotní rozpětí. Minimální a maximální hodnoty navíc jsou uváděny ve formě percentilů P5 a P95, čímž se omezuje vliv ojedinělých extrémů.':
    'A table describing the monthly temperature profile of the location. Each row corresponds to one calendar month and shows its minimum, mean and maximum temperature with the overall range. Minimum and maximum are reported as P5 and P95 percentiles to dampen the influence of rare extremes.',
  'Ukazatele HDD a CDD vyjadřují, jak výrazně a jak dlouho se venkovní teplota odchyluje od prahu pro vytápění (18 °C) a chlazení (21 °C). Roční součet poskytuje představu o potřebě vytápění a chlazení v lokalitě.':
    'The HDD and CDD indicators express how strongly and how long the outdoor temperature deviates from the heating (18 °C) and cooling (21 °C) thresholds. The annual sum gives a sense of the heating and cooling needs at the location.',
  'Rozložení denostupňů v roce': 'Degree-day distribution over the year',
  'Sloupcový graf rozkládá roční hodnoty HDD a CDD do jednotlivých měsíců. Modré sloupce odpovídají topným denostupňům, červené chladicím.':
    'The bar chart breaks down the annual HDD and CDD values into individual months. Blue bars correspond to heating degree-days, red bars to cooling.',
  'Heatmapa zachycuje průměrnou teplotu pro každou kombinaci měsíce a hodiny dne. Modrá značí chladnější hodnoty, červená teplejší.':
    'The heatmap captures the average temperature for each month and hour-of-day combination. Blue marks cooler values, red marks warmer ones.',
  'Pozice slunce nad obzorem': 'Sun position above the horizon',
  'Graf zachycuje výšku slunce nad obzorem pro 21. den každého měsíce. Volba 21. dne není náhodná, jelikož se blíží slunovratům a rovnodennostem. Hodnota 0° na svislé ose odpovídá horizontu, 90° poloze v nadhlavníku. Ve střední Evropě slunce dosahuje maximální výšky okolo 64°.':
    'The chart captures the sun altitude above the horizon for the 21st of each month. The 21st is chosen because it is near solstices and equinoxes. 0° on the vertical axis is the horizon, 90° the zenith. In Central Europe the sun reaches a maximum altitude of about 64°.',
  'Východ, západ a délka dne': 'Sunrise, sunset and day length',
  'Pro 21. den každého měsíce tabulka uvádí čas východu a západu slunce, výslednou délku dne a maximální výšku slunce nad obzorem.':
    'For the 21st of each month the table lists the time of sunrise and sunset, the resulting day length, and the maximum sun altitude above the horizon.',
  'Délka dne v průběhu roku': 'Day length throughout the year',
  'Horizontální sloupcový graf porovnává délku 21. dne v jednotlivých měsících.':
    'The horizontal bar chart compares the length of the 21st across the months.',

  // ── Help / Heatpump steps ─────────────────────────────────────────
  'Optimalizační scénář, který umisťuje do zón vyznačených v HBJSON datech tepelná čerpadla a počítá jejich potenciál. Zároveň porovnává dva druhy čerpadel, vzduch-voda (ASHP) a země-voda (GSHP), proto se simulace interně spouští dvakrát.':
    'An optimization scenario that places heat pumps into the zones marked in the HBJSON data and computes their potential. It also compares two pump types: air-to-water (ASHP) and ground-to-water (GSHP), so the simulation internally runs twice.',
  'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie budovy) a EPW (klimatická data lokality).':
    'A form for uploading input data. The scenario requires both key formats: HBJSON (building geometry) and EPW (location climate data).',
  'Sekce umožňuje budovám z HBJSON dat přiřadit jeden ze šesti dostupných typů. Volba typu určuje, která šablona energetického chování převzatá z Ladybug Tools bude budově přiřazena. Šablona reprezentuje typická vnitřní zatížení daného druhu budovy.':
    'This section assigns one of six available types to the buildings from the HBJSON data. The chosen type determines which Ladybug Tools energy-behavior template is assigned. The template represents typical internal loads of that building type.',
  'Přepínač rozhoduje, zda bude simulace zahrnovat pouze vytápění místností, nebo také jejich chlazení.':
    'The switch decides whether the simulation covers only room heating or also cooling.',
  'Posuvník Setpoint vytápění určuje cílovou teplotu, kterou má tepelné čerpadlo v zónách budovy během simulace udržovat. ':
    'The Heating setpoint slider sets the target temperature that the heat pump should maintain in the building zones during the simulation. ',
  'Spuštění simulace': 'Run simulation',
  'Tlačítko pro spuštění simulace.': 'Button to start the simulation.',
  'Místnosti budovy': 'Building rooms',
  'Karta uvádí seznam všech místností rozpoznaných v HBJSON datech společně s jejich rozměry. Tyto místnosti v simulaci vystupují jako zóny vytápění, jejichž teplotu se tepelná čerpadla snaží po celý rok udržet na zadaných hodnotách.':
    'The card lists every room detected in the HBJSON data along with its dimensions. These rooms act as heating zones whose temperature the heat pumps try to maintain at the set values year-round.',
  'Sekce shrnuje, kolik tepla bylo potřeba do budovy dodat během jednoho simulovaného roku. Souhrnnou roční hodnotu v kWh doplňuje sloupcový graf, který tuto potřebu rozkládá na jednotlivé měsíce.':
    'This section summarizes how much heat had to be delivered to the building over one simulated year. The total annual value in kWh is complemented by a bar chart that breaks this demand down by month.',
  'Porovnání tepelných čerpadel': 'Heat-pump comparison',
  'Závěrečná část scénáře nabízí tři pohledy na simulaci uspořádané do samostatných záložek, mezi nimiž lze libovolně přepínat. Úvodní záložka Porovnání poskytuje agregovaný přehled klíčových metrik obou čerpadel, jako jsou hodnota COP nebo celková roční spotřeba elektřiny. Zbylé dvě záložky nabízejí detailnější pohled na každé čerpadlo zvlášť, doplněný například o měsíční graf dodaného tepla či rozpis výroby podle potřeb jednotlivých místností.':
    'The closing part of the scenario offers three views of the simulation, organized into separate tabs that you can switch between freely. The opening Comparison tab provides an aggregated overview of key metrics of both pumps, such as COP or total annual electricity consumption. The other two tabs offer a more detailed view of each pump separately, supplemented for example with a monthly chart of delivered heat or a breakdown of production by per-room demand.',

  // ── Help / PED Optimizer steps ────────────────────────────────────
  'Optimalizace oblasti pomocí PV a TČ': 'Area optimization with PV and HP',
  'Optimalizační scénář, který na základě zadaného rozpočtu osadí oblast fotovoltaickými panely a tepelnými čerpadly ve třech porovnávaných variantách. První pokrývá oblast pouze fotovoltaickými panely, zbylé dvě k nim navíc doplní tepelné čerpadlo vzduch-voda, případně země-voda. Z roční bilance výroby a spotřeby se pro každou variantu vypočte, zda oblast dosahuje energetické pozitivity.':
    'An optimization scenario that, based on the given budget, populates the area with PV panels and heat pumps in three compared variants. The first covers the area only with PV panels; the other two add an air-to-water or ground-to-water heat pump. From the annual production and consumption balance the energy positivity of each variant is computed.',
  'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie oblasti) a EPW (klimatická data lokality).':
    'A form for uploading input data. The scenario requires both key formats: HBJSON (area geometry) and EPW (location climate data).',
  'Pole stanovuje horní finanční hranici v Kč, do které je možné oblast osadit energetickými agenty. Hodnotu lze upravit šipkami nebo přímým zápisem.':
    'The field sets the upper financial limit (in CZK) up to which the area can be populated with energy agents. The value can be adjusted with arrows or by typing.',
  'Parametry simulace převzaté z předchozích optimalizačních scénářů. Setpoint vytápění, účinnost fotovoltaických panelů a typ jejich montáže.':
    'Simulation parameters taken from the previous optimization scenarios. Heating setpoint, PV efficiency, and mount type.',
  'Sekce umožňuje specifikovat pořizovací cenu jednotlivých energetických agentů.':
    'This section lets you specify the purchase price of each energy agent.',
  'Informační pruh': 'Info strip',
  'Pruh uvádí název lokality načtené z hlavičky EPW souboru, počet místností a celkovou podlahovou plochu rozpoznané budovy, maximální počet panelů, jež by se vešly na její střechy, a zadaný investiční rozpočet.':
    'The bar shows the location read from the EPW header, the number of rooms and total floor area of the detected building, the maximum number of panels that would fit on its roofs, and the entered investment budget.',
  'Přehledové karty variant': 'Variant overview cards',
  'Přehledové karty poskytují stručný pohled na všechny tři varianty.':
    'The overview cards provide a brief view of all three variants.',
  'Tabulka rozkládá celkovou roční spotřebu vybrané varianty na její dílčí složky.':
    'The table breaks down the total annual consumption of the selected variant into its components.',
  'Tabulka uvádí pro každý měsíc kalendářního roku spotřebu budovy, výrobu fotovoltaických panelů a jejich výslednou bilanci. Tento pohled umožňuje odhalit období, ve kterých některý z energetických agentů ztrácí na účinnosti, a otevírá tak prostor pro hledání alternativních řešení pro tato období.':
    'For each calendar month the table shows the building consumption, the PV production, and the resulting balance. This view helps reveal periods in which an energy agent loses efficiency and opens space for alternative solutions in those periods.',

  // ── Help / Solar Advanced steps ───────────────────────────────────
  'Optimalizační scénář, který rozmístí solární panely na střechy identifikované ve vstupních HBJSON datech, a to v nejvyšším počtu, jaký geometrie střech, jejich sklon a orientace dovolují. Pro panely se následně vypočítá solární potenciál a odhadne potenciální roční výroby elektrické energie a vrátí se ty nejlepší.':
    'An optimization scenario that arranges solar panels on the roofs identified in the input HBJSON data, in the largest count that roof geometry, tilt and orientation allow. The solar potential is then computed for each panel and the potential annual electricity production is estimated; the best ones are returned.',
  'Formulář pro nahrání vstupních dat. Scénář vyžaduje oba klíčové formáty: HBJSON (geometrie obalsti) a EPW  (klimatické data lokality.':
    'A form for uploading input data. The scenario requires both key formats: HBJSON (area geometry) and EPW (location climate data).',
  'Pole určuje, kolik panelů s největším potenciálem výroby se uživateli zobrazí ve výsledcích. Hodnotu lze upravit šipkami nebo přímým zápisem.':
    'The field sets how many panels with the largest production potential will be shown in the results. The value can be adjusted with arrows or by typing.',
  'Rozbalovací sekce s dalšími parametry simulace. Účinnost panelu udává, jaký podíl dopadajícího slunečního záření se převede na elektrickou energii. Maximální sklon střechy slouží jako filtr ploch, které se mají do simulace zahrnout. Typ montáže rozlišuje mezi otevřenou konstrukci od střešní montáže.':
    'A collapsible section with additional simulation parameters. Panel efficiency states what share of the incident solar radiation is converted to electricity. Maximum roof tilt serves as a filter of surfaces to include. Mount type distinguishes open-rack from roof-mounted.',
  'Pruh s identifikací lokality načtené z hlavičky EPW souboru, počtem rozpoznaných střech, jejich celkovou plochou a maximálním počtem panelů, jež by se na ně vešly.':
    'A bar with the location read from the EPW header, the number of detected roofs, their total area, and the maximum number of panels that would fit on them.',
  'Souhrnné statistiky': 'Summary statistics',
  'Charakteristiky vybrané skupiny solárních panelů. Roční výroba udává odhadovanou produkci elektrické energie, instalovaný výkon, celkovou rozlohu panelů na střechách a průměrný solární potenciál na jeden metr čtvereční vybraných panelů.':
    'Characteristics of the selected group of solar panels. Annual production states the estimated electricity yield, the installed capacity, the total area of panels on the roofs, and the average solar potential per square meter of the selected panels.',
  'Karta shrnuje parametry solárních panelů použitých v simulaci. Obsahuje například rozměry panelu,účinnost, typ montáže nebo celkové ztráty systému. Rozkliknutím Celkových ztrát se zobrazí jejich podrobný rozpis.':
    'The card summarizes the parameters of the solar panels used in the simulation. It contains for example the panel dimensions, efficiency, mount type, and total system losses. Clicking on Total losses reveals a detailed breakdown.',
  'Rozmístění solárních panelů': 'Solar panel layout',
  '2D vizualizace střešních ploch z HBJSON dat společně s rozmístěním panelů, jež ze simulace vzešly jako ty s nejvyšším potenciálem výroby. Pro každou střechu vzniká samostatná karta. Při najetí kurzorem na konkrétní panel se zobrazí jeho atributy, například potenciál roční výroby nebo jeho souřadnice  na střeše.':
    'A 2D visualization of the roof surfaces from the HBJSON data together with the placement of the panels selected by the simulation as having the highest production potential. A separate card is created for each roof. Hovering over a specific panel reveals its attributes, e.g. annual production potential or its coordinates on the roof.',
  'Detail jednotlivých panelů': 'Individual panel details',
  'Tabulka s informacemi o všech vybraných panelech, seřazená podle potenciálu roční výroby. U každého panelu je uvedena plocha, optimální sklon určený simulací a směr orientace. Závěr tvoří energetické parametry: roční solární potenciál, odhadovaná výroba a instalovaný výkon.':
    'A table with information about every selected panel, sorted by annual production potential. For each panel the area, the optimal tilt determined by the simulation, and the azimuth direction are listed. Energy parameters round it out: annual solar potential, estimated production, and installed capacity.',

  // ── Solar / PanelMapView extras ───────────────────────────────────
  'Předchozí stránka': 'Previous page',
  'Další stránka': 'Next page',
  'plochá': 'flat',
  'plurals.panel.one': 'panel',
  'plurals.panel.few': 'panels',
  'plurals.panel.many': 'panels',
  'plurals.roof.one': 'roof',
  'plurals.roof.few': 'roofs',
  'plurals.roof.many': 'roofs',

  // ── HBJSON Viewer extras ──────────────────────────────────────────
  'Budovy': 'Buildings',

  // ── Heatpump renamed bar tooltip keys ─────────────────────────────
  '{{mo}}: teplo {{val}} kWh': '{{mo}}: heat {{val}} kWh',
  '{{mo}}: chlad {{val}} kWh': '{{mo}}: cooling {{val}} kWh',
  'kWh/rok': 'kWh/year',

  // ── Sample data extras ────────────────────────────────────────────
  'DWG CAD podklady': 'DWG CAD source files',
  'Geometrické podklady reálné zástavby, ze kterých lze vygenerovat HBJSON model.':
    'Geometric source data of real-world development from which an HBJSON model can be generated.',
  'Soubor není k dispozici': 'File not available',

  // ── AboutProject (shortened paragraphs) ───────────────────────────
  'Tento projekt vznikl jako součást <strong>diplomové práce</strong> na <strong>Ostravské univerzitě</strong>.':
    'This project was created as part of a <strong>master\'s thesis</strong> at the <strong>University of Ostrava</strong>.',
  'Aplikace zpřístupňuje analytické funkce platformy <strong>Ladybug Tools</strong> uplatňované při analýze <strong>pozitivních energetických oblastí (PED)</strong>. Uživateli umožňuje spouštět vybrané Ladybug funkce <strong>bez nutnosti psaní kódu</strong> a bez vazby na placené prostředí <strong>Rhinoceros</strong>, čímž odstraňuje hlavní překážky širšího osvojení této platformy.':
    'The application opens up the analytical features of the <strong>Ladybug Tools</strong> platform, which are used in the analysis of <strong>Positive Energy Districts (PED)</strong>. It lets users run selected Ladybug functions <strong>without writing any code</strong> and without being tied to the paid <strong>Rhinoceros</strong> environment, removing the main barriers to broader adoption of the platform.',
  'Aplikace je postavena na architektuře <strong>klient–server</strong>. Klientská část je realizována pomocí knihovny <strong>React</strong> a jazyka <strong>TypeScript</strong>, serverová část v jazyce <strong>Python</strong> za využití frameworku <strong>FastAPI</strong>, který v rámci jednotlivých scénářů volá funkce knihovny <strong>Ladybug Tools</strong> doplněné o vlastní aplikační logiku.':
    'The application is built on a <strong>client–server</strong> architecture. The client side is implemented with the <strong>React</strong> library and <strong>TypeScript</strong>; the server side is written in <strong>Python</strong> using the <strong>FastAPI</strong> framework, which, in the individual scenarios, calls the <strong>Ladybug Tools</strong> library functions augmented with custom application logic.',

  // ── SampleData (shortened) ────────────────────────────────────────
  'Stažitelné soubory pro vyzkoušení analytických scénářů bez nutnosti připravovat vlastní data.':
    'Downloadable files for trying out the analysis scenarios without preparing your own data.',

  // ── PED Optimizer ASCII month names (from backend variant_evaluator.py) ──
  'Unor': 'February',
  'Brezen': 'March',
  'Kveten': 'May',
  'Cerven': 'June',
  'Cervenec': 'July',
  'Zari': 'September',
  'Rijen': 'October',

  // ── Sample data file names ────────────────────────────────────────
  'Nezateplená cihla': 'Uninsulated brick house',
  'Lehce zateplený dům': 'Lightly insulated house',
  'Dvoupatrový dům podle ČSN': 'Two-story house per ČSN standard',
  'Zateplený dvoupatrový dům': 'Insulated two-story house',
  'Zateplený dvoupatrový dům s terénem': 'Insulated two-story house with terrain',
  'Pasivní dům': 'Passive house',
  'Dvě nezateplené budovy': 'Two uninsulated buildings',
  'Model oblasti Ostrava': 'Ostrava area model',
  'Zateplený dům se sedlovou střechou': 'Insulated house with a gabled roof',
  'Oblast Ostrava': 'Ostrava area',
  'Ostrava-Mošnov (TMYx 2011–2025)': 'Ostrava-Mošnov (TMYx 2011–2025)',
  'Ostrava-Mošnov (TMYx)': 'Ostrava-Mošnov (TMYx)',
  'Ostrava (IWEC)': 'Ostrava (IWEC)',
  'Praha (IWEC)': 'Prague (IWEC)',

  // ── Sample data file descriptions ─────────────────────────────────
  'Jednopatrový dům 8×9 m z plnopálené cihly 450 mm bez izolace (U ≈ 1.4), s 8 jednoduchými okny U = 5.0 a netěsným pláštěm.':
    'Single-story house 8×9 m of solid 450 mm brick without insulation (U ≈ 1.4), with 8 single-glazed windows U = 5.0 and a leaky envelope.',
  'Jednopatrový dům 12×8 m ze železobetonu s 50 mm EPS (U ≈ 0.55), s 8 dvojskelnými okny U = 2.4 a průměrnou těsností pláště.':
    'Single-story reinforced-concrete house 12×8 m with 50 mm EPS (U ≈ 0.55), 8 double-glazed windows U = 2.4, and average envelope tightness.',
  'Dvoupatrový dům 10×10 m podle aktuální normy ČSN 73 0540-2. Zateplený 120 mm EPS (U = 0.28), s 12 dvojskelnými okny low-e U = 1.1 a těsným pláštěm.':
    'Two-story house 10×10 m per the current ČSN 73 0540-2 standard. Insulated with 120 mm EPS (U = 0.28), 12 double-glazed low-e windows U = 1.1, and a tight envelope.',
  'Dvoupatrový dům 10×10 m se zateplenou obálkou (U = 0.28), s 12 dvojskelnými okny low-e a 4 tepelnými zónami. Základní model bez kontextu okolí.':
    'Two-story house 10×10 m with an insulated envelope (U = 0.28), 12 double-glazed low-e windows, and 4 thermal zones. A basic model without surrounding context.',
  'Stejný dvoupatrový zateplený dům doplněný o plochu terénu v okolí budovy pro realističtější vizualizaci modelu ve 3D náhledu.':
    'The same insulated two-story house supplemented with a terrain area around the building for a more realistic visualization in the 3D view.',
  'Jednopatrový dům 12×9 m s masivní izolací 300 mm EPS (U ≈ 0.10), s 8 trojskelnými okny U = 0.7 a velmi těsným pláštěm. Splňuje pasivní standard.':
    'Single-story house 12×9 m with massive 300 mm EPS insulation (U ≈ 0.10), 8 triple-glazed windows U = 0.7, and a very tight envelope. It meets the passive standard.',
  'Model dvou nezateplených budov s netěsným pláštěm a vysokou potřebou tepla.':
    'A model of two uninsulated buildings with a leaky envelope and high heat demand.',
  'HBJSON model části Ostravy vygenerovaný z CAD podkladu. Slouží jako příklad reálné zástavby pro PED analýzy.':
    'An HBJSON model of part of Ostrava generated from CAD source data. It serves as an example of real-world development for PED analyses.',
  'Dvoupatrový obdélníkový dům se sedlovou střechou tvořenou dvěma nakloněnými plochami. Zateplená obálka.':
    'A two-story rectangular house with a gabled roof made of two inclined surfaces. Insulated envelope.',
  'CAD podklad části Ostravy. Slouží jako vstup pro generování HBJSON modelu z reálné zástavby.':
    'CAD source data for part of Ostrava. Used as input for generating an HBJSON model from real-world development.',
};

export default en_overrides;
