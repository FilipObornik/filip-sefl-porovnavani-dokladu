import type { AppProps } from 'next/app';
import { AppProvider } from '@/state/app-context';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProvider>
      <Component {...pageProps} />
    </AppProvider>
  );
}
