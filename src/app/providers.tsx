'use client';

import { PreferencesProvider } from '@/context/preferences-context';
import { ThemeProvider } from '@/context/theme-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </PreferencesProvider>
  );
}
