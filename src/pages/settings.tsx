import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSettings } from '@/state/settings-context';
import { CURATED_MODELS } from '@/config/models';
import { CustomModelConfig, UsageEntry } from '@/config/settings-types';
import PasswordModal from '@/components/settings/PasswordModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimePeriod = 'today' | 'yesterday' | 'thisMonth' | 'thisYear' | 'allTime';

interface PeriodSummary {
  label: string;
  entries: UsageEntry[];
  totalCostUSD: number;
  totalTokens: number;
  uniqueDocuments: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electronAPI) {
    return (window as unknown as { electronAPI: { getUsageLog: () => Promise<UsageEntry[]> } }).electronAPI;
  }
  return null;
}

function isoToDate(iso: string) {
  return new Date(iso);
}

function startOf(unit: 'day' | 'month' | 'year', d: Date): Date {
  const r = new Date(d);
  if (unit === 'day') { r.setHours(0, 0, 0, 0); }
  if (unit === 'month') { r.setDate(1); r.setHours(0, 0, 0, 0); }
  if (unit === 'year') { r.setMonth(0, 1); r.setHours(0, 0, 0, 0); }
  return r;
}

function buildSummaries(entries: UsageEntry[]): Record<TimePeriod, PeriodSummary> {
  const now = new Date();
  const todayStart = startOf('day', now);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const monthStart = startOf('month', now);
  const yearStart = startOf('year', now);

  const filter = (pred: (d: Date) => boolean) =>
    entries.filter((e) => pred(isoToDate(e.timestamp)));

  const summarize = (label: string, subset: UsageEntry[]): PeriodSummary => ({
    label,
    entries: subset,
    totalCostUSD: subset.reduce((s, e) => s + e.costUSD, 0),
    totalTokens: subset.reduce((s, e) => s + e.totalTokens, 0),
    uniqueDocuments: new Set(subset.map((e) => e.rowId)).size,
  });

  return {
    today: summarize('Dnes', filter((d) => d >= todayStart)),
    yesterday: summarize('Včera', filter((d) => d >= yesterdayStart && d < todayStart)),
    thisMonth: summarize('Tento měsíc', filter((d) => d >= monthStart)),
    thisYear: summarize('Tento rok', filter((d) => d >= yearStart)),
    allTime: summarize('Celkem (rok)', entries),
  };
}

