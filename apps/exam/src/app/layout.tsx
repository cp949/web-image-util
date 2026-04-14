import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ClientThemeProvider } from '../components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Web Image Util Examples',
  description: '@cp949/web-image-util library examples collection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppRouterCacheProvider>
          <ClientThemeProvider>{children}</ClientThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
