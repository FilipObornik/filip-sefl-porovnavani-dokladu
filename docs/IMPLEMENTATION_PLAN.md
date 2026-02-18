# Implementation Plan – Porovnání Dokladů (MVP)

> Electron + Next.js desktop application for comparing invoices vs. receipts using AI extraction.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Shell                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               Next.js (Pages Router)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Overview    │  │  Results    │  │  Detail     │   │  │
│  │  │  Page        │  │  Table      │  │  Page       │   │  │
│  │  │  (index.tsx) │  │  Component  │  │(/detail/[id])│  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │  │
│  │         │                │                │           │  │
│  │  ┌──────┴────────────────┴────────────────┴───────┐   │  │
│  │  │           State (React Context / useReducer)   │   │  │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐  │   │  │
│  │  │  │ Documents  │ │ Comparison │ │ UI State   │  │   │  │
│  │  │  │ (invoices, │ │ Rows       │ │ (modals,   │  │   │  │
│  │  │  │  receipts) │ │            │ │  filters)  │  │   │  │
│  │  │  └────────────┘ └────────────┘ └────────────┘  │   │  │
│  │  └────────────────────────┬───────────────────────┘   │  │
│  │                           │                           │  │
│  │  ┌────────────────────────┴───────────────────────┐   │  │
│  │  │                 Services Layer                 │   │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │  │
│  │  │  │ Document │  │ Matching │  │ Export/Import│  │   │  │
│  │  │  │ Processor│  │ Service  │  │ Service      │  │   │  │
│  │  │  │ (AI)     │  │ (Leven.) │  │ (JSON)       │  │   │  │
│  │  │  └──────────┘  └──────────┘  └──────────────┘  │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Decisions
- **Pages Router** (not App Router) – two pages: overview (`/`) and detail (`/detail/[id]`)
- **React Context + useReducer** for state – no Redux needed for this scope
- **No local persistence** – all state in memory; export/import JSON for saving
- **Files stored as Base64 in memory** – needed for AI API calls and export/import
- **OpenRouter.ai API** – gateway to Gemini 2.5 Flash, API key hardcoded in config

---

## 2. Project Structure

```
/
├── electron/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script (context bridge)
│   └── tsconfig.electron.json     # Separate TS config (moduleResolution: "node")
│
├── src/
│   ├── pages/
│   │   ├── _app.tsx               # App wrapper (providers, global styles)
│   │   ├── _document.tsx          # Custom document
│   │   ├── index.tsx              # Overview page (screen 1)
│   │   └── detail/
│   │       └── [id].tsx           # Detail page (screen 2) – /detail/:rowId
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx      # Top-level layout shell (shared across pages)
│   │   ├── overview/
│   │   │   ├── OverviewTable.tsx   # Main comparison table (screen 1)
│   │   │   ├── OverviewRow.tsx     # Single row with file uploads + results
│   │   │   └── FileDropZone.tsx    # Drag & drop / file picker component
│   │   ├── detail/
│   │   │   ├── DetailLayout.tsx    # 3-column layout for detail page
│   │   │   ├── ItemPanel.tsx       # Left/right panel with extracted items
│   │   │   ├── MatchingArea.tsx    # Center panel with paired items
│   │   │   ├── PairBox.tsx         # Single matched pair display
│   │   │   └── DraggableItem.tsx   # Draggable item card
│   │   └── shared/
│   │       ├── Button.tsx          # Reusable button component
│   │       ├── Badge.tsx           # Status/validation badge
│   │       └── ValidationCell.tsx  # Green/red cell with difference display
│   │
│   ├── services/
│   │   ├── document-processor.ts   # AI extraction via OpenRouter
│   │   ├── matching-service.ts     # Levenshtein-based auto-matching
│   │   ├── comparison-service.ts   # Programmatic value comparison
│   │   └── export-import-service.ts# JSON export/import logic
│   │
│   ├── state/
│   │   ├── app-context.tsx         # React Context provider + reducer
│   │   ├── actions.ts              # Action types and creators
│   │   └── types.ts                # All TypeScript interfaces
│   │
│   ├── config/
│   │   └── api-keys.ts             # OpenRouter API key (hardcoded)
│   │
│   ├── lib/
│   │   ├── levenshtein.ts          # Levenshtein distance algorithm
│   │   ├── file-utils.ts           # File → Base64 conversion
│   │   └── number-utils.ts         # Czech number parsing (1.200,50 → 1200.50)
│   │
│   └── styles/
│       └── globals.css             # Global styles (Tailwind CSS)
│
├── public/                         # Static assets
├── package.json
├── tsconfig.json                   # Next.js TS config
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── electron-builder.yml            # Build/distribution config
```

