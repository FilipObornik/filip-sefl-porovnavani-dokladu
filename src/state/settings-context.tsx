import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '@/config/settings-types';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  isLoaded: false,
});

function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electronAPI) {
    return (window as unknown as { electronAPI: {
      getSettings: () => Promise<AppSettings>;
      setSettings: (s: AppSettings) => Promise<void>;
    } }).electronAPI;
  }
  return null;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api) {
      setIsLoaded(true);
      return;
    }
    api.getSettings().then((stored) => {
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...stored });
      }
      setIsLoaded(true);
    });
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    const api = getElectronAPI();
    if (api) {
      await api.setSettings(next);
    }
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
