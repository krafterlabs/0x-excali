import { ReactNode } from 'react';

import { AppVersionFooter } from '@/components/shared/app-version-footer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-8 py-8 lg:px-10">
          <header className="mb-8 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </header>
          <div className="space-y-8">{children}</div>
        </div>
      </ScrollArea>
      <div className="shrink-0 px-8 py-4 lg:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <AppVersionFooter />
        </div>
      </div>
    </div>
  );
}

interface WorkspacePanelSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WorkspacePanelSection({
  title,
  description,
  icon,
  children,
  className,
}: WorkspacePanelSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {title}
        </h2>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
