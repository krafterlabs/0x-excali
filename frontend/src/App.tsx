import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppRouter } from "@/router";

function App() {
  return (
    <div className="app-dark">
      <TooltipProvider delay={300}>
        <AppRouter />
        <Toaster />
      </TooltipProvider>
    </div>
  );
}

export default App;
