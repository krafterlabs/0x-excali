import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
  headerProps?: any; // To pass workspace/sync data
  sidebarProps?: any; // To pass file tree data
}

export function AppShell({ children, headerProps, sidebarProps }: AppShellProps) {
  return (
    <div className="app-shell flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Header {...headerProps} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar {...sidebarProps} />
        <main className="flex-1 overflow-hidden relative bg-card/10">
          {children}
        </main>
      </div>
    </div>
  );
}
