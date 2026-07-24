import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileNode {
  id: number;
  path: string;
  name: string;
  type: string;
  is_dirty: boolean;
  children?: FileNode[];
}

interface FolderTreeProps {
  nodes: FileNode[];
  selectedPath?: string;
  onFileClick?: (path: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onCreateDiagram?: (parentPath: string) => void;
  onDelete?: (path: string) => void;
  className?: string;
  level?: number;
}

/**
 * FolderTree renders a recursive collapsible file/folder tree.
 * Folders are sorted before files, both alphabetically.
 */
export function FolderTree({
  nodes,
  selectedPath,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
  className,
  level = 0,
}: FolderTreeProps) {
  if (!nodes || nodes.length === 0) {
    return level === 0 ? (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-xs">No files yet</p>
      </div>
    ) : null;
  }

  // Sort: folders first, then alphabetically
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={cn("flex flex-col", className)}>
      {sorted.map((node) => (
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
    </div>
  );
}

interface TreeItemProps {
  node: FileNode;
  level: number;
  selectedPath?: string;
  onFileClick?: (path: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onCreateDiagram?: (parentPath: string) => void;
  onDelete?: (path: string) => void;
}

function TreeItem({
  node,
  level,
  selectedPath,
  onFileClick,
  onCreateFolder,
  onCreateDiagram,
  onDelete,
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level < 1); // Auto-expand first level
  const isFolder = node.type === "folder";
  const isExcalidraw = node.name.endsWith(".excalidraw");
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    if (isFolder) {
      setIsExpanded((prev) => !prev);
    } else if (onFileClick) {
      onFileClick(node.path);
    }
  }, [isFolder, node.path, onFileClick]);

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1",
          "text-sm transition-colors duration-150",
          isSelected 
            ? "bg-primary/15 text-foreground font-medium" 
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          isExcalidraw && "cursor-pointer",
          isFolder && "cursor-pointer"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Chevron for folders */}
        {isFolder ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Icon */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-400/80" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-400/80" />
          )
        ) : (
          <FileText
            className={cn(
              "h-4 w-4 shrink-0",
              isExcalidraw ? "text-violet-400/80" : "text-muted-foreground/60"
            )}
          />
        )}

        {/* Name */}
        <span className="flex-1 truncate text-xs">{node.name}</span>

        {/* Dirty indicator */}
        {node.is_dirty && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-0 group-hover:opacity-100",
              "transition-opacity duration-150 hover:bg-accent/50"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {isFolder && (
              <>
                <DropdownMenuItem
                  onClick={() => onCreateDiagram?.(node.path)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  New Diagram
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCreateFolder?.(node.path)}
                >
                  <Folder className="mr-2 h-3.5 w-3.5" />
                  New Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => onDelete?.(node.path)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children (recursive) */}
      {isFolder && isExpanded && node.children && (
        <FolderTree
          nodes={node.children}
          level={level + 1}
          onFileClick={onFileClick}
          onCreateFolder={onCreateFolder}
          onCreateDiagram={onCreateDiagram}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
