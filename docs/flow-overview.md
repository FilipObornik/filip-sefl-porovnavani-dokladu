# Porovnání Dokladů – Diagramy flow

## 1. Celkový uživatelský flow

```mermaid
flowchart TD
    A([Start: Electron app]) --> B[Screen 1: Přehled\n/index.tsx]

    B --> C[Uživatel přidá řádek\nADD_ROW]
    C --> D[Drag & drop / výběr souboru\nFaktura PDF/PNG]
    C --> E[Drag & drop / výběr souboru\nPříjemka PDF/PNG]

    D --> F{Oba dokumenty\nnačteny?}
    E --> F

    F -- Ne --> G[status: partial]
    F -- Ano --> H[status: ready\nTlačítko Zpracuj aktivní]

    H --> I[Klik: Zpracuj]
    I --> J[status: processing]

    J --> K["🤖 AI VOLÁNÍ 1\nExtrakt položek z faktury\n(Gemini 2.5 Flash)"]
    J --> L["🤖 AI VOLÁNÍ 2\nExtrakt položek z příjemky\n(Gemini 2.5 Flash)"]

    K --> M{Oba extrakty\nhotovy?}
    L --> M

    M -- Chyba --> N[status: error\nAlert uživateli]
    M -- OK --> O["🤖 AI VOLÁNÍ 3\nPárování položek\n(Gemini 2.5 Flash)"]

    O -- Chyba AI --> P[Fallback:\nLevenshtein matching\n≥40% podobnost]
    O -- OK --> Q[Uložení párů\nSET_MATCHING_PAIRS]
    P --> Q

    Q --> R[status: done\nZobrazení souhrnů v řádku]

    R --> S[Klik: Detail]
    S --> T[Screen 2: Detail\n/detail/id]

    T --> U[3-sloupcový layout:\nNespárované faktury | Páry | Nespárované příjemky]
    U --> V[Uživatel ručně přesouvá\npomocí Drag & Drop\ndnd-kit]
    V --> W[Inline editace hodnot\nv PairBox]
    W --> X[Validace v reálném čase\ncompareRow]

    X --> Y{Checksum OK?}
    Y -- Zelená --> Z[Vše sedí ✓]
    Y -- Červená --> AA[Neshoda ✗]

    T --> AB[Export JSON\ncelého stavu]
    B --> AC[Import JSON\nobnovení stavu]
```

---

## 2. AI volání – detail

```mermaid
sequenceDiagram
    participant U as Uživatel
    participant App as React App
    participant DP as document-processor.ts
    participant MS as matching-service.ts
    participant OR as OpenRouter API
    participant GM as Gemini 2.5 Flash

    U->>App: Klik "Zpracuj"
    App->>App: status → processing

    par Paralelní volání
        App->>DP: processDocument(invoice)
        DP->>OR: POST /chat/completions\n[model: gemini-2.5-flash]\n[image: base64 faktury]
        OR->>GM: Forward request
        GM-->>OR: JSON pole LineItem[]
        OR-->>DP: Response
        DP-->>App: invoiceItems: LineItem[]
    and
        App->>DP: processDocument(receipt)
        DP->>OR: POST /chat/completions\n[model: gemini-2.5-flash]\n[image: base64 příjemky]
        OR->>GM: Forward request
        GM-->>OR: JSON pole LineItem[]
        OR-->>DP: Response
        DP-->>App: receiptItems: LineItem[]
    end

    App->>MS: autoMatch(invoiceItems, receiptItems)

    alt AI matching
        MS->>OR: POST /chat/completions\n[model: gemini-2.5-flash]\n[text: JSON obou seznamů]
        OR->>GM: Forward request
        GM-->>OR: {"pairs": [{invoice_index, receipt_index}]}
        OR-->>MS: Response
        MS-->>App: MatchingPair[]
    else AI selže (timeout / HTTP error)
        MS->>MS: levenshteinMatch()\nFallback ≥40% podobnost
        MS-->>App: MatchingPair[]
    end

    App->>App: SET_MATCHING_PAIRS\nstatus → done
    App-->>U: Zobrazení výsledků
```

---

## 3. Datový model

```mermaid
erDiagram
    AppState {
        Document[] invoices
        Document[] receipts
        ComparisonRow[] comparisonRows
    }

    Document {
        string id
        string type "invoice | receipt"
        string name
        string mimeType
        string rawData "Base64 souboru"
        string status "pending|processing|done|error"
        LineItem[] items
        string error
    }

    LineItem {
        string id
        string item_name
        number quantity
        string unit
        number unit_price
        number total_price
        number total_price_with_vat
        number vat_rate
        string sku
        boolean document_closed
    }

    ComparisonRow {
        string id
        string note
        string invoiceId
        string receiptId
        MatchingPair[] matchingPairs
        string status "empty|partial|ready|processing|done|error"
    }

    MatchingPair {
        string id
        LineItem[] invoiceItems
        LineItem[] receiptItems
        boolean reviewed
    }

    AppState ||--o{ Document : "invoices"
    AppState ||--o{ Document : "receipts"
    AppState ||--o{ ComparisonRow : "comparisonRows"
    Document ||--o{ LineItem : "items"
    ComparisonRow ||--o{ MatchingPair : "matchingPairs"
    MatchingPair ||--o{ LineItem : "invoiceItems"
    MatchingPair ||--o{ LineItem : "receiptItems"
```

---

## 4. Stavový automat – ComparisonRow

```mermaid
stateDiagram-v2
    [*] --> empty : ADD_ROW

    empty --> partial : Nahrán 1 dokument
    partial --> ready : Nahrán 2. dokument
    ready --> partial : Odstraněn 1 dokument

    ready --> processing : Klik Zpracuj
    done --> processing : Klik Zpracuj znovu

    processing --> done : AI vrátí výsledky\nSET_MATCHING_PAIRS
    processing --> error : AI selže

    error --> processing : Klik Zpracuj znovu
    done --> [*] : REMOVE_ROW
```

---

## 5. Validace – pravidla

```mermaid
flowchart LR
    subgraph Validace ["Validace (comparison-service.ts)"]
        A[MatchingPair[]] --> B[Součty za\nvšechny páry]
        B --> C{MJ / Množství\ndiff === 0?}
        B --> D{Cena bez DPH\nabs diff ≤ 5 Kč?}
        B --> E{DPH\nabs diff ≤ 5 Kč?}
        C -- Ano --> F[quantityValid ✓]
        C -- Ne --> G[quantityValid ✗]
        D -- Ano --> H[priceValid ✓]
        D -- Ne --> I[priceValid ✗]
        E -- Ano --> J[vatValid ✓]
        E -- Ne --> K[vatValid ✗]
    end

    F & H & J --> L{Všechny OK?}
    L -- Ano --> M[checksumValid ✓\nZelená]
    L -- Ne --> N[checksumValid ✗\nČervená]
```
