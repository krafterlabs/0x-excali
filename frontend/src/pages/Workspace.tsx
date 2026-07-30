import { useCallback, useEffect, useRef, useState } from 'react';

import { FileText, History, LayoutTemplate, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { CanvasView } from '@/pages/CanvasView';

import { database } from '../../wailsjs/go/models';

interface WorkspaceProps {
  fileId?: string;
}

export interface TreeNode extends database.FileNode {
  children: TreeNode[];
}

export function Workspace({ fileId }: WorkspaceProps) {
  const [, setLocation] = useLocation();
  const [workspace, setWorkspace] = useState<database.Workspace | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>(
    'synced'
  );
  const [dirtyCount, setDirtyCount] = useState(0);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<{
    username: string;
    avatar_url: string;
    email: string;
  } | null>(null);

  const hasSyncedOnLoad = useRef(false);

  const reloadWorkspace = useCallback(async () => {
    const { GetActiveWorkspace, GetFolderContents, GetDirtyFileCount, HasPendingLocalChanges } =
      await import('../../wailsjs/go/workspace/Service');

    const ws = await GetActiveWorkspace();
    if (!ws) {
      setLocation('/setup-workspace');
      return;
    }
    setWorkspace(ws);

    const allNodes = await loadAllNodes(GetFolderContents);
    setFileTree(buildTree(allNodes));

    const dirty = await GetDirtyFileCount();
    setDirtyCount(dirty);

    const pending = await HasPendingLocalChanges();
    setHasPendingChanges(pending);
  }, [setLocation]);

  const handleWorkspaceSwitch = useCallback(async () => {
    hasSyncedOnLoad.current = false;
    setLocation('/workspace');
    setLoading(true);
    try {
      await reloadWorkspace();
      setSyncStatus('syncing');
      const { HasPendingLocalChanges, PullFileTree, SyncFileTree } =
        await import('../../wailsjs/go/workspace/Service');
      const hasLocalChanges = await HasPendingLocalChanges();
      if (hasLocalChanges) {
        await SyncFileTree();
      } else {
        await PullFileTree();
      }
      await reloadWorkspace();
      setSyncStatus('synced');
      hasSyncedOnLoad.current = true;
    } catch (err) {
      console.error('Workspace switch error:', err);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, [reloadWorkspace, setLocation]);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewDiagram, setShowNewDiagram] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemParent, setNewItemParent] = useState('');
  const [creating, setCreating] = useState(false);

  const refreshTree = useCallback(async () => {
    try {
      const { GetFolderContents, GetDirtyFileCount, HasPendingLocalChanges } =
        await import('../../wailsjs/go/workspace/Service');
      const allNodes = await loadAllNodes(GetFolderContents);
      setFileTree(buildTree(allNodes));
      const dirty = await GetDirtyFileCount();
      setDirtyCount(dirty);
      const pending = await HasPendingLocalChanges();
      setHasPendingChanges(pending);
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const { GetActiveWorkspace, GetFolderContents, GetDirtyFileCount, HasPendingLocalChanges } =
          await import('../../wailsjs/go/workspace/Service');

        const ws = await GetActiveWorkspace();
        if (!ws) {
          setLocation('/setup-workspace');
          return;
        }
        if (!cancelled) setWorkspace(ws);

        const allNodes = await loadAllNodes(GetFolderContents);
        if (!cancelled) setFileTree(buildTree(allNodes));

        const dirty = await GetDirtyFileCount();
        if (!cancelled) setDirtyCount(dirty);

        const pending = await HasPendingLocalChanges();
        if (!cancelled) setHasPendingChanges(pending);

        const { GetAuthStatus } = await import('../../wailsjs/go/github/AuthService');
        const auth = await GetAuthStatus();
        if (auth?.authenticated && !cancelled) {
          setAuthUser({
            username: auth.username,
            avatar_url: auth.avatar_url,
            email: auth.email,
          });
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error('Workspace load error:', err);
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  useEffect(() => {
    let cancelled = false;
    async function setupEvents() {
      try {
        const { EventsOn } = await import('../../wailsjs/runtime/runtime');
        EventsOn('sync:started', () => {
          if (!cancelled) setSyncStatus('syncing');
        });
        EventsOn('sync:completed', () => {
          if (!cancelled) setSyncStatus('synced');
        });
        EventsOn('sync:error', () => {
          if (!cancelled) setSyncStatus('error');
        });
        EventsOn('workspace:updated', () => {
          if (!cancelled) refreshTree();
        });
        EventsOn('workspace:switched', () => {
          if (!cancelled) void reloadWorkspace();
        });
      } catch {
        void 0;
      }
    }
    setupEvents();
    return () => {
      cancelled = true;
    };
  }, [refreshTree, reloadWorkspace]);

  const handleForceSync = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        toast.add({
          title: 'Started syncing',
          description: 'Sync in progress...',
          type: 'info',
          timeout: 3000,
        });
      }
      setSyncStatus('syncing');
      try {
        const { SyncFileTree } = await import('../../wailsjs/go/workspace/Service');
        await SyncFileTree();
        await refreshTree();
        setSyncStatus('synced');
        if (!silent) {
          toast.add({
            title: 'Sync completed',
            description: `Synced to github (${workspace?.name}) is complete.`,
            type: 'success',
            timeout: 5000,
          });
        }
      } catch (err) {
        console.error('Sync error:', err);
        setSyncStatus('error');
        toast.add({
          title: 'Sync failed',
          description: err instanceof Error ? err.message : 'Could not synchronize with GitHub.',
          type: 'error',
          timeout: 5000,
        });
      }
    },
    [refreshTree, workspace?.name]
  );

  const handleStartupSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const { HasPendingLocalChanges, PullFileTree, SyncFileTree } =
        await import('../../wailsjs/go/workspace/Service');
      const hasLocalChanges = await HasPendingLocalChanges();
      if (hasLocalChanges) {
        await SyncFileTree();
      } else {
        await PullFileTree();
      }
      await refreshTree();
      setSyncStatus('synced');
    } catch (err) {
      console.error('Startup sync error:', err);
      setSyncStatus('error');
    }
  }, [refreshTree]);

  useEffect(() => {
    if (workspace && !loading && !hasSyncedOnLoad.current) {
      hasSyncedOnLoad.current = true;
      handleStartupSync();
    }
  }, [workspace, loading, handleStartupSync]);

  const handleLogout = useCallback(async () => {
    try {
      const { Logout } = await import('../../wailsjs/go/github/AuthService');
      await Logout();
      setLocation('/auth');
    } catch {
      setLocation('/auth');
    }
  }, [setLocation]);

  const nameInvalid = (() => {
    const n = newItemName.trim();
    return !n || n.startsWith('.') || n.includes('/');
  })();

  const confirmCreateFolder = async () => {
    if (nameInvalid) return;
    setCreating(true);
    try {
      const { CreateFolder } = await import('../../wailsjs/go/workspace/Service');
      const path = newItemParent ? `${newItemParent}/${newItemName.trim()}` : newItemName.trim();
      await CreateFolder(path);
      await refreshTree();
      setShowNewFolder(false);
    } catch (err) {
      console.error('Create folder error:', err);
      toast.add({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create folder',
        type: 'error',
        timeout: 5000,
      });
    }
    setCreating(false);
  };

  const confirmCreateDiagram = async () => {
    if (nameInvalid) return;
    setCreating(true);
    try {
      const { CreateDiagram } = await import('../../wailsjs/go/workspace/Service');
      await CreateDiagram(newItemParent, newItemName.trim());
      await refreshTree();
      setShowNewDiagram(false);

      const path = newItemParent
        ? `${newItemParent}/${newItemName.trim()}.excalidraw`
        : `${newItemName.trim()}.excalidraw`;
      setLocation(`/workspace/${encodeURIComponent(path)}`);
    } catch (err) {
      console.error('Create diagram error:', err);
      toast.add({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create diagram',
        type: 'error',
        timeout: 5000,
      });
    }
    setCreating(false);
  };

  const handleDelete = async (path: string) => {
    try {
      const { DeleteItem } = await import('../../wailsjs/go/workspace/Service');
      await DeleteItem(path);
      await refreshTree();
      if (fileId && decodeURIComponent(fileId) === path) {
        setLocation('/workspace');
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.add({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete item',
        type: 'error',
        timeout: 5000,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const headerProps = {
    workspace,
    activeFile: fileId ? decodeURIComponent(fileId) : undefined,
    syncStatus,
    dirtyCount,
    onSync: handleForceSync,
  };

  const sidebarProps = {
    workspace,
    authUser,
    onLogout: handleLogout,
    onSync: handleForceSync,
    dirtyCount,
    hasPendingChanges,
    fileTree,
    onFileClick: (path: string) => setLocation(`/workspace/${encodeURIComponent(path)}`),
    onCreateFolder: (parentPath?: string) => {
      setNewItemParent(parentPath || '');
      setNewItemName('');
      setShowNewFolder(true);
    },
    onCreateDiagram: (parentPath?: string) => {
      setNewItemParent(parentPath || '');
      setNewItemName('');
      setShowNewDiagram(true);
    },
    onDelete: handleDelete,
    onWorkspaceSwitch: handleWorkspaceSwitch,
  };

  return (
    <AppShell headerProps={headerProps} sidebarProps={sidebarProps}>
      {fileId ? (
        <CanvasView id={fileId} key={fileId} />
      ) : (
        <div className="flex flex-col items-center justify-center h-full w-full text-center px-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border shadow-sm mb-6">
            <LayoutTemplate className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Welcome to {workspace?.name}</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-8">
            Select a diagram from the sidebar to start editing, or create a new one to get started.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => setShowNewDiagram(true)} className="gap-2">
              <FileText className="h-4 w-4" />
              New Diagram
            </Button>
            <Button variant="secondary" onClick={handleForceSync} className="gap-2">
              <History className="h-4 w-4" />
              Sync Changes
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {newItemParent && (
              <p className="text-xs text-muted-foreground mb-2">
                Inside: <code>{newItemParent}/</code>
              </p>
            )}
            <Input
              autoFocus
              placeholder="Folder name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()}
            />
            {newItemName.trim().startsWith('.') && (
              <p className="text-xs text-destructive mt-2">Name can't start with a dot.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCreateFolder} disabled={nameInvalid || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDiagram} onOpenChange={setShowNewDiagram}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Diagram</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {newItemParent && (
              <p className="text-xs text-muted-foreground mb-2">
                Inside: <code>{newItemParent}/</code>
              </p>
            )}
            <Input
              autoFocus
              placeholder="Diagram name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateDiagram()}
            />
            {newItemName.trim().startsWith('.') && (
              <p className="text-xs text-destructive mt-2">Name can't start with a dot.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDiagram(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCreateDiagram} disabled={nameInvalid || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

async function loadAllNodes(
  getFolderContents: (parentPath: string) => Promise<database.FileNode[]>
): Promise<database.FileNode[]> {
  const all: database.FileNode[] = [];
  const walk = async (parentPath: string) => {
    const children = (await getFolderContents(parentPath)) || [];
    for (const child of children) {
      if (child.name.startsWith('.')) continue;
      all.push(child);
      if (child.type === 'folder' || child.type === 'tree') await walk(child.path);
    }
  };
  await walk('');
  return all;
}

function buildTree(nodes: database.FileNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const node of nodes) map.set(node.path, { ...node, children: [] });
  for (const node of nodes) {
    const treeNode = map.get(node.path)!;
    if (node.parent_path && map.has(node.parent_path)) {
      map.get(node.parent_path)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }
  return roots;
}