---

## 3. Data Model (TypeScript Interfaces)

```typescript
// === Core Types (src/state/types.ts) ===

/** Single extracted line item from a document */
interface LineItem {
  id: string;                        // UUID, assigned after AI extraction
  item_name: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  total_price_with_vat: number | null;
  vat_rate: number | null;
  sku: string | null;
  document_closed: boolean | null;
}

/** Document (invoice or receipt) */
interface Document {
  id: string;                        // UUID
  type: 'invoice' | 'receipt';
  name: string;                      // Original filename
  filePath: string;                  // Empty string (not used in stateless mode)
  mimeType: string;                  // 'application/pdf' | 'image/png' | 'image/jpeg'
  status: 'pending' | 'processing' | 'done' | 'error';
  items: LineItem[];                 // AI-extracted items
  error?: string;
  rawData: string;                   // Base64-encoded file content
}

/** Item-level matched pair within a comparison row */
interface MatchingPair {
  id: string;                        // UUID
  invoiceItem: LineItem | null;      // Item from invoice side
  receiptItem: LineItem | null;      // Item from receipt side
  reviewed: boolean;                 // User marked as checked
}

/** Document-level comparison row (one invoice vs. one receipt) */
interface ComparisonRow {
  id: string;                        // UUID
  note: string;                      // User-editable note ("Peal cigarety 05/2025")
  invoiceId: string | null;          // Reference to Document.id
  receiptId: string | null;          // Reference to Document.id
  matchingPairs: MatchingPair[];     // Item-level pairs
  status: 'empty' | 'partial' | 'ready' | 'processing' | 'done' | 'error';
}

/** Full application state */
interface AppState {
  invoices: Document[];
  receipts: Document[];
  comparisonRows: ComparisonRow[];
}

/** Export/import JSON format */
interface ExportData {
  version: string;                   // "1.0"
  exportedAt: string;                // ISO timestamp
  invoices: Document[];
  receipts: Document[];
  comparisonRows: ComparisonRow[];
}
```

---

## 4. Implementation Phases

### Phase 1: Project Scaffolding & Electron Shell
**Goal:** Working Electron + Next.js app that opens a window.

**Tasks:**
1. Initialize Next.js project with TypeScript + Tailwind CSS
2. Set up Electron main process (`electron/main.ts`)
   - Create BrowserWindow loading `http://localhost:3000` in dev
   - Configure for production: load from `out/` directory
3. Set up preload script with context bridge (for file dialogs)
4. Configure `package.json` scripts:
   - `dev`: concurrently run Next.js + Electron
   - `build`: Next.js export + Electron package
   - `dist:win` / `dist:mac`: electron-builder
5. Set up `electron-builder.yml` for Windows (.exe NSIS installer) and macOS (.dmg)
6. Configure both `tsconfig.json` (Next.js) and `tsconfig.electron.json` (Electron, `moduleResolution: "node"`)
7. Verify hot-reload works in dev mode

