import { AppRouter } from "@/router";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <div className="app-dark">
      <TooltipProvider delay={300}>
        <AppRouter />
      </TooltipProvider>
    </div>
  );
}

export default App;
