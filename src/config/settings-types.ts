import { DEFAULT_MODEL } from './models';

export interface CustomModelConfig {
  id: string;
  name: string;
}

export interface AppSettings {
  apiKey: string;
  selectedModel: string;
  customModels: CustomModelConfig[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  selectedModel: DEFAULT_MODEL,
  customModels: [],
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
