# LADYBUG_APP

Webová aplikace, jež vznikla v rámci diplomové práce a jejímž cílem je
zpřístupnit funkce ekosystému Ladybug Tools prostřednictvím grafického
rozhraní a odstínit tak uživatele od programátorské náročnosti této
platformy. Obsah aplikace je tematicky členěn do několika záložek, z nichž
každá představuje jeden typ scénáře typického při analýze PED. Po
implementační stránce jednotlivé záložky kombinují funkce ekosystému
Ladybug Tools se standardními knihovnami jazyka Python a frameworku React,
doplněné o vlastní aplikační logiku.

Backend tvoří REST API ve frameworku FastAPI (Python), frontend je
single-page aplikace v Reactu a TypeScriptu. Aplikace aktuálně běží lokálně
pomocí dvou služeb (backend a frontend). Pokud vás zajímá více informací
o aplikaci, je podrobněji popsaná v diplomové práci s názvem **Možnosti
využití knihovny Ladybug pro analýzu pozitivních energetických oblastí**.

---

## Obsah

1. [Co je potřeba mít nainstalované předem](#1-co-je-potřeba-mít-nainstalované-předem)
2. [Stažení projektu z GitHubu](#2-stažení-projektu-z-githubu)
3. [Příprava backendu](#3-příprava-backendu)
4. [Příprava frontendu](#4-příprava-frontendu)
5. [Spuštění aplikace](#5-spuštění-aplikace)

---

## 1. Co je potřeba mít nainstalované předem

Před prvním spuštěním je nutné mít na počítači následující software. Všechny
položky jsou zdarma a fungují na Windows, macOS i Linuxu. Doporučené verze
nejsou náhodné — aplikace byla vyvíjena a testována přesně na nich a u
některých knihoven (zejména `openstudio`) může jiná verze způsobit problémy.

| Software       | Doporučená verze         | Odkaz                                |
|----------------|--------------------------|--------------------------------------|
| **Python**     | **3.13.x** (NE 3.14!)    | https://www.python.org/downloads/    |
| **Node.js**    | 20 LTS nebo novější      | https://nodejs.org/en/download       |
| **Git**        | aktuální                 | https://git-scm.com/downloads        |
| **EnergyPlus** | **přesně 25.1.0**        | https://energyplus.net/downloads     |

### Důležité poznámky k jednotlivým položkám

**Python 3.13 — proč ne novější verzi?** Aplikace vyžaduje balíček
`openstudio==3.10.0`, který obsahuje nativní kompilovaný kód. Jeho vývojáři
vydávají tzv. "wheels" (předkompilované binárky) jen pro konkrétní verze
Pythonu. Pro Python 3.13 wheel existuje a funguje bez problémů, pro Python
3.14 (vydaný na podzim 2025) zatím chybí.

**Při instalaci Pythonu na Windows zaškrtněte "Add Python to PATH".** Bez
tohoto kroku nepůjdou spustit příkazy `python` a `pip` z terminálu a museli
byste je zadávat plnou cestou, což je nepříjemné.

**Node.js verze 20 nebo vyšší.** Starší verze (16, 18) neumí některé
moderní JavaScriptové balíčky používané frontendem a `npm install` by
selhal.

**EnergyPlus 25.1.0 je nativní program** — nedá se nainstalovat přes pip
ani npm. Stahuje se jako klasický instalátor z odkazu výše. Verze musí být
přesně 25.1.0, protože novější i starší verze mají rozdíly v IDF schématu
a chování HVAC objektů, kvůli kterým by simulace mohly selhat nebo vracet
jiné výsledky než ty uvedené v diplomové práci.

Po instalaci si zapamatujte cestu, kam se EnergyPlus nainstaloval — typicky:

- Windows: `C:\EnergyPlusV25-1-0`
- macOS: `/Applications/EnergyPlus-25-1-0`
- Linux: `/usr/local/EnergyPlus-25-1-0`

### Ověření prerekvizit

Po instalaci všeho výše můžete v PowerShellu (Win + R → `powershell` →
Enter) ověřit, že je opravdu vše dostupné:

```powershell
python --version
node --version
git --version
Test-Path "C:\EnergyPlusV25-1-0\energyplus.exe"
```

Očekávané výstupy:

```
Python 3.13.x
v20.x.x  (nebo vyšší)
git version 2.x.x
True
```

Pokud máte na systému více verzí Pythonu vedle sebe, použijte navíc:

```powershell
py -0
```

V seznamu by mělo být `Python 3.13` (s hvězdičkou nebo bez). Pokud tam je
jen 3.14, doinstalujte 3.13 — Windows umí mít obě verze nainstalované
současně, nepřepíší se.

---

## 2. Stažení projektu z GitHubu

Všechny příkazy v tomto návodu se zadávají do terminálu (příkazové řádky).
Doporučuji používat spíše terminál přes **Visual Studio Code**, který je
dostupný z https://code.visualstudio.com/.

Následně v terminálu (na Windows ideálně PowerShell nebo Git Bash)
přejděte do složky, kam chcete projekt umístit. Například:

```powershell
cd C:\Users\<vase-jmeno>\Documents
```

A naklonujte repozitář:

```powershell
git clone https://github.com/CernikJ65/Ladybug_Web_APP.git
```

Jakmile klonování proběhne, měli byste vidět složku `Ladybug_Web_APP`
a v ní právě dvě části — backendovou a frontendovou.

Než obsah složky ověříte, přejděte do ní:

```powershell
cd Ladybug_Web_APP
```

Obsah můžete zkontrolovat příkazem `dir` (Windows) nebo `ls`
(macOS/Linux).

---

## 3. Příprava backendu

### 3.1 Vytvoření virtuálního prostředí

Virtuální prostředí (venv) izoluje knihovny tohoto projektu od zbytku
systému, takže nedojde ke konfliktům s jinými Python projekty. Vytvoříme
ho **explicitně s Pythonem 3.13**, abychom měli jistotu, že nevznikne na
novější verzi.

Nejprve se přesuneme do backendové části aplikace:

```powershell
cd ladybug_be
```

A vytvoříme venv s danou verzí Pythonu:

```powershell
py -3.13 -m venv .venv
```

Příkaz nic nevypíše, jen se po několika sekundách vrátí prompt. Mezitím
vznikne uvnitř `ladybug_be` nová složka `.venv` s vlastní instalací
Pythonu.

Ověření, že venv opravdu používá Python 3.13:

```powershell
.\.venv\Scripts\python.exe --version
```

Očekávaný výstup: `Python 3.13.x`. Pokud vidíte `3.14.x`, něco se pokazilo.

Pokud se něco pokazilo, zkuste složku odstranit a vytvořit znovu:

```powershell
Remove-Item -Recurse -Force .venv
py -3.13 -m venv .venv
```

### 3.2 Aktivace virtuálního prostředí

Aktivace virtuálního prostředí podle operačního systému:

- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **Windows (cmd):** `.venv\Scripts\activate.bat`
- **macOS / Linux:** `source .venv/bin/activate`

Po úspěšné aktivaci se v terminálu před řádkem objeví `(.venv)`, takže to
bude vypadat takto:

```
(.venv) PS C:\...\Ladybug_Web_APP\ladybug_be>
```

Pokud PowerShell zahlásí chybu o spouštění skriptů, typu:

```
.\.venv\Scripts\Activate.ps1 cannot be loaded because running scripts is
disabled on this system.
```

Znamená to, že Windows má z bezpečnostních důvodů zakázané spouštění
PowerShell skriptů. Vyřeší se to jednorázovým příkazem (potvrdíte stiskem
`A` pro "Yes to All"):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

A pak znovu spusťte aktivaci.

### 3.3 Instalace Python knihoven

S aktivovaným venv spusťte:

```powershell
pip install -r requirements.txt --no-deps
```

**Důležité — všimněte si flagu `--no-deps`.** Bez něj by instalace selhala
na konflikt v PyPI metadatech mezi `honeybee-radiance` a `honeybee-core`,
které ale ve skutečnosti spolu fungují bez problému.

Stažení a instalace zabere 5 až 15 minut. Stahuje se přes 60 balíčků,
několik z nich je velkých:

- `openstudio` (~150 MB) — Python bindings pro OpenStudio
- `numpy`, `scipy`, `matplotlib` — vědecké výpočty (každý desítky MB)
- `honeybee-energy` se standardními knihovnami — desítky MB

Nezavírejte terminál a nechte instalaci doběhnout. Na konci by mělo přijít:

```
Successfully installed BHResist-0.2.0 SecondaryCoolantProps-1.4 ...
... ladybug-core-0.44.36 ladybug-geometry-1.34.19 openstudio-3.10.0 ...
```

Ověření, že vše prošlo:

```powershell
python -c "import honeybee_energy; import openstudio; import ezdxf; print('OK')"
```

Pokud terminál vypíše `OK` bez jakékoli chybové hlášky, klíčové knihovny
se dají naimportovat a prostředí je v pořádku.

### 3.4 Propojení honeybee s EnergyPlus

Toto je kritický krok, na který se snadno zapomíná. Honeybee potřebuje
vědět, kde najít instalaci EnergyPlus. Má sice zabudovanou logiku, která
EnergyPlus zkouší najít automaticky, ale na počítačích s více instalacemi
(typicky pokud máte i OpenStudio) může najít špatnou verzi, což by vedlo
k odlišným výsledkům simulací než v diplomové práci.

Nejdřív zkontrolujte, jaký EnergyPlus honeybee aktuálně používá:

```powershell
python -c "from honeybee_energy.config import folders; print(folders.energyplus_exe)"
```

Pokud uvidíte přesně `C:\EnergyPlusV25-1-0\energyplus.exe`, je vše
v pořádku a tento krok můžete přeskočit. Pokud uvidíte jinou cestu
(například `C:\openstudio-3.7.0\EnergyPlus\energyplus.exe`) nebo `None`,
je potřeba honeybee ručně nasměrovat na správnou verzi, jelikož OpenStudio
má často v sobě také EnergyPlus, který se bere jako výchozí.

**Postup ruční konfigurace:**

1. Otevřete soubor `config.json` uvnitř balíčku honeybee-energy v Notepadu:

   ```powershell
   notepad .venv\Lib\site-packages\honeybee_energy\config.json
   ```

2. Najděte řádek `"energyplus_path": "",` a přepište ho na:

   ```json
   "energyplus_path": "C:\\EnergyPlusV25-1-0",
   ```

3. Důležité detaily, které snadno přehlédnete:
   - **Dvojitá zpětná lomítka `\\`** — JSON je vyžaduje, jednoduchá `\`
     by způsobila syntaktickou chybu. Alternativně lze použít forward
     slash `/`, který také funguje.
   - **Čárka na konci řádku zůstává** — `"...",` ne `"..."`. Bez čárky
     bude soubor neplatný JSON.
   - **Cesta směřuje ke SLOŽCE**, ne k souboru `energyplus.exe` —
     honeybee si k němu doplní cestu sám.

4. Uložte soubor (Ctrl + S) a zavřete Notepad.

5. Ověřte, že se změna projevila:

   ```powershell
   python -c "from honeybee_energy.config import folders; print(folders.energyplus_exe)"
   ```

   Nyní by mělo přijít: `C:\EnergyPlusV25-1-0\energyplus.exe`

Bez tohoto kroku by simulace přes EnergyPlus nebylo možné spustit.

---

## 4. Příprava frontendu

V novém okně terminálu (backend nechte pro pozdější běh — bude potřeba
dvou oken současně) přeskočte do adresáře, kde se u vás nachází frontendová
část aplikace:

```powershell
cd C:\Users\<vase-jmeno>\Documents\Ladybug_Web_APP\ladybug_fe
```

A následně:

```powershell
npm install
```

Tento jediný příkaz automaticky stáhne a nainstaluje všechny JavaScriptové
závislosti uvedené v souboru `package.json`, který je součástí repozitáře.
Není potřeba nic instalovat ručně — npm si projde seznam balíčků (React,
TypeScript, Vite, react-icons, knihovny pro 3D vizualizaci a další)
a postará se o stažení správných verzí včetně všech jejich vnitřních
závislostí.

Vznikne přitom složka `node_modules/`, která může mít stovky MB a do gitu
se necommituje (proto v repu chybí). Instalace trvá 2 až 5 minut podle
rychlosti připojení.

Na konci se objeví shrnutí typu:

```
added X packages, and audited X packages in 24s

7 vulnerabilities (2 moderate, 5 high)
```

Hlášku o "vulnerabilities" ignorujte — jde o věci ve vývojářských
nástrojích (linter, build tooly), ne v produkčním kódu, a v React
projektech je to standardní stav. **Nespouštějte `npm audit fix`**, mohlo
by to rozbít kompatibilitu balíčků.

Při dalších spuštěních už není nutné `npm install` opakovat, pokud se
nezmění `package.json`.

---

## 5. Spuštění aplikace

Aplikace běží jako dvě samostatné služby, které spolu komunikují přes
lokální síť. Backend obsluhuje API a provádí simulace, frontend zobrazuje
uživatelské rozhraní v prohlížeči. Je proto potřeba mít otevřená **dvě
okna terminálu současně**.

### Terminál 1 — backend

Přejděte do backendové části aplikace:

```powershell
cd C:\Users\<vase-jmeno>\Documents\Ladybug_Web_APP\ladybug_be
```

Aktivujte venv:

```powershell
.\.venv\Scripts\Activate.ps1
```

A zapněte běh backendu, v tomhletom případě na portu 8000:

```powershell
uvicorn app.main:app --reload --port 8000
```

Po spuštění by se v terminálu měl objevit výpis podobný tomuto:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [...] using StatReload
INFO:     Started server process [...]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Pozor — terminál nesmíte zavřít**, jinak backend přestane běžet. Nechte
ho otevřený a přejděte k druhému terminálu.

### Terminál 2 — frontend

V druhém okně terminálu (úplně novém, nezávislém na tom prvním) přejděte
do frontendové složky projektu, například:

```powershell
cd C:\Users\<vase-jmeno>\Documents\Ladybug_Web_APP\ladybug_fe
```

A spusťte dev server:

```powershell
npm run dev
```

Po spuštění se objeví výpis typu:

```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

Adresu `http://localhost:5173/` otevřete v prohlížeči (doporučuji Chrome
nebo Firefox v aktuální verzi) a aplikace je připravena k použití.

### Ukončení aplikace

V obou terminálech stiskněte `Ctrl + C` a potvrďte ukončení.

---

## Autor

**Jan Černík**
Diplomová práce
Ostravská univerzita, 2026
