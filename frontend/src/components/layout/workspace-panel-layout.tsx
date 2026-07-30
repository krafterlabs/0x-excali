import { ReactNode } from 'react';

import { AppVersionFooter } from '@/components/shared/app-version-footer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface WorkspacePanelLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function WorkspacePanelLayout({
  title,
  description,
  children,
}: WorkspacePanelLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-2xl space-y-6 p-6 pb-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
      </ScrollArea>
      <AppVersionFooter />
    </div>
  );
}
