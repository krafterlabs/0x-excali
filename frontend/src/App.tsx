import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppRouter } from '@/router';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider delay={300}>
        <AppRouter />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
