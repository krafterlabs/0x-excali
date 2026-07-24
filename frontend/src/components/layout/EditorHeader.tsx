import { Save, Folder, ChevronRight } from "lucide-react";

export interface EditorHeaderProps {
  filePath: string;
  saving: boolean;
}

export function EditorHeader({ filePath, saving }: EditorHeaderProps) {
  const parts = filePath.split("/");
  const fileName = parts.pop();
  const folderPath = parts.join("/");

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-1.5">
        <Folder className="h-3.5 w-3.5 text-muted-foreground/50" />
        <div className="flex items-center text-xs">
          {folderPath ? (
            <>
              <span className="text-muted-foreground truncate max-w-[150px]">
                {folderPath}
              </span>
              <ChevronRight className="h-3.5 w-3.5 mx-1 text-muted-foreground/40" />
            </>
          ) : null}
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {fileName}
          </span>
        </div>
      </div>

      <div className="flex items-center">
        {saving && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent/50 px-2.5 py-1">
            <Save className="h-3 w-3 text-muted-foreground animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saving</span>
          </div>
        )}
      </div>
    </div>
  );
}
