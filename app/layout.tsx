import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Projeto ser GCM',
  description: 'Plataforma profissional de cronograma baseada em Ciclo de Estudos para GCM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={plusJakartaSans.className} suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 min-h-screen" suppressHydrationWarning>
        <AuthProvider>
          <PWAInstallPrompt />
          {children}
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
