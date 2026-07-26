import { useState } from 'react';

import { ChevronsUpDownIcon, Loader2, LogOutIcon } from 'lucide-react';

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
}: {
  authUser: { username: string; avatar_url: string; email: string } | null;
  onLogout: () => void;
  onSync: () => void | Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await onSync();
    } catch {
      void 0;
    }
    setLoggingOut(false);
    setConfirmLogout(false);
    onLogout();
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
        onOpenChange={(o: boolean) => !loggingOut && setConfirmLogout(o)}
      >
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
              {loggingOut ? 'Syncing…' : 'Sync & log out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