**Key Dependencies:**
```json
{
  "next": "^14",
  "react": "^18",
  "react-dom": "^18",
  "electron": "^33",
  "typescript": "^5",
  "tailwindcss": "^3",
  "@dnd-kit/core": "^6",
  "@dnd-kit/sortable": "^8",
  "uuid": "^9",
  "concurrently": "^9",
  "electron-builder": "^25",
  "wait-on": "^8"
}
```

**Acceptance:** App window opens, shows "Hello World" page.

---

### Phase 2: State Management & Data Model
**Goal:** All TypeScript types defined, React Context wired up, export/import working.

**Tasks:**
1. Create all interfaces in `src/state/types.ts` (as defined in Section 3)
2. Implement `AppContext` with `useReducer`:
   - Actions: `ADD_ROW`, `REMOVE_ROW`, `UPDATE_ROW_NOTE`, `SET_INVOICE`, `SET_RECEIPT`, `UPDATE_DOCUMENT`, `SET_MATCHING_PAIRS`, `UPDATE_PAIR`, `IMPORT_STATE`, `RESET_STATE`
3. Implement `export-import-service.ts`:
   - `exportState(state: AppState): ExportData` – creates JSON blob with version + timestamp
   - `importState(json: string): AppState` – validates and parses import JSON
   - `downloadJson(data: ExportData)` – triggers browser download
   - `readJsonFile(file: File): Promise<string>` – reads uploaded JSON
4. Implement `file-utils.ts`:
   - `fileToBase64(file: File): Promise<string>` – converts File to Base64 string
   - `base64ToDataUrl(base64: string, mimeType: string): string`

**Acceptance:** Can export empty state as JSON, import the sample `porovnani-export.json`, see data in React DevTools.

---

### Phase 3: Overview Table (Screen 1)
**Goal:** Main screen with comparison rows, file upload, and action buttons.

**Tasks:**
1. Build `AppLayout.tsx` – top bar with "Uložit postup" / "Nahrát postup" / "Přidat řádek" buttons
2. Build `OverviewTable.tsx` – table rendering all `comparisonRows`
3. Build `OverviewRow.tsx` for each row, containing:
   - Editable "Poznámka" text input
   - `FileDropZone` for invoice (left, blue tint)
   - `FileDropZone` for receipt (right, green tint)
   - "Zpracuj" button (disabled until both files attached)
   - Results columns (empty until processed):
     - Množství Faktura | Rozdíl Příjemka (MJ comparison)
     - Celková cena Faktura | Rozdíl Příjemka (price comparison)
   - "Detail" button → navigates to `/detail/[rowId]` (disabled until processed)
   - "Delete row" button
4. Build `FileDropZone.tsx`:
   - Accepts PDF, JPG, JPEG, PNG
   - Drag & drop + click to browse
   - Shows filename after upload
   - Converts file to Base64, stores in Document
5. Build `ValidationCell.tsx`:
   - Displays two values (invoice / receipt) side by side
   - Green border: values match (within tolerance)
   - Red border: values differ (beyond tolerance)
   - Shows difference value

**Validation Rules for Overview:**
| Field | Tolerance | Color Logic |
|-------|-----------|-------------|
| Množství (MJ) | 0 (exact) | Green if diff == 0, Red otherwise |
| Celková cena | ±5 Kč | Green if abs(diff) <= 5, Red if abs(diff) > 5 |
| DPH | ±5 Kč | Green if abs(diff) <= 5, Red if abs(diff) > 5 |
| Kontrolní součet | n/a | Green if all sub-checks pass, Red otherwise |

**Acceptance:** Can add rows, upload files, see filenames, export/import state with files preserved (Base64).

---

### Phase 4: AI Document Processing
**Goal:** "Zpracuj" sends documents to Gemini, parses response into LineItems.

