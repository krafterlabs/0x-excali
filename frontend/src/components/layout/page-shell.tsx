import { ReactNode } from 'react';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PageShellProps {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  maxWidth?: 'md' | 'lg' | '2xl';
}

const maxWidthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  '2xl': 'max-w-2xl',
} as const;

export function PageShell({ title, onBack, children, maxWidth = 'lg' }: PageShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/50 px-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-sm font-semibold">{title}</h1>
      </header>

      <ScrollArea className="flex-1">
        <div className={`mx-auto ${maxWidthClass[maxWidth]} p-6`}>{children}</div>
      </ScrollArea>
    </div>
  );
}
