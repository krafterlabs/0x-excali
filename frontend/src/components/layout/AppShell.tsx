import { ReactNode } from 'react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar, SidebarProps } from '../app-sidebar';
import { Header, HeaderProps } from './Header';

interface AppShellProps {
  children: ReactNode;
  headerProps?: HeaderProps;
  sidebarProps?: SidebarProps;
}

export function AppShell({ children, headerProps, sidebarProps }: AppShellProps) {
  return (
    <SidebarProvider>
      {sidebarProps && <AppSidebar {...sidebarProps} />}
      <SidebarInset className="w-auto min-w-0 flex flex-col h-screen overflow-hidden z-0 relative">
        {headerProps && <Header {...headerProps} />}
        <main className="flex-1 overflow-hidden relative bg-card/10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
