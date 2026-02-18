# PRD – Aplikace pro zpracování účtenek/faktur (MVP)

<aside>
📌 Živý dokument – společně doplňujeme a upřesňujeme zadání. Finální verzi použijeme jako vstup pro AI agenta.

</aside>

# 1. Shrnutí projektu

Desktopová aplikace (Electron + Next.js) pro Windows 10/11. Uživatel nahraje dokumenty (objednávku/fakturu a dodejku/příjemku), AI je vytěží a aplikace provede programové porovnání napárovaných položek. Tři kroky: 1) vytěžení objednávky, 2) vytěžení dodejky, 3) automatické napárování a porovnání dat.

## Klient

- Stanislav Šefl – MEDOS (IČ: 10208470)
- Kontakt: filip.sefl@email.cz

## Rozpočet a termíny

- Cena MVP: 22 000 Kč (fixní, bez DPH)
- Záloha: 30 % (6 600 Kč) do 5 dnů od podpisu
- Deadline: 45 kalendářních dnů od připsání zálohy
- Záruka: 3 měsíce od předání

---

# 2. Funkční požadavky (MVP)

### 2.1 Nahrávání dokumentů

- Podpora formátů: PDF, JPG, JPEG, PNG
- Nahrání více dokumentů současně (min. 3)
- Drag & drop + file picker

### 2.2 AI zpracování

- Paralelní zpracování nahraných dokumentů
- AI model: Gemini 2.5 Flash nebo obdobný (přes OpenRouter.ai)
- API klíč objednatele – náklady na AI hradí objednatel
- Vytěžovaná data (normalizované klíče): item_name, quantity, unit, unit_price, total_price, total_price_with_vat, vat_rate, sku, document_closed

### 2.3 Porovnání a zobrazení výsledků

- Porovnání objednávky (faktura) vs. dodejky (příjemka) – programové, ne AI
- Indikace: quantity musí sedět přesně, u částek červená při rozdílu > 5 nebo < -5, zelená/červená kontrolní součet
- Dvě obrazovky: 1) Hlavní přehled (tabulka dle mockupu), 2) Detail (3-sloupcový layout s drag & drop párováním)

### 2.4 Editace a organizace

- Drag & drop přehazování položek
- Přiřazení více položek z jednoho dokumentu k jedné položce druhého
- Manuální přidání řádku (funkce Příloha/Návrh)

### 2.5 Export / Import

- Export aktuálního stavu jako JSON (tlačítko "Uložit postup")
- Import JSON souboru pro pokračování (tlačítko "Nahrát postup")
- Aplikace si sama stav neukládá (stateless)

---

# 3. Technická specifikace

### 3.1 Platforma

- Electron + Next.js
- Primární optimalizace: Windows 10 a 11, displej 4:3 (sekundárně 16:9)
    - UI musí být plně funkční na 4:3 rozlišení – 16:9 jako bonus

### 3.2 AI integrace

- OpenRouter.ai jako API gateway (snadná změna modelů)
- Výchozí model: Gemini 2.5 Flash (optimální poměr cena/výkon)
- API klíč zadává uživatel v aplikaci

### 3.3 UI

- UI mockup: viz PŘÍLOHA č. 2 (obrázek níže v sekci 6)

---

# 4. Akceptační kritéria

MVP je dokončené, když projde všech 9 scénářů na testovací sadě od klienta:

1. Nahrání dokumentů – min. 3 současně (PDF, JPG, JPEG, PNG)
2. Paralelní zpracování – odeslání na AI a zobrazení výsledků
3. Výsledek porovnání – indikace nepřesností u položek
4. Detail dokumentu – vlevo originál, vpravo vytěžená data
5. Drag & drop – přetahování a přiřazování položek
6. Manuální přidání řádku (Příloha/Návrh)
7. Export dat
8. Import dat
9. Kompatibilita – funkční na Windows 10 a 11

<aside>
⚠️ Scénáře 2, 3, 4 se testují na testovací sadě. Úspěch = aplikace korektně odešle požadavek na AI a zobrazí odpověď (bez ohledu na věcnou správnost vytěžení). Nepřesnosti AI modelu nejsou vadou díla.

</aside>

---

# 5. Budoucí iterace (mimo MVP)

- Licenční klíče / aktivace
- Nastavení AI modelů v UI
- Historie porovnání
- Další úpravy dle provozu

---

# 6. Otevřené otázky