**Tasks:**
1. Create `src/config/api-keys.ts` with hardcoded OpenRouter API key
2. Implement `document-processor.ts`:
   - `processDocument(doc: Document): Promise<LineItem[]>`
   - Sends Base64 to OpenRouter API (`POST https://openrouter.ai/api/v1/chat/completions`)
   - Model: `google/gemini-2.5-flash` (or latest available)
   - Request format: multimodal message with image/PDF as base64
   - AI prompt (Czech-aware):
     ```
     Analyzuj tento dokument a vytěž z něj tabulková data.
     Vrať JSON pole objektů s těmito klíči:
     item_name, quantity, unit, unit_price, total_price,
     total_price_with_vat, vat_rate, sku, document_closed

     Pravidla:
     - Čísla převeď na JS Number formát (1.200,50 → 1200.50)
     - Pokud hodnota chybí, vrať null
     - document_closed: true/false podle stavu dokladu
     - Zachovej českou diakritiku v názvech
     ```
   - Parse JSON response, assign UUIDs to each LineItem
   - Handle errors: API timeout, malformed response, rate limits
3. Wire "Zpracuj" button:
   - Sets both documents to `status: 'processing'`
   - Calls `processDocument()` for invoice AND receipt **in parallel** (`Promise.all`)
   - Updates documents with extracted items
   - Sets `status: 'done'` or `status: 'error'`
4. Implement `number-utils.ts`:
   - `parseCzechNumber(value: string): number` – handles "1.200,50" → 1200.50
   - Used as fallback if AI doesn't normalize correctly

**Acceptance:** Upload two documents, click "Zpracuj", see extracted items in console/state. Handles API errors gracefully.

---

### Phase 5: Auto-Matching & Comparison Service
**Goal:** After AI extraction, automatically pair items and compute comparison results.

**Tasks:**
1. Implement `levenshtein.ts`:
   - `levenshteinDistance(a: string, b: string): number`
   - `levenshteinSimilarity(a: string, b: string): number` – returns 0-1 ratio
2. Implement `matching-service.ts`:
   - `autoMatch(invoiceItems: LineItem[], receiptItems: LineItem[]): MatchingPair[]`
   - Algorithm:
     1. Sort invoice items by `item_name` length (longest first)
     2. For each invoice item, find best receipt item match by Levenshtein similarity
     3. Threshold: similarity > 0.40 (40%)
     4. Greedy: once matched, receipt item is consumed
     5. Remaining unmatched items become single-sided pairs
3. Implement `comparison-service.ts`:
   - `compareRow(row: ComparisonRow, invoiceDoc: Document, receiptDoc: Document): RowComparison`
   - Aggregates across all matching pairs:
     - `totalQuantityInvoice` / `totalQuantityReceipt` → difference
     - `totalPriceInvoice` / `totalPriceReceipt` → difference
     - `totalVatInvoice` / `totalVatReceipt` → difference
   - Returns validation results with color indicators
4. Wire into the flow:
   - After both documents processed → run `autoMatch()` → store `matchingPairs` in `ComparisonRow`
   - Compute and display comparison results in the overview table

**Acceptance:** After processing, overview table shows quantities, prices, differences with correct green/red coloring.

---

### Phase 6: Detail Page (Screen 2) – 3-Column Layout
**Goal:** Separate detail page (`/detail/[id]`) with drag & drop item pairing.

**Tasks:**
1. Build `src/pages/detail/[id].tsx`:
   - Reads `id` from `router.query` → looks up `ComparisonRow` from context
   - If row not found or not processed → redirect back to `/`
   - "← Zpět" button navigates back to overview (`router.push('/')`)
   - Header shows row note (e.g. "Detail: Peal cigarety 05/2025")
2. Build `DetailLayout.tsx` – 3-column layout component:
   - **Left panel** (`ItemPanel`): Unmatched invoice items
   - **Center panel** (`MatchingArea`): Matched pairs in `PairBox` components
   - **Right panel** (`ItemPanel`): Unmatched receipt items
3. Build `DraggableItem.tsx`:
   - Card showing: item_name, quantity, unit, total_price
   - Draggable using `@dnd-kit/core`
