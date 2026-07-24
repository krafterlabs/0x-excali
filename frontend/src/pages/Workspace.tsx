import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasView } from "@/pages/CanvasView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileText, LayoutTemplate, History } from "lucide-react";

interface WorkspaceProps {
  fileId?: string; // URL-encoded path if a file is open
}

export function Workspace({ fileId }: WorkspaceProps) {
  const [, setLocation] = useLocation();
  const [workspace, setWorkspace] = useState<any>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "offline">("synced");
  const [dirtyCount, setDirtyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const hasSyncedOnLoad = useRef(false);

  // Dialogs
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewDiagram, setShowNewDiagram] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemParent, setNewItemParent] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const { GetActiveWorkspace, GetFolderContents, GetDirtyFileCount } =
          await import("../../wailsjs/go/workspace/Service");
        
        const ws = await GetActiveWorkspace();
        if (!ws) {
          setLocation("/setup-workspace");
          return;
        }
        if (!cancelled) setWorkspace(ws);

        const allNodes = await loadAllNodes(GetFolderContents);
        if (!cancelled) setFileTree(buildTree(allNodes));

        const dirty = await GetDirtyFileCount();
        if (!cancelled) setDirtyCount(dirty);

        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("Workspace load error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => { cancelled = true; };
  }, [setLocation]);

  useEffect(() => {
    let cancelled = false;
    async function setupEvents() {
      try {
        const { EventsOn } = await import("../../wailsjs/runtime/runtime");
        EventsOn("sync:started", () => { if (!cancelled) setSyncStatus("syncing"); });
        EventsOn("sync:completed", () => { if (!cancelled) setSyncStatus("synced"); });
        EventsOn("sync:error", () => { if (!cancelled) setSyncStatus("error"); });
        EventsOn("workspace:updated", () => { if (!cancelled) refreshTree(); });
      } catch {}
    }
    setupEvents();
    return () => { cancelled = true; };
  }, []);

  const refreshTree = useCallback(async () => {
    try {
      const { GetFolderContents, GetDirtyFileCount } = await import("../../wailsjs/go/workspace/Service");
      const allNodes = await loadAllNodes(GetFolderContents);
      setFileTree(buildTree(allNodes));
      const dirty = await GetDirtyFileCount();
      setDirtyCount(dirty);
    } catch (err) {
      console.error("Refresh error:", err);
    }
  }, []);

  const handleForceSync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const { SyncFileTree } = await import("../../wailsjs/go/workspace/Service");
      await SyncFileTree();
      await refreshTree();
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }, [refreshTree]);

  // Trigger sync exactly once on app load
  useEffect(() => {
    if (workspace && !loading && !hasSyncedOnLoad.current) {
      hasSyncedOnLoad.current = true;
      handleForceSync();
    }
  }, [workspace, loading, handleForceSync]);

  const handleLogout = useCallback(async () => {
    try {
      const { Logout } = await import("../../wailsjs/go/github/AuthService");
      await Logout();
      setLocation("/auth");
    } catch {
      setLocation("/auth");
    }
  }, [setLocation]);

  // A name is invalid if empty, dot-prefixed (reserved for .gitkeep/.settings),
  // or contains a path separator.
  const nameInvalid = (() => {
    const n = newItemName.trim();
    return !n || n.startsWith(".") || n.includes("/");
  })();

  // Folder actions
  const confirmCreateFolder = async () => {
    if (nameInvalid) return;
    setCreating(true);
    try {
      const { CreateFolder } = await import("../../wailsjs/go/workspace/Service");
      const path = newItemParent ? `${newItemParent}/${newItemName.trim()}` : newItemName.trim();
      await CreateFolder(path);
      await refreshTree();
      setShowNewFolder(false);
    } catch (err) {}
    setCreating(false);
  };

  const confirmCreateDiagram = async () => {
    if (nameInvalid) return;
    setCreating(true);
    try {
      const { CreateDiagram } = await import("../../wailsjs/go/workspace/Service");
      await CreateDiagram(newItemParent, newItemName.trim());
      await refreshTree();
      setShowNewDiagram(false);
      // Auto open
      const path = newItemParent ? `${newItemParent}/${newItemName.trim()}.excalidraw` : `${newItemName.trim()}.excalidraw`;
      setLocation(`/workspace/${encodeURIComponent(path)}`);
    } catch (err) {}
    setCreating(false);
  };

  const handleDelete = async (path: string) => {
    try {
      const { DeleteItem } = await import("../../wailsjs/go/workspace/Service");
      await DeleteItem(path);
      await refreshTree();
      if (fileId && decodeURIComponent(fileId) === path) {
        setLocation("/workspace");
      }
    } catch (err) {}
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
    syncStatus,
    dirtyCount,
    onLogout: handleLogout,
    onSync: handleForceSync,
  };

  const sidebarProps = {
    fileTree,
    onFileClick: (path: string) => setLocation(`/workspace/${encodeURIComponent(path)}`),
    onCreateFolder: (parentPath?: string) => { setNewItemParent(parentPath || ""); setNewItemName(""); setShowNewFolder(true); },
    onCreateDiagram: (parentPath?: string) => { setNewItemParent(parentPath || ""); setNewItemName(""); setShowNewDiagram(true); },
    onDelete: handleDelete,
  };

  return (
    <AppShell headerProps={headerProps} sidebarProps={sidebarProps}>
      {/* Main Content Area */}
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

      {/* Dialogs */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
          <div className="py-2">
            {newItemParent && <p className="text-xs text-muted-foreground mb-2">Inside: <code>{newItemParent}/</code></p>}
            <Input autoFocus placeholder="Folder name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmCreateFolder()} />
            {newItemName.trim().startsWith(".") && <p className="text-xs text-destructive mt-2">Name can't start with a dot.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            <Button onClick={confirmCreateFolder} disabled={nameInvalid || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDiagram} onOpenChange={setShowNewDiagram}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Diagram</DialogTitle></DialogHeader>
          <div className="py-2">
            {newItemParent && <p className="text-xs text-muted-foreground mb-2">Inside: <code>{newItemParent}/</code></p>}
            <Input autoFocus placeholder="Diagram name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmCreateDiagram()} />
            {newItemName.trim().startsWith(".") && <p className="text-xs text-destructive mt-2">Name can't start with a dot.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDiagram(false)}>Cancel</Button>
            <Button onClick={confirmCreateDiagram} disabled={nameInvalid || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// Walks every folder depth-first via GetFolderContents (which returns only the
// direct children of a path) and returns a flat list of all nodes for buildTree.
async function loadAllNodes(getFolderContents: (parentPath: string) => Promise<any[]>): Promise<any[]> {
  const all: any[] = [];
  const walk = async (parentPath: string) => {
    const children = (await getFolderContents(parentPath)) || [];
    for (const child of children) {
      // Hide internal/hidden entries (.gitkeep, .settings, .git, any dotfile).
      // Skipping a hidden folder also skips descending into it.
      if (child.name.startsWith(".")) continue;
      all.push(child);
      if (child.type === "folder") await walk(child.path);
    }
  };
  await walk("");
  return all;
}

function buildTree(nodes: any[]): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];
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
