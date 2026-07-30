'use client';

import * as React from 'react';

import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLocation } from 'wouter';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SidebarFooter } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { isDiagramFile } from '@/lib/diagram-format';
import { ROUTES, workspaceFilePathFromLocation } from '@/lib/routes';

import { database } from '../../wailsjs/go/models';
import { NavUser } from './nav-user';
import { WorkspaceSwitcherDialog } from './workspace-switcher-dialog';

export interface SidebarProps {
  workspace: database.Workspace | null;
  authUser: { username: string; avatar_url: string; email: string } | null;
  onLogout: () => void;
  onSync: () => void | Promise<void>;
  dirtyCount: number;
  hasPendingChanges: boolean;
  isLocalMode: boolean;
  fileTree: database.FileNode[];
  onFileClick: (path: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onCreateDiagram: (parentPath?: string) => void;
  onDelete: (path: string) => void;
  onWorkspaceSwitch: () => Promise<void>;
}

export function AppSidebar({
  workspace,
  authUser,
  onLogout,
  onSync,
  dirtyCount,
  hasPendingChanges,
  isLocalMode,
  fileTree,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
  onWorkspaceSwitch,
  ...props
}: SidebarProps & React.ComponentProps<typeof Sidebar>) {
  const [location] = useLocation();
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const selectedPath = workspaceFilePathFromLocation(location);

  return (
    <Sidebar collapsible="icon" {...props}>
      {!isLocalMode && (
        <WorkspaceSwitcherDialog
          open={switcherOpen}
          onOpenChange={setSwitcherOpen}
          activeRepoId={workspace?.repo_id}
          activeRepoName={workspace?.full_name}
          hasCurrentPendingChanges={hasPendingChanges || dirtyCount > 0}
          onSwitch={async (repo) => {
            const { SwitchWorkspace } = await import('../../wailsjs/go/workspace/Service');
            await SwitchWorkspace(repo);
            await onWorkspaceSwitch();
          }}
        />
      )}
      <SidebarHeader className="space-y-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className={isLocalMode ? 'hover:bg-transparent cursor-default' : 'hover:bg-accent/60 cursor-pointer'}
              onClick={isLocalMode ? undefined : () => setSwitcherOpen(true)}
              tooltip={isLocalMode ? undefined : 'Switch repository'}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary/10 text-primary shadow-sm shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold tracking-tight text-foreground">
                  {workspace?.name || 'Workspace'}
                </span>
                {workspace?.default_branch && (
                  <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                    <GitBranch className="h-3 w-3 mr-1 opacity-70 shrink-0" />
                    <span className="truncate">{workspace.default_branch}</span>
                  </div>
                )}
              </div>
              {!isLocalMode && (
                <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="px-2 group-data-[collapsible=icon]:px-0">
            <SidebarMenuButton
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-sm justify-center group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0"
              onClick={() => onCreateDiagram('')}
              tooltip="New diagram"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden font-medium">New diagram</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Files</SidebarGroupLabel>
          <SidebarGroupAction title="New Folder" onClick={() => onCreateFolder('')}>
            <FolderPlus /> <span className="sr-only">New Folder</span>
          </SidebarGroupAction>
          <SidebarMenu>
            <FolderTree
              nodes={fileTree}
              selectedPath={selectedPath}
              onFileClick={onFileClick}
              onCreateFolder={onCreateFolder}
              onCreateDiagram={onCreateDiagram}
              onDelete={onDelete}
              level={0}
            />
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          authUser={authUser}
          onLogout={onLogout}
          onSync={onSync}
          dirtyCount={dirtyCount}
          hasPendingChanges={hasPendingChanges}
          isLocalMode={isLocalMode}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export interface TreeNode extends database.FileNode {
  children?: TreeNode[];
}

export interface TreeProps {
  nodes?: TreeNode[];
  selectedPath?: string;
  onFileClick: (path: string) => void;
  onCreateFolder: (parent: string | undefined) => void;
  onCreateDiagram: (parent: string | undefined) => void;
  onDelete: (path: string) => void;
  level?: number;
}

function FolderTree({
  nodes,
  selectedPath,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
  level = 0,
}: TreeProps) {
  if (!nodes || nodes.length === 0) {
    if (level === 0)
      return <div className="p-4 text-xs text-muted-foreground text-center">No files yet</div>;
    return null;
  }

  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {sorted.map((node: TreeNode) => (
        <TreeItem
          key={node.path}
          node={node}
          level={level}
          selectedPath={selectedPath}
          onFileClick={onFileClick}
          onCreateFolder={onCreateFolder}
          onCreateDiagram={onCreateDiagram}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function TreeItem({
  node,
  level = 0,
  selectedPath,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
}: TreeProps & { node: TreeNode }) {
  const isFolder = node.type === 'folder' || node.type === 'tree';
  const isDiagram = isDiagramFile(node.name);
  const isSelected = selectedPath === node.path;

  const [unsupported, setUnsupported] = React.useState(false);

  const handleFileClick = () => {
    if (isDiagram && onFileClick) {
      onFileClick(node.path);
    } else if (!isDiagram) {
      setUnsupported(true);
      setTimeout(() => setUnsupported(false), 2000);
    }
  };

  const NodeMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuAction showOnHover />}>
        <MoreHorizontal />
        <span className="sr-only">More</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" side="right" align="start">
        {isFolder && (
          <>
            <DropdownMenuItem onClick={() => onCreateDiagram?.(node.path)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>New Diagram</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateFolder?.(node.path)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              <span>New Folder</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => onDelete?.(node.path)}>
          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
          <span className="text-destructive">Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const paddingLeft = level * 16 + 8;

  if (isFolder) {
    return (
      <Collapsible defaultOpen={level < 1} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger
            render={
              <SidebarMenuButton tooltip={node.name} style={{ paddingLeft: `${paddingLeft}px` }} />
            }
          >
            <ChevronRight className="transition-transform group-data-[open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden shrink-0" />
            <Folder className="group-data-[open]/collapsible:hidden text-amber-400 shrink-0" />
            <FolderOpen className="hidden group-data-[open]/collapsible:block text-amber-400 shrink-0" />
            <span className="truncate flex-1">{node.name}</span>
          </CollapsibleTrigger>
          <NodeMenu />
          <CollapsibleContent>
            <FolderTree
              nodes={node.children}
              level={level + 1}
              selectedPath={selectedPath}
              onFileClick={onFileClick}
              onCreateFolder={onCreateFolder}
              onCreateDiagram={onCreateDiagram}
              onDelete={onDelete}
            />
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={node.name}
        isActive={isSelected}
        onClick={handleFileClick}
        style={{ paddingLeft: `${paddingLeft + 16}px` }}
      >
        <FileText
          className={cn(isDiagram ? 'text-violet-400' : 'text-muted-foreground opacity-50')}
        />
        <span className="truncate flex-1">{node.name}</span>
        {unsupported && (
          <span className="text-[10px] text-destructive ml-2 shrink-0 animate-in fade-in">
            Not supported
          </span>
        )}
        {node.is_dirty && !unsupported && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 ml-2" />
        )}
      </SidebarMenuButton>
      <NodeMenu />
    </SidebarMenuItem>
  );
}
