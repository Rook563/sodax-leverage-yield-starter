import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeverageYieldPage } from '@/features/leverage-yield/LeverageYieldPage';

export function App() {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <LeverageYieldPage />
          </div>
        </main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}
