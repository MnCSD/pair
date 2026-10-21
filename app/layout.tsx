import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import type { ReactNode } from 'react';
import { Header } from '@/components/Bits';
import { ClientWrapper } from '@/components/ClientWrapper';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], weight: ['400', '600', '800'], variable: '--font-archivo' });

export const metadata: Metadata = {
  title: 'Pair — temporary chat for two',
  description: 'A two-person chat that disappears when either of you leaves. No account, nothing stored.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const viewport: Viewport = { themeColor: '#f3f2f2', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="bg-bg font-sans text-ink antialiased">
        <div className="flex h-dvh flex-col">
          <Header />
          <ClientWrapper>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </ClientWrapper>
        </div>
      </body>
    </html>
  );
}
