import { Save } from 'lucide-react';

export interface EditorHeaderProps {
  saving: boolean;
}

export function EditorHeader({ saving }: EditorHeaderProps) {
  if (!saving) return null;

  return (
    <div className="absolute top-4 right-4 z-50 pointer-events-none flex items-center">
      <div className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur border border-border/50">
        <Save className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Saving
        </span>
      </div>
    </div>
  );
}
