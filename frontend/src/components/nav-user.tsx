import { useState } from 'react';

import { ChevronsUpDownIcon, CloudUpload, Loader2, LogOutIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export function NavUser({
  authUser,
  onLogout,
  onSync,
  dirtyCount,
  hasPendingChanges,
}: {
  authUser: { username: string; avatar_url: string; email: string } | null;
  onLogout: () => void;
  onSync: () => void | Promise<void>;
  dirtyCount: number;
  hasPendingChanges: boolean;
}) {
  const { isMobile } = useSidebar();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const hasUnsyncedChanges = hasPendingChanges || dirtyCount > 0;

  const handleLogout = () => {
    setConfirmLogout(false);
    onLogout();
  };

  const handleSyncAndStay = async () => {
    setSyncing(true);
    try {
      await onSync();
      setConfirmLogout(false);
    } catch {
      void 0;
    }
    setSyncing(false);
  };

  const username = authUser?.username || 'GitHub User';
  const avatarUrl = authUser?.avatar_url || `https://github.com/${username}.png?size=64`;
  const email = authUser?.email || 'GitHub Account';

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage src={avatarUrl} alt={username} />
                <AvatarFallback>{username.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{username}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-fit min-w-56"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuItem
                onClick={() => setConfirmLogout(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog
        open={confirmLogout}
        onOpenChange={(o: boolean) => !syncing && setConfirmLogout(o)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log out?</DialogTitle>
            <DialogDescription>
              {hasUnsyncedChanges
                ? dirtyCount > 0
                  ? `You have ${dirtyCount} unsynced change${dirtyCount === 1 ? '' : 's'}. Logging out without syncing may leave those changes only on this device.`
                  : 'You have local changes that have not been synced to GitHub. Logging out without syncing may leave those changes only on this device.'
                : 'You will be signed out of your GitHub account in this app.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setConfirmLogout(false)} disabled={syncing}>
              Cancel
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button variant="destructive" onClick={handleLogout} disabled={syncing}>
                Log out
              </Button>
              {hasUnsyncedChanges && (
                <Button onClick={handleSyncAndStay} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CloudUpload className="mr-2 h-4 w-4" />
                  )}
                  {syncing ? 'Syncing…' : 'Sync changes'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
