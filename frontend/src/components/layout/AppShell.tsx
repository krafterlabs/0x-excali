import { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar, SidebarProps } from "../app-sidebar";
import { Header, HeaderProps } from "./Header";

interface AppShellProps {
  children: ReactNode;
  headerProps?: HeaderProps;
  sidebarProps?: SidebarProps;
}

export function AppShell({ children, headerProps, sidebarProps }: AppShellProps) {
  return (
    <div className="app-dark">
      <SidebarProvider>
        {sidebarProps && <AppSidebar {...sidebarProps} />}
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          {headerProps && <Header {...headerProps} />}
          <main className="flex-1 overflow-hidden relative bg-card/10">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