function formatUSD(v: number) {
  if (v === 0) return '$0.000';
  if (v < 0.001) return `$${v.toFixed(6)}`;
  return `$${v.toFixed(4)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
}

// Group usage entries by rowId, sorted newest first
function groupByRow(entries: UsageEntry[]): { rowId: string; items: UsageEntry[] }[] {
  const map = new Map<string, UsageEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.rowId) ?? [];
    arr.push(e);
    map.set(e.rowId, arr);
  }
  return Array.from(map.entries())
    .map(([rowId, items]) => ({
      rowId,
      items: items.sort((a: UsageEntry, b: UsageEntry) => a.timestamp.localeCompare(b.timestamp)),
    }))
    .sort((a, b) => {
      const aMax = a.items[a.items.length - 1]?.timestamp ?? '';
      const bMax = b.items[b.items.length - 1]?.timestamp ?? '';
      return bMax.localeCompare(aMax);
    });
}

// ─── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSettings, isLoaded } = useSettings();

  const [authenticated, setAuthenticated] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [customModels, setCustomModels] = useState<CustomModelConfig[]>([]);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [toleranceExtraction, setToleranceExtraction] = useState(5);
  const [toleranceTotal, setToleranceTotal] = useState(5);
  const [toleranceItem, setToleranceItem] = useState(1);
  const [saved, setSaved] = useState(false);

  const [usageLog, setUsageLog] = useState<UsageEntry[]>([]);
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('thisMonth');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Load settings into local state when authenticated
  useEffect(() => {
    if (authenticated && isLoaded) {
      setApiKeyInput(settings.apiKey);
      setSelectedModel(settings.selectedModel);
      setCustomModels(settings.customModels ?? []);
      setToleranceExtraction(settings.toleranceExtraction ?? 5);
      setToleranceTotal(settings.toleranceTotal ?? 5);
      setToleranceItem(settings.toleranceItem ?? 1);
    }
  }, [authenticated, isLoaded, settings]);

  // Load usage log
  useEffect(() => {
    if (!authenticated) return;
    const api = getElectronAPI();
    if (!api) return;
    api.getUsageLog().then(setUsageLog);
  }, [authenticated]);

  const handleSave = useCallback(async () => {
    await updateSettings({
      apiKey: apiKeyInput.trim(),
      selectedModel,
      customModels,
      toleranceExtraction,
      toleranceTotal,
      toleranceItem,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [apiKeyInput, selectedModel, customModels, toleranceExtraction, toleranceTotal, toleranceItem, updateSettings]);

  const handleAddCustomModel = () => {
    const id = newModelId.trim();
    const name = newModelName.trim() || id;
    if (!id) return;
    if (customModels.some((m) => m.id === id) || CURATED_MODELS.some((m) => m.id === id)) return;
    setCustomModels((prev) => [...prev, { id, name }]);
    setNewModelId('');
    setNewModelName('');
  };

  const handleRemoveCustomModel = (id: string) => {
    setCustomModels((prev) => prev.filter((m) => m.id !== id));
    if (selectedModel === id) {
      setSelectedModel(CURATED_MODELS[0].id);
    }
  };

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  if (!authenticated) {
    return (
      <PasswordModal
        onSuccess={() => setAuthenticated(true)}
        onCancel={() => router.push('/')}
      />
    );
  }

  const allModels = [
    ...CURATED_MODELS.map((m) => ({ id: m.id, name: m.name })),
    ...customModels,
  ];

  const summaries = buildSummaries(usageLog);
  const activeSummary = summaries[activePeriod];
  const periodGroups = groupByRow(activeSummary.entries);

  const PERIODS: { key: TimePeriod; label: string }[] = [
    { key: 'today', label: 'Dnes' },
    { key: 'yesterday', label: 'Včera' },
    { key: 'thisMonth', label: 'Tento měsíc' },
    { key: 'thisYear', label: 'Tento rok' },
    { key: 'allTime', label: 'Celkem (rok)' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Zpět"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Nastavení</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* ── API key ── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">OpenRouter API klíč</h2>
          <div className="flex gap-3">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-or-..."
              autoComplete="new-password"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Klíč se ukládá lokálně v aplikaci a nikam neodesílá kromě OpenRouter.
          </p>
        </section>

        {/* ── Model selection ── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Model AI</h2>

          <div className="space-y-2">
            {allModels.map((m) => {
              const isCustom = customModels.some((c) => c.id === m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    selectedModel === m.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => setSelectedModel(m.id)}
                    className="accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{m.id}</span>
                  </div>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleRemoveCustomModel(m.id); }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      Odebrat
                    </button>
                  )}
                </label>
              );
            })}
          </div>

          {/* Add custom model */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-2">Přidat vlastní model</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder="openai/gpt-4o-mini"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Název (nepovinný)"
                className="w-40 px-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                type="button"
                onClick={handleAddCustomModel}
                disabled={!newModelId.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-40"
              >
                Přidat
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Model musí podporovat obrazový vstup (vision). ID ve formátu provider/model-name.
            </p>
          </div>
        </section>

        {/* ── Tolerance ── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Tolerance (Kč)</h2>
          <p className="text-xs text-gray-500 mb-4">Maximální povolený rozdíl v Kč pro jednotlivé úrovně porovnání.</p>
          <div className="space-y-3">
            {[
              { label: 'Vyčtení: součet položek vs. hlavička dokladu', value: toleranceExtraction, set: setToleranceExtraction },
              { label: 'Celkový součet: faktura vs. příjemka', value: toleranceTotal, set: setToleranceTotal },
              { label: 'Jednotlivý pár: položka vs. položka', value: toleranceItem, set: setToleranceItem },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 flex-1">{label}</label>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={value}
                    onChange={(e) => set(Math.max(0, Number(e.target.value)))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <span className="text-sm text-gray-500">Kč</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Save button ── */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {saved ? 'Uloženo' : 'Uložit nastavení'}
          </button>
        </div>

        {/* ── Usage statistics ── */}
        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Přehled využití</h2>

          {/* Period tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActivePeriod(key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activePeriod === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Cena (dle OpenRouter)</p>
              <p className="text-xl font-bold text-gray-800">{formatUSD(activeSummary.totalCostUSD)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Tokeny celkem</p>
              <p className="text-xl font-bold text-gray-800">{formatTokens(activeSummary.totalTokens)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Zpracovaných dokladů</p>
              <p className="text-xl font-bold text-gray-800">{activeSummary.uniqueDocuments}</p>
              {activeSummary.uniqueDocuments > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  ∅ {formatUSD(activeSummary.totalCostUSD / activeSummary.uniqueDocuments)} / doklad
                </p>
              )}
            </div>
          </div>

          {/* Detail log grouped by row */}
          {periodGroups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Žádná data pro toto období.</p>
          ) : (
            <div className="space-y-2">
              {periodGroups.map(({ rowId, items }) => {
                const groupCost = items.reduce((s, e) => s + e.costUSD, 0);
                const groupTokens = items.reduce((s, e) => s + e.totalTokens, 0);
                const latestTs = items[items.length - 1]?.timestamp ?? '';
                const isExpanded = expandedRows.has(rowId);

                return (
                  <div key={rowId} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => toggleRow(rowId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {items.map((e) => e.documentLabel).filter((v, i, a) => a.indexOf(v) === i).join(' + ')}
                          </p>
                          <p className="text-xs text-gray-400">{formatDateTime(latestTs)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className="text-xs text-gray-500">{formatTokens(groupTokens)} tok.</span>
                        <span className="text-sm font-semibold text-gray-700">{formatUSD(groupCost)}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {items.map((entry) => (
                          <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between bg-white">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">
                                {entry.documentLabel}
                                <span className="ml-1.5 text-gray-400 font-normal">
                                  ({entry.requestType === 'invoice' ? 'faktura' : 'doklad'})
                                </span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDateTime(entry.timestamp)} · {entry.model}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 ml-4 text-right">
                              <div className="text-xs text-gray-500">
                                <span>{formatTokens(entry.promptTokens)} in</span>
                                <span className="mx-1">+</span>
                                <span>{formatTokens(entry.completionTokens)} out</span>
                              </div>
                              <span className="text-sm font-medium text-gray-700 w-20 text-right">
                                {formatUSD(entry.costUSD)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {usageLog.length > 0 && (
            <p className="text-xs text-gray-400 mt-4 text-center">
              Data se uchovávají po dobu 1 roku. Ceny jsou převzaty přímo z odpovědí OpenRouter.
            </p>
          )}
        </section>

      </main>
    </div>
  );
}
