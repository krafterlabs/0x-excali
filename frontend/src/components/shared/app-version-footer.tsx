import { Heart } from 'lucide-react';

import { useAppVersion } from '@/hooks/use-app-version';

export function AppVersionFooter() {
  const version = useAppVersion();

  return (
    <footer className="shrink-0 border-t border-border/50 bg-background/80 px-4 py-3">
      <div className="flex flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span>Made with</span>
          <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden />
          <span>in Bangalore</span>
        </p>
        <p className="font-mono text-[11px] tracking-wide text-muted-foreground/80">{version}</p>
      </div>
    </footer>
  );
}
