import { DEFAULT_MODEL } from './models';

export interface CustomModelConfig {
  id: string;
  name: string;
}

export interface AppSettings {
  apiKey: string;
  selectedModel: string;
  customModels: CustomModelConfig[];
  /** Tolerance (Kč): součet vyčtených položek vs. hlavička dokladu */
  toleranceExtraction: number;
  /** Tolerance (Kč): celkový součet faktura vs. příjemka */
  toleranceTotal: number;
  /** Tolerance (Kč): srovnání jednotlivých párů položek */
  toleranceItem: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  selectedModel: DEFAULT_MODEL,
  customModels: [],
  toleranceExtraction: 5,
  toleranceTotal: 5,
  toleranceItem: 1,
};

export interface UsageEntry {
  id: string;
  timestamp: string; // ISO 8601
  rowId: string;
  documentId: string;
  documentLabel: string;
  requestType: 'invoice' | 'receipt';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
}
