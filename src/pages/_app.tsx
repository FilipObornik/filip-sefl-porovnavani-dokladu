import type { AppProps } from 'next/app';
import { AppProvider } from '@/state/app-context';
import { SettingsProvider } from '@/state/settings-context';
import CloseGuard from '@/components/CloseGuard';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SettingsProvider>
      <AppProvider>
        <CloseGuard />
        <Component {...pageProps} />
      </AppProvider>
    </SettingsProvider>
  );
}