4. Build `PairBox.tsx`:
   - Shows invoice item (left) and receipt item (right) side by side
   - Cell-level color coding: green if values match, red/highlighted if mismatch
   - "Reviewed" checkbox → green checkmark, pair becomes semi-transparent
   - Drop target: can accept a replacement item (returns old one to panel)
5. Implement drag & drop interactions:
   - **Panel → empty center area**: Creates new pair with single item
   - **Panel → existing PairBox (opposite side)**: Completes the pair
   - **Panel → existing PairBox (same side)**: Replaces, returns old item to panel
   - **PairBox → panel**: Unpairs, item returns to its panel
6. Recalculate comparison after every drag & drop change
7. Item display modes in panels:
   - **List view**: Compact cards (name, quantity, price)
   - **Table view**: Full table with all fields (toggle button)

**State persistence across pages:** React Context in `_app.tsx` wraps both pages, so state
is shared. Navigating between `/` and `/detail/[id]` preserves all data in memory.

**Acceptance:** Click "Detail" in overview → navigates to `/detail/[rowId]` → see auto-matched pairs, drag items to create/modify/remove pairs, validation updates live. "← Zpět" returns to overview with all state intact.

---

### Phase 7: Editable Items & Manual Rows
**Goal:** Users can edit extracted data and manually add rows.

**Tasks:**
1. Make `LineItem` fields editable in detail page:
   - Click on a value → inline edit (input field)
   - Validate number fields on blur
   - Recalculate comparison after edit
2. "Přidat řádek" in overview:
   - Adds new empty `ComparisonRow` at the bottom
   - User fills in note, uploads files
3. Manual item addition in Detail view:
   - "+" button in each panel to add a manual LineItem
   - All fields editable, marked as manually added

**Acceptance:** Can edit AI-extracted values, add manual comparison rows, add manual items within detail view.

---

### Phase 8: Polish, Responsive Layout & Build
**Goal:** Production-ready UI, Windows/macOS builds.

**Tasks:**
1. UI polish:
   - Match mockup styling (blue file zones, green/red validation borders)
   - 4:3 display optimization (min-width, scrollable table)
   - 16:9 as secondary (wider table, more space)
   - Loading spinners during AI processing
   - Error messages / toasts for API failures
2. Export/import UX:
   - "Uložit postup" → file save dialog → JSON download
   - "Nahrát postup" → file picker → loads state, replaces everything
   - Confirm dialog before import (overwrites current state)
3. Keyboard shortcuts:
   - `Ctrl+S` / `Cmd+S` → Export
   - `Ctrl+O` / `Cmd+O` → Import
   - `Escape` → Navigate back to overview from detail page
4. Electron production setup:
   - `next export` for static output
   - Electron loads from `file://` in production
   - App icon, title bar config
5. Build & test:
   - `npm run dist:win` → `.exe` installer (NSIS)
   - `npm run dist:mac` → `.dmg`
   - Test on Windows 10/11 (primary) and macOS

**Acceptance:** All 9 acceptance criteria from PRD pass. Clean builds for both platforms.

---

## 5. Service Details

### 5.1 OpenRouter API Integration

```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer <API_KEY>
  Content-Type: application/json
  HTTP-Referer: https://porovnani-dokladu.app
  X-Title: Porovnani Dokladu

Body:
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<extraction prompt in Czech>"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:<mimeType>;base64,<rawData>"
          }
        }
      ]
    }
  ],
  "response_format": { "type": "json_object" }
}
```

**Error handling:**
- 401 → "Neplatný API klíč"
- 429 → Retry with exponential backoff (max 3 attempts)
- 500+ → "Chyba serveru, zkuste to znovu"
- Timeout (30s) → "Časový limit vypršel"
- Malformed JSON → Attempt to extract JSON from markdown code block, else error

### 5.2 Levenshtein Matching Algorithm

