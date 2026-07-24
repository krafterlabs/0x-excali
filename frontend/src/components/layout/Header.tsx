import { useState } from "react";
import { LogOut, CloudOff, Cloud, RefreshCw, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface HeaderProps {
  workspace: any;
  syncStatus: "synced" | "syncing" | "error" | "offline";
  dirtyCount: number;
  onLogout: () => void;
  onSync: () => void | Promise<void>;
}

export function Header({
  workspace,
  syncStatus,
  dirtyCount,
  onLogout,
  onSync,
}: HeaderProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await onSync(); // sync the data one last time before logging out
    } catch {
      // proceed with logout even if the final sync fails
    }
    setLoggingOut(false);
    setConfirmLogout(false);
    onLogout();
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-background px-4">
        {/* Left: App Logo & Workspace */}
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded overflow-hidden shadow-sm">
            <img src="/logo.png" alt="0x" className="h-full w-full object-cover" />
          </div>
          <Separator orientation="vertical" className="h-4 opacity-50" />
          <span className="text-sm font-semibold text-foreground tracking-tight">{workspace?.name || "Workspace"}</span>
          {workspace?.default_branch && (
            <span className="rounded-full bg-accent/50 border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
              {workspace.default_branch}
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger onClick={onSync} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                {syncStatus === "syncing" ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                ) : syncStatus === "error" ? (
                  <CloudOff className="h-4 w-4 text-destructive" />
                ) : dirtyCount > 0 ? (
                  <div className="relative">
                    <Cloud className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 flex h-2 w-2 rounded-full bg-amber-500" />
                  </div>
                ) : (
                  <Cloud className="h-4 w-4 text-green-500" />
                )}
            </TooltipTrigger>
            <TooltipContent>
              {syncStatus === "syncing"
                ? "Syncing..."
                : dirtyCount > 0
                ? `${dirtyCount} pending changes`
                : "Synced"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <Tooltip>
            <TooltipTrigger onClick={() => setConfirmLogout(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Log out</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <Dialog open={confirmLogout} onOpenChange={(o: boolean) => !loggingOut && setConfirmLogout(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
            <DialogDescription>
              Your changes will be synced to GitHub before you're logged out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)} disabled={loggingOut}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmLogout} disabled={loggingOut}>
              {loggingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loggingOut ? "Syncing…" : "Sync & log out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
