import type { Metadata } from 'next';
import { Inter, Noto_Sans_Gurmukhi } from 'next/font/google';
import './globals.css';
import ThemeProvider from '../components/ThemeProvider';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const gurmukhi = Noto_Sans_Gurmukhi({
  variable: '--font-gurmukhi',
  subsets: ['gurmukhi'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'ਪੰਜਾਬ ਦੁਕਾਨ ਪ੍ਰਬੰਧਕ | Punjab Shop Manager',
  description: 'Kirana, Hardware, and Mobile Retail Shop Management System in English & Punjabi',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pa" className={`${inter.variable} ${gurmukhi.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans">
        <ThemeProvider>{children}</ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) {
                      console.log('ServiceWorker registered:', reg.scope);
                    },
                    function(err) {
                      console.log('ServiceWorker failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