```
function autoMatch(invoiceItems, receiptItems):
  pairs = []
  usedReceiptIds = new Set()

  // Sort by name length descending (longer names = more specific)
  sortedInvoice = invoiceItems.sort((a, b) => b.item_name.length - a.item_name.length)

  for each invoiceItem in sortedInvoice:
    bestMatch = null
    bestScore = 0

    for each receiptItem in receiptItems:
      if receiptItem.id in usedReceiptIds: continue
      score = levenshteinSimilarity(
        invoiceItem.item_name.toLowerCase(),
        receiptItem.item_name.toLowerCase()
      )
      if score > bestScore and score > 0.40:
        bestMatch = receiptItem
        bestScore = score

    if bestMatch:
      pairs.push({ invoiceItem, receiptItem: bestMatch, reviewed: false })
      usedReceiptIds.add(bestMatch.id)
    else:
      pairs.push({ invoiceItem, receiptItem: null, reviewed: false })

  // Add remaining unmatched receipt items
  for each receiptItem in receiptItems:
    if receiptItem.id not in usedReceiptIds:
      pairs.push({ invoiceItem: null, receiptItem, reviewed: false })

  return pairs
```

### 5.3 Comparison Aggregation (Overview Row)

```
For a ComparisonRow with matchingPairs:

totalQuantityInvoice = sum of all invoiceItem.quantity across pairs
totalQuantityReceipt = sum of all receiptItem.quantity across pairs
quantityDiff = totalQuantityInvoice - totalQuantityReceipt
quantityValid = (quantityDiff === 0)  // EXACT match required

totalPriceInvoice = sum of all invoiceItem.total_price across pairs
totalPriceReceipt = sum of all receiptItem.total_price across pairs
priceDiff = totalPriceInvoice - totalPriceReceipt
priceValid = (Math.abs(priceDiff) <= 5)  // ±5 Kč tolerance

totalVatInvoice = sum of (total_price_with_vat - total_price) across invoice items
totalVatReceipt = sum of (total_price_with_vat - total_price) across receipt items
vatDiff = totalVatInvoice - totalVatReceipt
vatValid = (Math.abs(vatDiff) <= 5)  // ±5 Kč tolerance

checksumValid = quantityValid && priceValid && vatValid
```

---

## 6. Export/Import JSON Schema

```json
{
  "version": "1.0",
  "exportedAt": "2026-02-16T12:53:27.117Z",
  "invoices": [
    {
      "id": "uuid",
      "type": "invoice",
      "name": "Scan_0009.pdf",
      "filePath": "",
      "mimeType": "application/pdf",
      "status": "done",
      "items": [
        {
          "id": "uuid",
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
      ],
      "rawData": "<base64-encoded file>"
    }
  ],
  "receipts": [ /* same structure */ ],
  "comparisonRows": [
    {
      "id": "uuid",
      "note": "Peal cigarety 05/2025",
      "invoiceId": "uuid-ref",
      "receiptId": "uuid-ref",
      "matchingPairs": [
        {
          "id": "uuid",
          "invoiceItem": { /* LineItem or null */ },
          "receiptItem": { /* LineItem or null */ },
          "reviewed": false
        }
      ],
      "status": "done"
    }
  ]
}
```

**Note:** `rawData` contains the full Base64-encoded file. This makes export files large (several MB) but ensures complete portability – no local file references needed.

---

## 7. UI Specifications

### Screen 1: Overview Table

| Column | Width | Content |
|--------|-------|---------|
| Poznámka | 150px | Editable text input |
| Faktura | 150px | FileDropZone (blue), shows filename |
| Příjemka | 150px | FileDropZone (green), shows filename |
| Zpracuj | 80px | Button, disabled until both files set |
| Množství Faktura | 100px | Number (sum of invoice quantities) |
| Rozdíl Příjemka | 100px | Number (difference), green/red border |
| Celková cena Faktura | 120px | Number (sum of invoice prices) |
| Rozdíl Příjemka | 120px | Number (difference), green/red border |
| Detail | 80px | Button, disabled until processed |