K doplnění / upřesnění před vývojem:

- [x]  Tech stack: Electron + Next.js
- [x]  Formát exportu: JSON
- [x]  Porovnává se objednávka (faktura) vs. dodejka (příjemka)
- [x]  Vytěžovaná data: názvy položek, počet MJ, celková cena, částky bez DPH, DPH (sazba/částka), "Doklad uzavřen"
- [x]  Prompt engineering: AI vytěží data, porovnání je programové (ne AI). Prompt upřesníme při vývoji.
- [x]  UI mockup: PŘÍLOHA č. 2 dodána (viz sekce 7)
- [ ]  Testovací data – máme přístup k testovací sadě dokumentů?
- [x]  Distribuce: .exe installer

---

# 7. Workflow aplikace

Aplikace má dvě hlavní obrazovky a pracuje ve třech krocích:

## Hlavní přehled (obrazovka 1)

Tabulkový přehled všech párů faktura + příjemka. Sloupce dle mockupu:

Poznámka | Faktura | Příjemka | [Zpracuj] | Počet MJ (Fakt./Příj.) | Rozdíl | Celková cena (Fakt./Příj.) | Rozdíl | DPH (Fakt./Příj.) | Rozdíl PDH | Kontrolní součet | Doklad uzavřen?

- Uživatel nahraje ke každému řádku fakturu a příjemku (PDF/JPG/JPEG/PNG)
- Tlačítko "Zpracuj" odešle oba dokumenty na AI vytěžení
- Po zpracování se zobrazí souhrnné výsledky porovnání přímo v tabulce
- Tlačítko "Detail" otevře detailní pohled (obrazovka 2)
- "Uložit postup" / "Nahrát postup" = export/import JSON
- "Přidat řádek" = manuální přidání nového páru

## Detail párování (obrazovka 2)

3-sloupcový layout inspirovaný PoC:

- Vlevo: vytěžené položky z objednávky/faktury
- Uprostřed: pracovní plocha s napárovanými položkami
- Vpravo: vytěžené položky z dodejky/příjemky

### Zpracování dokumentů

1. Nahrání a příprava – soubor se převede na Base64 pro API
2. Odeslání na AI (Gemini přes OpenRouter) – model vytěží tabulková data
3. Parsing odpovědi – AI vrátí JSON pole s normalizovanými klíči, každý řádek dostane unikátní ID
4. Automatické párování – Levenshtein algoritmus porovná item_name (threshold >40%, řazení od nejdelšího názvu)
5. Zobrazení výsledků – spárované položky uprostřed, nespárované v postranních panelech

### Normalizované klíče (AI output)

```json
[
  {
    "item_name": "Název produktu",
    "quantity": 10,
    "unit": "ks",
    "unit_price": 150.00,
    "total_price": 1500.00,
    "total_price_with_vat": 1815.00,
    "vat_rate": 21,
    "sku": "ABC-123",
    "document_closed": true
  }
]
```

AI normalizuje názvy sloupců z dokumentu na tyto klíče. Čísla se převádí na JS Number formát (1.200,50 → 1200.50). Lokalizace: dokumenty jsou v češtině, prompt hlídá diakritiku.

### Drag & Drop párování

- Vytvoření nového páru: přetažení položky z panelu na prázdné místo uprostřed
- Doplnění páru: přetažení položky z opačné strany na existující box
- Oprava chyby: přetažení správné položky na špatně spárovaný box → původní se vrátí do seznamu
- Validace se okamžitě přepočítá po každé změně

### Zobrazení v postranních panelech

- List View: kompaktní karty (název, množství, cena) pro rychlý přehled
- Table View: Excel-like tabulka se všemi sloupci (SKU, poznámky atd.)

---

# 8. Pravidla porovnání

### Hlavní přehled (mockup)

- Počet MJ: musí se rovnat přesně (jakýkoliv rozdíl = červená)
- Celková cena, DPH: červená indikace při rozdílu > 5 nebo < -5
- Kontrolní součet: zelená = OK, červená = nesoulad
- Doklad uzavřen: zobrazení ano/ne

### Detail párování

- Normalizace hodnot před porovnáním (10 ks / 10.00 / 10 = stejná hodnota)
- Barevná indikace v napárovaných boxech: nesoulad v buňce = zvýraznění
- Reviewed stav: uživatel může označit pár jako zkontrolovaný (zelená fajfka, pár se zprůhlední)