**Colors:**
- Green border: `#22c55e` (Tailwind `green-500`)
- Red border: `#ef4444` (Tailwind `red-500`)
- Invoice file zone: `#e0f2fe` (Tailwind `sky-100`)
- Receipt file zone: `#d1fae5` (Tailwind `emerald-100`)

### Screen 2: Detail Page (`/detail/[id]`) – 3-Column Layout

Full-page view. Navigated to from overview via "Detail" button. Back via "← Zpět".

```
┌────────────────────────────────────────────────────────┐
│  [← Zpět]                Detail: Peal cigarety 05/2025│
├──────────┬───────────────────────────┬─────────────────┤
│ FAKTURA  │     NAPÁROVANÉ POLOŽKY    │    PŘÍJEMKA     │
│          │                           │                 │
│ [Card 1] │  ┌─────────┬─────────┐   │  [Card A]       │
│ [Card 2] │  │ Inv. #3 │ Rec. #B │   │  [Card B]       │
│ [Card 3] │  │  10 ks  │  10 ks ✓│   │  [Card C]       │
│          │  └─────────┴─────────┘   │                 │
│          │  ┌─────────┬─────────┐   │                 │
│          │  │ Inv. #4 │ Rec. #D │   │                 │
│          │  │ 150 Kč  │ 145 Kč ✗│   │                 │
│          │  └─────────┴─────────┘   │                 │
│          │                           │                 │
│ [+ Add]  │                           │  [+ Add]        │
├──────────┴───────────────────────────┴─────────────────┤
│  [List View] [Table View]                              │
└────────────────────────────────────────────────────────┘
```

**Routing:** `router.push('/detail/[rowId]')` from overview, `router.push('/')` to go back.
State is preserved via React Context wrapping both pages in `_app.tsx`.

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI returns malformed JSON | Regex fallback to extract JSON from markdown code blocks; retry once |
| Large files (>10MB PDFs) | Warn user; compress/resize before Base64 encoding |
| Export JSON too large | Expected (base64 files); no mitigation needed, this is by design |
| OpenRouter rate limits | Exponential backoff, max 3 retries, clear error message |
| Drag & drop complexity | Use `@dnd-kit` library (well-tested, accessible) |
| 4:3 display constraints | Test on 1024x768 minimum; horizontal scroll for table if needed |
| Cross-platform Electron | Test on both Windows and macOS in CI; minimal native API usage |

---

## 9. Testing Strategy

### Manual Testing (Acceptance Criteria from PRD)
1. Upload 3+ documents simultaneously (PDF, JPG, PNG) → files visible in rows
2. Click "Zpracuj" → both docs sent to AI in parallel → results appear
3. Overview table shows green/red validation colors correctly
4. Detail view shows extracted items from both documents
5. Drag & drop pairing works (create, modify, remove pairs)
6. "+" button adds manual row / manual item
7. "Uložit postup" → downloads JSON file
8. "Nahrát postup" → loads JSON, restores full state
9. Test on Windows 10/11 (.exe installer)

### Test Data
- Sample documents in `docs/ukazkove_uctenky/` (9 PDFs, 2 images)
- Sample export in `docs/ukazkove_uctenky/porovnani-export.json`

---

## 10. Development Order Summary

| Phase | Estimated Effort | Dependencies |
|-------|-----------------|--------------|
| 1. Scaffolding & Electron | Foundation | None |
| 2. State & Data Model | Foundation | Phase 1 |
| 3. Overview Table UI | Core feature | Phase 2 |
| 4. AI Processing | Core feature | Phase 2 |
| 5. Matching & Comparison | Core feature | Phase 4 |
| 6. Detail Page + DnD | Core feature | Phase 5 |
| 7. Editing & Manual Rows | Enhancement | Phase 6 |
| 8. Polish & Build | Release | All above |
